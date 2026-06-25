import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { sendProUpgradeEmail, sendSubscriptionCancelledEmail, sendSubscriptionRenewedEmail, sendPaymentFailedGraceEmail } from '../services/email.service';
import { sendEmailOnce } from '../services/email-events.service';
import { verifySignature, createSignature } from '../utils/prodamus-hmac';
import logger from '../services/logger';

const PRO_PRICE_RUB = parseInt(process.env.PRO_PRICE_1M || '386', 10);
const PAYMENT_PROVIDER = 'prodamus';
const PROCESSING_STALE_MS = 10 * 60 * 1000;
const ensureProPrice = (price?: number | null) => (price && price > 0 ? price : PRO_PRICE_RUB);

interface PeriodInfo { months: number; pricePerMonth: number; discount: number; total: number }

type BillingPeriod = 1 | 3 | 6 | 12;
const VALID_PERIODS: BillingPeriod[] = [1, 3, 6, 12];

const BILLING_PERIODS: Record<BillingPeriod, PeriodInfo> = {
  1:  { months: 1,  pricePerMonth: parseInt(process.env.PRO_PRICE_1M || '386', 10),  discount: 0,  total: parseInt(process.env.PRO_TOTAL_1M || '386', 10) },
  3:  { months: 3,  pricePerMonth: parseInt(process.env.PRO_PRICE_3M || '367', 10),  discount: 5,  total: parseInt(process.env.PRO_TOTAL_3M || '1101', 10) },
  6:  { months: 6,  pricePerMonth: parseInt(process.env.PRO_PRICE_6M || '328', 10),  discount: 15, total: parseInt(process.env.PRO_TOTAL_6M || '1968', 10) },
  12: { months: 12, pricePerMonth: parseInt(process.env.PRO_PRICE_12M || '309', 10), discount: 20, total: parseInt(process.env.PRO_TOTAL_12M || '3708', 10) },
};

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function claimPaymentEvent(providerEventId: string, orderId?: string): Promise<'claimed' | 'processed' | 'inflight'> {
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: PAYMENT_PROVIDER,
        providerEventId,
        orderId,
        status: 'PROCESSING',
      },
    });
    return 'claimed';
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  const existing = await prisma.paymentEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: PAYMENT_PROVIDER,
        providerEventId,
      },
    },
  });

  if (!existing) return 'inflight';
  if (existing.status === 'PROCESSED') return 'processed';

  const staleBefore = new Date(Date.now() - PROCESSING_STALE_MS);
  if (existing.status === 'PROCESSING' && existing.updatedAt > staleBefore) return 'inflight';

  await prisma.paymentEvent.update({
    where: {
      provider_providerEventId: {
        provider: PAYMENT_PROVIDER,
        providerEventId,
      },
    },
    data: {
      status: 'PROCESSING',
      orderId: orderId ?? existing.orderId,
      lastError: null,
    },
  });

  return 'claimed';
}

async function markPaymentEventProcessed(providerEventId: string, note?: string): Promise<void> {
  await prisma.paymentEvent.update({
    where: {
      provider_providerEventId: {
        provider: PAYMENT_PROVIDER,
        providerEventId,
      },
    },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
      lastError: note ?? null,
    },
  });
}

async function markPaymentEventFailed(providerEventId: string, err: unknown): Promise<void> {
  await prisma.paymentEvent.update({
    where: {
      provider_providerEventId: {
        provider: PAYMENT_PROVIDER,
        providerEventId,
      },
    },
    data: {
      status: 'FAILED',
      lastError: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
    },
  });
}

const router = Router();

