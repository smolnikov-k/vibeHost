import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { sendProUpgradeEmail, sendSubscriptionCancelledEmail } from '../services/email.service';
import { sendEmailOnce } from '../services/email-events.service';
import logger from '../services/logger';

const PRO_PRICE_RUB = 386;
const PAYMENT_PROVIDER = 'prodamus';
const PROCESSING_STALE_MS = 10 * 60 * 1000;
const ensureProPrice = (price?: number | null) => (price && price > 0 ? price : PRO_PRICE_RUB);

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
      subscription: subscription ? {
        status: subscription.status,
        priceRub: subscription.priceRub,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
      } : null,
    });
  } catch (err) {
    logger.error('Billing status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create payment link (PRO subscription)
router.post('/create-payment', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    if (!config.prodamus.payformUrl) {
      res.status(503).json({ error: 'Платёжная система не настроена' });
      return;
    }

    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'INACTIVE',
        priceRub: PRO_PRICE_RUB,
      },
      update: {
        priceRub: PRO_PRICE_RUB,
      },
    });

    const params = new URLSearchParams({
      do: 'link',
      'products[0][name]': 'Vibe Hosting PRO — 1 месяц',
      'products[0][price]': String(PRO_PRICE_RUB),
      'products[0][quantity]': '1',
      customer_email: user.email,
      order_id: subscription.id,
      urlSuccess: `${config.frontendUrl}/billing/success`,
      urlNotification: `${config.frontendUrl}/api/billing/webhook`,
      sys: config.prodamus.systemCode,
    });

    const paymentUrl = `${config.prodamus.payformUrl}?${params.toString()}`;

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
    const orderId = `aipack_${user.id}_${pack}_${Date.now()}`;

    const params = new URLSearchParams({
      do: 'link',
      'products[0][name]': `Vibe Hosting AI-запросы — ${pack} шт.`,
      'products[0][price]': price,
      'products[0][quantity]': '1',
      customer_email: user.email,
      order_id: orderId,
      urlSuccess: `${config.frontendUrl}/billing/success`,
      urlNotification: `${config.frontendUrl}/api/billing/webhook`,
      sys: config.prodamus.systemCode,
    });

    const paymentUrl = `${config.prodamus.payformUrl}?${params.toString()}`;
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
    if (!config.prodamus.secretKey) {
      logger.error('Prodamus secret key not configured, rejecting webhook');
      res.status(503).json({ error: 'Webhook not configured' });
      return;
    }

    const signature = req.headers['sign'] as string || req.headers['x-signature'] as string;
    if (!signature) {
      logger.warn('Webhook missing signature header');
      res.status(403).json({ error: 'Missing signature' });
      return;
    }

    const body = (req as any).rawBody?.toString() || JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', config.prodamus.secretKey).update(body).digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        logger.warn('Webhook signature mismatch');
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }
    } catch {
      logger.warn('Webhook signature format invalid');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const { order_id, payment_status, payment_id } = req.body;

    if (!order_id || payment_status !== 'success') {
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

    // AI pack payment
    if (typeof order_id === 'string' && order_id.startsWith('aipack_')) {
      const parts = order_id.split('_');
      const userId = parts[1];
      const pack = parseInt(parts[2], 10);
      const ALLOWED_PACKS = [10, 50];

      if (!userId || isNaN(pack) || !ALLOWED_PACKS.includes(pack)) {
        logger.warn('Invalid aipack order_id:', order_id);
        await markPaymentEventProcessed(providerEventId, 'ignored_invalid_aipack_order');
        res.status(200).send('OK');
        return;
      }

      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        logger.warn('Aipack for non-existent user:', userId);
        await markPaymentEventProcessed(providerEventId, 'ignored_unknown_user');
        res.status(200).send('OK');
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { aiCredits: { increment: pack } },
      });

      await markPaymentEventProcessed(providerEventId);
      logger.info(`AI credits +${pack} for user ${userId}`);
      res.status(200).send('OK');
      return;
    }

    // PRO subscription payment
    const subscription = await prisma.subscription.findUnique({
      where: { id: order_id },
      include: { user: true },
    });

    if (!subscription) {
      await markPaymentEventProcessed(providerEventId, 'ignored_unknown_subscription');
      res.status(200).send('OK');
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const normalizedPrice = ensureProPrice(subscription.priceRub);

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          prodamusOrderId: req.body.payment_id || order_id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          priceRub: normalizedPrice,
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

router.post('/webhook', handleWebhook);

// Cancel subscription
router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Нет активной подписки' });
      return;
    }

    const cancelledAt = new Date();
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    if (user) {
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
