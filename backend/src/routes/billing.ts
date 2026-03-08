import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from 'redis';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { sendProUpgradeEmail, sendSubscriptionCancelledEmail } from '../services/email.service';
import logger from '../services/logger';

// Redis client for webhook idempotency
let redisClient: ReturnType<typeof createClient> | null = null;
try {
  redisClient = createClient({ url: config.redisUrl });
  redisClient.connect().catch(() => { redisClient = null; });
  redisClient.on('error', () => {});
} catch { /* Redis unavailable — fallback to in-memory */ }

// In-memory fallback for idempotency when Redis is not available
const processedPayments = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  for (const [key, time] of processedPayments) {
    if (time < cutoff) processedPayments.delete(key);
  }
}, 60 * 60 * 1000);

async function isPaymentProcessed(paymentId: string): Promise<boolean> {
  if (redisClient?.isOpen) {
    const exists = await redisClient.get(`webhook:${paymentId}`);
    return !!exists;
  }
  return processedPayments.has(paymentId);
}

async function markPaymentProcessed(paymentId: string): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.set(`webhook:${paymentId}`, '1', { EX: 48 * 60 * 60 }); // 48h TTL
  }
  processedPayments.set(paymentId, Date.now());
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

    // Create or update subscription record
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'INACTIVE',
        priceRub: 386,
      },
      update: {},
    });

    // Build Prodamus payment link
    const params = new URLSearchParams({
      do: 'link',
      'products[0][name]': 'Vibe Hosting PRO — 1 месяц',
      'products[0][price]': '386',
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
  try {
    // Verify signature (mandatory)
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

    // Timing-safe comparison to prevent timing attacks
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

    // Universal idempotency: check payment_id via Redis (or in-memory fallback)
    if (payment_id) {
      const alreadyProcessed = await isPaymentProcessed(String(payment_id));
      if (alreadyProcessed) {
        logger.info(`Webhook duplicate skipped: payment_id=${payment_id}`);
        res.status(200).send('OK');
        return;
      }
    }

    // AI pack payment
    if (typeof order_id === 'string' && order_id.startsWith('aipack_')) {
      const parts = order_id.split('_');
      // aipack_{userId}_{pack}_{timestamp}
      const userId = parts[1];
      const pack = parseInt(parts[2], 10);
      const ALLOWED_PACKS = [10, 50];

      if (!userId || isNaN(pack) || !ALLOWED_PACKS.includes(pack)) {
        logger.warn('Invalid aipack order_id:', order_id);
        res.status(200).send('OK');
        return;
      }

      // Verify user exists before crediting
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        logger.warn('Aipack for non-existent user:', userId);
        res.status(200).send('OK');
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { aiCredits: { increment: pack } },
      });

      if (payment_id) await markPaymentProcessed(String(payment_id));
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
      res.status(200).send('OK');
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Atomic: update subscription + user plan in a single transaction
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          prodamusOrderId: req.body.payment_id || order_id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
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

    if (payment_id) await markPaymentProcessed(String(payment_id));

    // Send PRO upgrade email
    sendProUpgradeEmail(subscription.user.email, subscription.user.displayName || subscription.user.email.split('@')[0]).catch(() => {});

    logger.info(`User ${subscription.userId} upgraded to PRO, period ends ${periodEnd.toISOString()}`);
    res.status(200).send('OK');
  } catch (err) {
    logger.error('Webhook error:', err);
    res.status(200).send('OK'); // Always 200 to prevent retries
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

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // Send cancellation email
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    if (user) {
      sendSubscriptionCancelledEmail(user.email, subscription.currentPeriodEnd).catch(() => {});
    }

    res.json({
      success: true,
      message: 'Подписка отменена. PRO доступен до конца оплаченного периода.',
      currentPeriodEnd: subscription.currentPeriodEnd,
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