// Get subscription status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { plan: true, aiCredits: true },
    });

    res.json({
      plan: user?.plan || 'FREE',
      aiCredits: user?.aiCredits ?? 10,
      priceRub: PRO_PRICE_RUB,
      billingPeriods: BILLING_PERIODS,
      subscription: subscription ? {
        status: subscription.status,
        priceRub: subscription.priceRub,
        billingPeriod: subscription.billingPeriod,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        hasAutopayment: !!subscription.prodamusSubscriptionId,
      } : null,
    });
  } catch (err) {
    logger.error('Billing status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create payment link (PRO — one-time or subscription)
router.post('/create-payment', async (req: AuthRequest, res: Response) => {
  try {
    const { autoRenew, period: rawPeriod } = req.body as { autoRenew?: boolean; period?: number };
    const period: BillingPeriod = rawPeriod && VALID_PERIODS.includes(rawPeriod as BillingPeriod)
      ? (rawPeriod as BillingPeriod) : 1;
    const periodInfo = BILLING_PERIODS[period];

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    if (!config.prodamus.payformUrl) {
      res.status(503).json({ error: 'Платёжная система не настроена' });
      return;
    }

    // Only allow subscription auto-renew for 1-month period
    const useSubscription = autoRenew === true && period === 1 && !!config.prodamus.subscriptionId;

    // Only set billingPeriod/priceRub on CREATE (new sub). On UPDATE — don't change metadata
    // until payment succeeds (webhook). This prevents stale data if user abandons payment.
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'INACTIVE',
        priceRub: periodInfo.pricePerMonth,
        billingPeriod: period,
      },
      update: {},
    });

    const periodLabel = period === 1 ? '1 месяц' : `${period} месяцев`;

    const params = new URLSearchParams({
      do: 'link',
      customer_email: user.email,
      order_id: subscription.id,
      urlSuccess: `${config.frontendUrl}/billing/success`,
      urlNotification: `${config.backendUrl}/api/billing/webhook`,
      sys: config.prodamus.systemCode,
    });

    if (useSubscription) {
      // Subscription mode: pass subscription ID instead of products
      params.set('subscription', config.prodamus.subscriptionId);
    } else {
      // One-time payment mode: pass products with total for period
      params.set('products[0][name]', `Vibe Hosting PRO — ${periodLabel}`);
      params.set('products[0][price]', String(periodInfo.total));
      params.set('products[0][quantity]', '1');
      params.set('products[0][type]', 'service');
    }

    // Store period in customer_extra so we can read it in webhook
    const extraParts = [user.displayName || '', `period:${period}`].filter(Boolean).join('|');

    if (user.phone) params.set('customer_phone', user.phone);
    if (user.displayName) params.set('customer_name', user.displayName);
    params.set('customer_extra', extraParts);
    if (config.prodamus.demoMode) params.set('demo_mode', '1');

    // Server-side fetch: do=link returns plain text short URL, not a payment page.
    // We fetch it server-side and return the resolved URL to the frontend.
    const prodamusUrl = `${config.prodamus.payformUrl}?${params.toString()}`;
    const linkResponse = await fetch(prodamusUrl, { signal: AbortSignal.timeout(10000) });
    const linkBody = await linkResponse.text();
    if (!linkResponse.ok) {
      logger.error('Prodamus link fetch failed', { status: linkResponse.status, body: linkBody.slice(0, 500) });
      res.status(502).json({ error: 'Ошибка платёжной системы' });
      return;
    }
    const paymentUrl = linkBody.trim();
    if (!paymentUrl.startsWith('https://')) {
      logger.error('Prodamus returned invalid URL', { urlPrefix: paymentUrl.slice(0, 80) });
      res.status(502).json({ error: 'Ошибка платёжной системы' });
      return;
    }

    res.json({ paymentUrl });
  } catch (err) {
    logger.error('Create payment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create AI pack payment link
router.post('/create-ai-pack', async (req: AuthRequest, res: Response) => {
  try {
    const { pack } = req.body as { pack: '10' | '50' };
    if (!pack || !['10', '50'].includes(pack)) {
      res.status(400).json({ error: 'Неверный пакет. Допустимо: 10, 50' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    if (!config.prodamus.payformUrl) {
      res.status(503).json({ error: 'Платёжная система не настроена' });
      return;
    }

    const price = pack === '10' ? '99' : '399';
    const userHash = crypto.createHash('sha256').update(user.id).digest('hex').slice(0, 12);
    const orderId = `aipack_${userHash}_${pack}_${Date.now()}`;

    const params = new URLSearchParams({
      do: 'link',
      'products[0][name]': `Vibe Hosting AI-запросы — ${pack} шт.`,
      'products[0][price]': price,
      'products[0][quantity]': '1',
      'products[0][type]': 'service',
      customer_email: user.email,
      order_id: orderId,
      urlSuccess: `${config.frontendUrl}/billing/success`,
      urlNotification: `${config.backendUrl}/api/billing/webhook`,
      sys: config.prodamus.systemCode,
    });
    if (user.phone) params.set('customer_phone', user.phone);
    if (user.displayName) {
      params.set('customer_name', user.displayName);
      params.set('customer_extra', user.displayName);
    }
    if (config.prodamus.demoMode) params.set('demo_mode', '1');

    // Server-side fetch: do=link returns plain text short URL
    const prodamusUrl = `${config.prodamus.payformUrl}?${params.toString()}`;
    const linkResponse = await fetch(prodamusUrl, { signal: AbortSignal.timeout(10000) });
    const aiLinkBody = await linkResponse.text();
    if (!linkResponse.ok) {
      logger.error('Prodamus AI pack link fetch failed', { status: linkResponse.status, body: aiLinkBody.slice(0, 500) });
      res.status(502).json({ error: 'Ошибка платёжной системы' });
      return;
    }
    const paymentUrl = aiLinkBody.trim();
    if (!paymentUrl.startsWith('https://')) {
      logger.error('Prodamus AI pack returned invalid URL', { urlPrefix: paymentUrl.slice(0, 80) });
      res.status(502).json({ error: 'Ошибка платёжной системы' });
      return;
    }

    res.json({ paymentUrl });
  } catch (err) {
    logger.error('Create AI pack payment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Prodamus webhook handler
async function handleWebhook(req: Request, res: Response) {
  let providerEventId: string | null = null;

  try {
    // Diagnostic logging (post-parser) — enabled via PRODAMUS_DIAG=1
    if (process.env.PRODAMUS_DIAG === '1') {
      logger.info('Webhook body diagnostic', {
        bodyKeys: req.body ? Object.keys(req.body) : [],
        bodyType: typeof req.body,
        orderIdType: typeof req.body?.order_id,
        hasProducts: typeof req.body?.products,
        paymentStatusType: typeof req.body?.payment_status,
        hasSign: typeof req.body?.sign,
      });
    }

    if (!config.prodamus.secretKey) {
      logger.error('Prodamus secret key not configured, rejecting webhook');
      res.status(503).json({ error: 'Webhook not configured' });
      return;
    }

    // Prodamus sends signature either as HTTP header "Sign" or as body field "sign".
    // Check both — prefer header, fall back to body field.
    const signature = (req.headers['sign'] as string) || (typeof req.body?.sign === 'string' ? req.body.sign : '');
    if (!signature) {
      logger.warn('Webhook missing signature (no Sign header and no body.sign field)', {
        headerNames: Object.keys(req.headers),
        bodyKeys: req.body ? Object.keys(req.body) : [],
      });
      res.status(403).json({ error: 'Missing signature' });
      return;
    }

    // Prodamus canonical-object HMAC: recursively sort keys, cast values to strings,
    // JSON.stringify (with escaped slashes), HMAC-SHA256.
    // Remove 'sign' from body before verification (it's metadata, not part of the signed payload).
    const bodyData = { ...req.body };
    delete bodyData.sign;

    if (!verifySignature(bodyData, config.prodamus.secretKey, signature)) {
      logger.warn('Webhook signature mismatch', {
        receivedSignLength: signature.length,
        bodyKeys: Object.keys(bodyData),
      });
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    // Permanent structured logging (no PII — only identifiers and metadata)
    const subData = req.body.subscription;
    logger.info('Webhook received', {
      contentType: req.headers['content-type'],
      paymentId: req.body.payment_id,
      orderId: req.body.order_id,
      paymentStatus: req.body.payment_status,
      sum: req.body.sum || req.body.order_sum,
      subscriptionId: subData?.id,
      subscriptionActionCode: subData?.action_code,
    });

    const { order_id, payment_status, payment_id } = req.body;

    // Handle subscription lifecycle events
    if (subData && typeof subData === 'object') {
      const actionCode = subData.action_code;
      const notificationCode = subData.notification_code;
      const prodSubId = String(subData.id || '');

      // Auto-payment reminder — just log
      if (notificationCode === 'auto_payment_reminder') {
        logger.info('Subscription auto-payment reminder', {
          prodamusSubscriptionId: prodSubId,
          paymentDate: subData.payment_date,
          orderId: order_id,
        });
        res.status(200).send('OK');
        return;
      }

      // Deactivation or completion — cancel subscription
      if (actionCode === 'deactivation' || actionCode === 'finish') {
        const deactEventId = String(payment_id || `${actionCode}_${prodSubId || order_id}_${Date.now()}`);
        logger.info('Subscription lifecycle event', {
          actionCode,
          actionReason: subData.action_reason,
          prodamusSubscriptionId: prodSubId,
          orderId: order_id,
          lastAttempt: subData.last_attempt,
        });

        // Idempotency guard for lifecycle events
        const deactClaim = await claimPaymentEvent(deactEventId, String(order_id || prodSubId));
        if (deactClaim === 'processed' || deactClaim === 'inflight') {
          logger.info(`Lifecycle event duplicate skipped: event=${deactEventId}`);
          res.status(200).send('OK');
          return;
        }

        let sub = prodSubId
          ? await prisma.subscription.findFirst({ where: { prodamusSubscriptionId: prodSubId }, include: { user: true } })
          : order_id ? await prisma.subscription.findUnique({ where: { id: order_id }, include: { user: true } }) : null;
        // Fallback: find by customer_email if not found by ID
        if (!sub) {
          const deactEmail: string | undefined = req.body.customer_email || req.body.customer_phone_email;
          if (deactEmail) {
            const u = await prisma.user.findUnique({ where: { email: deactEmail } });
            if (u) sub = await prisma.subscription.findUnique({ where: { userId: u.id }, include: { user: true } });
          }
        }
        if (sub && sub.status === 'ACTIVE') {
          const isPaymentFailure = subData.last_attempt === 'yes';
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: isPaymentFailure ? 'PAST_DUE' : 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
          logger.info(`Subscription ${sub.id} ${isPaymentFailure ? 'past_due' : 'cancelled'} via webhook (${actionCode})`);

          // Send email notification for payment failure (PAST_DUE with 3-day grace period)
          if (isPaymentFailure && sub.user) {
            const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
            const graceEndDate = new Date((sub.currentPeriodEnd || new Date()).getTime() + gracePeriodMs);
            const dedupeKey = `payment_failed_grace:sub:${sub.id}:event:${deactEventId}`;
            sendEmailOnce({
              dedupeKey,
              eventType: 'payment_failed_grace',
              recipientEmail: sub.user.email,
              userId: sub.userId,
              category: 'billing',
              payload: { subId: sub.id, graceEndDate },
            }, () => sendPaymentFailedGraceEmail(sub.user.email, graceEndDate)).catch((err) => {
              logger.warn('Failed to send payment-failed grace email', {
                userId: sub.userId,
                subId: sub.id,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }
        await markPaymentEventProcessed(deactEventId, sub ? `${actionCode}_applied` : `${actionCode}_no_sub`);
        res.status(200).send('OK');
        return;
      }

      // Auto-payment success — renew subscription period
      if (actionCode === 'auto_payment' && payment_status === 'success') {
        // Validate auto-payment amount
        const autoPaySum = Math.round(parseFloat(req.body.sum || req.body.order_sum || '0'));
        logger.info('Subscription auto-payment received', {
          prodamusSubscriptionId: prodSubId,
          orderId: order_id,
          paymentId: payment_id,
          autopaymentNum: subData.autopayments_num,
          sum: autoPaySum,
        });
        if (autoPaySum > 0 && autoPaySum !== PRO_PRICE_RUB) {
          logger.warn('Auto-payment amount mismatch', {
            expected: PRO_PRICE_RUB, received: autoPaySum,
            prodamusSubscriptionId: prodSubId,
          });
          // Still process — HMAC-verified auto-payments are trusted, but log the mismatch
        }
        let sub = prodSubId
          ? await prisma.subscription.findFirst({ where: { prodamusSubscriptionId: prodSubId }, include: { user: true } })
          : order_id ? await prisma.subscription.findUnique({ where: { id: order_id }, include: { user: true } }) : null;
        // Fallback: find by customer_email
        if (!sub) {
          const autoEmail: string | undefined = req.body.customer_email || req.body.customer_phone_email;
          if (autoEmail) {
            const u = await prisma.user.findUnique({ where: { email: autoEmail } });
            if (u) sub = await prisma.subscription.findUnique({ where: { userId: u.id }, include: { user: true } });
          }
        }
        if (sub) {
          const evtId = String(payment_id || `autopay_${prodSubId}_${Date.now()}`);
          const claim = await claimPaymentEvent(evtId, String(order_id || sub.id));
          if (claim === 'claimed') {
            // Reject renewal for cancelled subscriptions
            if (sub.status === 'CANCELLED') {
              logger.warn('Auto-payment received for CANCELLED subscription — rejecting renewal', {
                subscriptionId: sub.id,
                prodamusSubscriptionId: prodSubId,
                cancelledAt: sub.cancelledAt,
              });
              await markPaymentEventProcessed(evtId, 'rejected_cancelled_subscription');
              res.status(200).send('OK');
              return;
            }

            // Anomaly: cancelledAt set but status is not CANCELLED
            if (sub.cancelledAt !== null) {
              logger.warn('Anomaly: subscription has cancelledAt but status is not CANCELLED', {
                subscriptionId: sub.id,
                status: sub.status,
                cancelledAt: sub.cancelledAt,
                prodamusSubscriptionId: prodSubId,
              });
            }

            const now = new Date();
            // Extend from whichever is later: now or current period end (don't lose remaining days)
            const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
            const periodEnd = new Date(base);
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            await prisma.$transaction([
              prisma.subscription.update({
                where: { id: sub.id },
                data: {
                  status: 'ACTIVE',
                  cancelledAt: null,
                  prodamusOrderId: String(payment_id || order_id),
                  currentPeriodStart: now,
                  currentPeriodEnd: periodEnd,
                },
              }),
              prisma.user.update({
                where: { id: sub.userId },
                data: { plan: 'PRO', storageLimit: BigInt(config.pro.maxTotalStorage) },
              }),
            ]);

            // Send renewal confirmation email
            if (sub.user) {
              sendEmailOnce({
                dedupeKey: `sub_renewed:event:${evtId}`,
                eventType: 'subscription_renewed',
                recipientEmail: sub.user.email,
                userId: sub.userId,
                category: 'billing',
                payload: { subscriptionId: sub.id, periodEnd },
              }, () => sendSubscriptionRenewedEmail(sub.user.email, periodEnd)).catch((err) => {
                logger.warn('Subscription renewed email send failed', {
                  userId: sub.userId,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
            }

            await markPaymentEventProcessed(evtId);
            logger.info(`Subscription ${sub.id} renewed via auto-payment, period ends ${periodEnd.toISOString()}`);
          }
        }
        res.status(200).send('OK');
        return;
      }
    }

    // Handle refund: deactivate subscription and downgrade user
    if (order_id && payment_status === 'refund') {
      const refundEventId = String(payment_id || `refund_${order_id}_${Date.now()}`);
      logger.info('Webhook refund received', { orderId: order_id, paymentId: payment_id });

      // Idempotency guard for refunds
      const refundClaim = await claimPaymentEvent(refundEventId, String(order_id));
      if (refundClaim === 'processed' || refundClaim === 'inflight') {
        logger.info(`Refund webhook duplicate skipped: event=${refundEventId}`);
        res.status(200).send('OK');
        return;
      }

      // AI pack refunds: just log (credits may already be used)
      if (typeof order_id === 'string' && order_id.startsWith('aipack_')) {
        logger.info('Refund for AI pack — no auto-reversal', { orderId: order_id });
        await markPaymentEventProcessed(refundEventId, 'refund_aipack_no_reversal');
        res.status(200).send('OK');
        return;
      }
      // PRO subscription refund
      const refundSub = await prisma.subscription.findUnique({
        where: { id: order_id },
      });
      if (refundSub && (refundSub.status === 'ACTIVE' || refundSub.status === 'CANCELLED')) {
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: refundSub.id },
            data: { status: 'PAST_DUE', cancelledAt: new Date() },
          }),
          prisma.user.update({
            where: { id: refundSub.userId },
            data: { plan: 'FREE', storageLimit: BigInt(config.free.maxTotalStorage) },
          }),
        ]);
        logger.info(`Subscription ${refundSub.id} downgraded due to refund`);
      }
      await markPaymentEventProcessed(refundEventId, refundSub ? 'refund_processed' : 'refund_no_sub');
      res.status(200).send('OK');
      return;
    }

    if (!order_id || payment_status !== 'success') {
      logger.info('Webhook ignored (non-success or missing order_id)', {
        paymentStatus: payment_status, hasOrderId: !!order_id,
      });
      res.status(200).send('OK');
      return;
    }

    providerEventId = String(payment_id || order_id);
    const claim = await claimPaymentEvent(providerEventId, String(order_id));
    if (claim === 'processed') {
      logger.info(`Webhook duplicate skipped (already processed): event=${providerEventId}`);
      res.status(200).send('OK');
      return;
    }
    if (claim === 'inflight') {
      logger.info(`Webhook duplicate skipped (inflight): event=${providerEventId}`);
      res.status(200).send('OK');
      return;
    }

    // Validate payment amount (Prodamus sends 'sum' field as string, e.g. "386.00")
    const webhookSumRaw = parseFloat(req.body.sum || req.body.order_sum || '0');
    const webhookSum = Math.round(webhookSumRaw);

    // AI pack payment
    // order_id format: aipack_<hash>_<pack>_<timestamp> — hash is not reversible,
    // so we look up the user by customer_email from the webhook body.
    if (typeof order_id === 'string' && order_id.startsWith('aipack_')) {
      const parts = order_id.split('_');
      const pack = parseInt(parts[2], 10);
      const ALLOWED_PACKS = [10, 50];
      const AI_PACK_PRICES: Record<number, number> = { 10: 99, 50: 399 };

      if (isNaN(pack) || !ALLOWED_PACKS.includes(pack)) {
        logger.warn('Invalid aipack order_id:', order_id);
        await markPaymentEventProcessed(providerEventId, 'ignored_invalid_aipack_order');
        res.status(200).send('OK');
        return;
      }

      const customerEmail: string | undefined = req.body.customer_email || req.body.customer_phone_email;
      const targetUser = customerEmail
        ? await prisma.user.findUnique({ where: { email: customerEmail } })
        : null;
      if (!targetUser) {
        logger.warn('Aipack user not found by email', { orderId: order_id, email: customerEmail });
        await markPaymentEventProcessed(providerEventId, 'ignored_unknown_user');
        res.status(200).send('OK');
        return;
      }

      const expectedAiPrice = AI_PACK_PRICES[pack];
      if (expectedAiPrice && webhookSum > 0 && webhookSum !== expectedAiPrice) {
        logger.warn('Webhook AI pack amount mismatch', {
          orderId: order_id, expected: expectedAiPrice, received: webhookSum,
        });
        await markPaymentEventProcessed(providerEventId, 'ignored_amount_mismatch');
        res.status(200).send('OK');
        return;
      }

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { aiCredits: { increment: pack } },
      });

      await markPaymentEventProcessed(providerEventId);
      logger.info(`AI credits +${pack} for user ${targetUser.id}`);
      res.status(200).send('OK');
      return;
    }

    // PRO subscription payment — find by order_id first, fallback to customer_email
    let subscription = await prisma.subscription.findUnique({
      where: { id: order_id },
      include: { user: true },
    });

    if (!subscription) {
      // Fallback: Prodamus may send its own payment_id as order_id instead of our CUID
      const webhookEmail: string | undefined = req.body.customer_email || req.body.customer_phone_email;
      if (webhookEmail) {
        const userByEmail = await prisma.user.findUnique({ where: { email: webhookEmail } });
        if (userByEmail) {
          subscription = await prisma.subscription.findUnique({
            where: { userId: userByEmail.id },
            include: { user: true },
          });
          if (subscription) {
            logger.info('Subscription found by email fallback', {
              orderId: order_id, email: webhookEmail, subscriptionId: subscription.id,
            });
          }
        }
      }
    }

    if (!subscription) {
      logger.warn('Subscription not found by order_id or email', { orderId: order_id, email: req.body.customer_email });
      await markPaymentEventProcessed(providerEventId, 'ignored_unknown_subscription');
      res.status(200).send('OK');
      return;
    }

    // Determine billing period from webhook amount (since create-payment no longer saves it pre-payment)
    const detectedPeriod: BillingPeriod = webhookSum > 0
      ? (VALID_PERIODS.find(p => BILLING_PERIODS[p].total === webhookSum) ?? 1)
      : ((subscription.billingPeriod || 1) as BillingPeriod);
    const periodInfo = BILLING_PERIODS[detectedPeriod];

    if (webhookSum > 0 && !VALID_PERIODS.find(p => BILLING_PERIODS[p].total === webhookSum)) {
      logger.warn('Webhook PRO amount does not match any period', {
        orderId: order_id, received: webhookSum, detectedPeriod,
      });
    }

    const now = new Date();
    // For re-subscriptions: extend from current period end if still active, don't lose remaining days
    const base = subscription.status === 'ACTIVE' && subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
      ? subscription.currentPeriodEnd : now;
    const periodEnd = new Date(base);
    periodEnd.setMonth(periodEnd.getMonth() + periodInfo.months);
    const normalizedPrice = ensureProPrice(periodInfo.pricePerMonth);

    // Store Prodamus subscription ID if present (for autopayment management)
    const prodSubId = subData?.id ? String(subData.id) : undefined;

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          cancelledAt: null,
          prodamusOrderId: req.body.payment_id || order_id,
          ...(prodSubId ? { prodamusSubscriptionId: prodSubId } : {}),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          priceRub: normalizedPrice,
          billingPeriod: detectedPeriod,
        },
      }),
      prisma.user.update({
        where: { id: subscription.userId },
        data: {
          plan: 'PRO',
          storageLimit: BigInt(config.pro.maxTotalStorage),
        },
      }),
    ]);

    await sendEmailOnce({
      dedupeKey: `pro_upgrade:payment:${providerEventId}`,
      eventType: 'pro_upgrade',
      recipientEmail: subscription.user.email,
      userId: subscription.userId,
      category: 'billing',
      payload: { subscriptionId: subscription.id, providerEventId },
    }, () => sendProUpgradeEmail(subscription.user.email, subscription.user.displayName || subscription.user.email.split('@')[0])).catch((err) => {
      logger.warn('PRO upgrade email send failed', {
        userId: subscription.userId,
        providerEventId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    await markPaymentEventProcessed(providerEventId);

    logger.info(`User ${subscription.userId} upgraded to PRO, period ends ${periodEnd.toISOString()}`);
    res.status(200).send('OK');
  } catch (err) {
    if (providerEventId) {
      try {
        await markPaymentEventFailed(providerEventId, err);
      } catch (markErr) {
        logger.warn('Failed to mark payment event as FAILED', {
          providerEventId,
          error: markErr instanceof Error ? markErr.message : String(markErr),
        });
      }
    }
    logger.error('Webhook error:', err);
    res.status(200).send('OK'); // Always 200 to prevent provider retries storm
  }
}

// NOTE: Webhook is mounted publicly via webhookRouter (see create-app.ts).
// Do NOT add router.post('/webhook', ...) here — this router sits behind authMiddleware
// and Prodamus cannot authenticate. The line was removed to avoid confusion.

// Cancel subscription
router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId },
      include: { user: { select: { email: true } } },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Нет активной подписки' });
      return;
    }

    // Deactivate autopayment in Prodamus if subscription ID is known
    if (subscription.prodamusSubscriptionId && config.prodamus.payformUrl && config.prodamus.secretKey) {
      const deactivateData: Record<string, string> = {
        subscription: subscription.prodamusSubscriptionId,
        customer_email: subscription.user.email,
        active_user: '0',
      };
      const sig = createSignature(deactivateData, config.prodamus.secretKey);
      const bodyStr = new URLSearchParams({ ...deactivateData, signature: sig }).toString();
      const apiBase = config.prodamus.payformUrl.replace(/\/$/, '');
      const setActivityUrl = `${apiBase}/rest/setActivity/`;

      const callSetActivity = async (): Promise<{ ok: boolean; status: number; body: string }> => {
        const resp = await fetch(setActivityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyStr,
          signal: AbortSignal.timeout(10000),
        });
        const respBody = await resp.text();
        return { ok: resp.ok, status: resp.status, body: respBody };
      };

      try {
        let result = await callSetActivity();

        if (!result.ok) {
          logger.warn('Prodamus setActivity failed, retrying in 2s', {
            subscriptionId: subscription.prodamusSubscriptionId,
            status: result.status,
            body: result.body,
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          result = await callSetActivity();
        }

        if (result.ok) {
          logger.info('Prodamus subscription deactivated successfully', {
            subscriptionId: subscription.prodamusSubscriptionId,
            status: result.status,
            body: result.body,
          });
        } else {
          logger.error('CRITICAL: Prodamus setActivity failed after retry — autopayments may continue', {
            subscriptionId: subscription.prodamusSubscriptionId,
            status: result.status,
            body: result.body,
            userId: req.userId,
          });
        }
      } catch (apiErr) {
        // Network/timeout error — retry once
        logger.warn('Prodamus setActivity network error, retrying in 2s', {
          subscriptionId: subscription.prodamusSubscriptionId,
          error: apiErr instanceof Error ? apiErr.message : String(apiErr),
        });
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryResult = await callSetActivity();
          if (retryResult.ok) {
            logger.info('Prodamus subscription deactivated successfully (after retry)', {
              subscriptionId: subscription.prodamusSubscriptionId,
              status: retryResult.status,
              body: retryResult.body,
            });
          } else {
            logger.error('CRITICAL: Prodamus setActivity failed after retry — autopayments may continue', {
              subscriptionId: subscription.prodamusSubscriptionId,
              status: retryResult.status,
              body: retryResult.body,
              userId: req.userId,
            });
          }
        } catch (retryErr) {
          logger.error('CRITICAL: Prodamus setActivity failed after retry (network error) — autopayments may continue', {
            subscriptionId: subscription.prodamusSubscriptionId,
            error: retryErr instanceof Error ? retryErr.message : String(retryErr),
            userId: req.userId,
          });
        }
      }
    }

    const cancelledAt = new Date();
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt },
    });

    if (subscription.user) {
      const user = subscription.user;
      sendEmailOnce({
        dedupeKey: `sub_cancelled:sub:${subscription.id}:at:${cancelledAt.toISOString().slice(0, 10)}`,
        eventType: 'subscription_cancelled',
        recipientEmail: user.email,
        userId: req.userId,
        category: 'billing',
        payload: { subscriptionId: subscription.id, cancelledAt },
      }, () => sendSubscriptionCancelledEmail(user.email, updatedSubscription.currentPeriodEnd)).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Подписка отменена. PRO доступен до конца оплаченного периода.',
      currentPeriodEnd: updatedSubscription.currentPeriodEnd,
    });
  } catch (err) {
    logger.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Separate webhook router for public mount (no auth required)
const webhookRouter = Router();
webhookRouter.post('/', handleWebhook);

export default router;
export { webhookRouter };
