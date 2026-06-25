import { prisma } from '../lib/prisma';
import { config } from '../config';
import {
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
} from './email.service';
import { sendEmailOnce } from './email-events.service';
import logger from './logger';

const INTERVAL_MS = 15 * 60 * 1000; // 15 минут

function dateKey(date: Date | null | undefined): string {
  if (!date) return 'none';
  return date.toISOString().slice(0, 10);
}

async function runCleanup() {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ─── Subscription: expiring in <=3 days ───────────────────
    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { gt: now, lte: threeDaysFromNow },
      },
      include: { user: true },
    });

    for (const sub of expiringSubs) {
      if (!sub.currentPeriodEnd) continue;
      // Skip expiring reminders for subscriptions with auto-payment — Prodamus will renew automatically
      if (sub.prodamusSubscriptionId) continue;
      const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const dedupeKey = `sub_expiring:sub:${sub.id}:period:${dateKey(sub.currentPeriodEnd)}:d${daysLeft}`;

      try {
        const result = await sendEmailOnce({
          dedupeKey,
          eventType: 'subscription_expiring',
          recipientEmail: sub.user.email,
          userId: sub.userId,
          category: 'billing',
          payload: { subId: sub.id, periodEnd: sub.currentPeriodEnd, daysLeft },
        }, () => sendSubscriptionExpiringEmail(sub.user.email, daysLeft, sub.currentPeriodEnd!));

        if (result.sent) {
          logger.info(`Cleanup: отправлено напоминание об истечении подписки для ${sub.userId} (${daysLeft} дн.)`);
        }
      } catch (err) {
        logger.warn('Cleanup: failed to send subscription-expiring email', {
          userId: sub.userId,
          subId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ─── Subscription: expired ACTIVE/CANCELLED → downgrade immediately ───
    const expiredImmediate = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'CANCELLED'] },
        currentPeriodEnd: { lt: now },
      },
      include: { user: true },
    });

    if (expiredImmediate.length > 0) {
      logger.info(`Cleanup: найдено ${expiredImmediate.length} просроченных подписок (ACTIVE/CANCELLED)`);
    }

    for (const sub of expiredImmediate) {
      // Skip auto-renew subscriptions — Prodamus will send a renewal webhook
      if (sub.prodamusSubscriptionId && sub.status === 'ACTIVE') continue;

      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        }),
        prisma.user.update({
          where: { id: sub.userId },
          data: {
            plan: 'FREE',
            storageLimit: BigInt(config.free.maxTotalStorage),
          },
        }),
      ]);

      const dedupeKey = `sub_expired:sub:${sub.id}:period:${dateKey(sub.currentPeriodEnd)}`;
      try {
        await sendEmailOnce({
          dedupeKey,
          eventType: 'subscription_expired',
          recipientEmail: sub.user.email,
          userId: sub.userId,
          category: 'billing',
          payload: { subId: sub.id, periodEnd: sub.currentPeriodEnd },
        }, () => sendSubscriptionExpiredEmail(sub.user.email));
      } catch (err) {
        logger.warn('Cleanup: failed to send subscription-expired email', {
          userId: sub.userId,
          subId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info(`Cleanup: пользователь ${sub.userId} переведён на FREE (подписка истекла ${sub.currentPeriodEnd?.toISOString()})`);
    }

    // ─── Subscription: expired PAST_DUE → downgrade after 3-day grace period ───
    const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
    const graceDeadline = new Date(now.getTime() - gracePeriodMs);

    const expiredPastDue = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: { lt: graceDeadline },
      },
      include: { user: true },
    });

    if (expiredPastDue.length > 0) {
      logger.info(`Cleanup: найдено ${expiredPastDue.length} просроченных PAST_DUE подписок (grace period истёк)`);
    }

    for (const sub of expiredPastDue) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELLED' },
        }),
        ...(sub.user.plan !== 'FREE' ? [
          prisma.user.update({
            where: { id: sub.userId },
            data: {
              plan: 'FREE',
              storageLimit: BigInt(config.free.maxTotalStorage),
            },
          }),
        ] : []),
      ]);

      const dedupeKey = `sub_expired_grace:sub:${sub.id}:period:${dateKey(sub.currentPeriodEnd)}`;
      try {
        await sendEmailOnce({
          dedupeKey,
          eventType: 'subscription_expired',
          recipientEmail: sub.user.email,
          userId: sub.userId,
          category: 'billing',
          payload: { subId: sub.id, periodEnd: sub.currentPeriodEnd, graceExpired: true },
        }, () => sendSubscriptionExpiredEmail(sub.user.email));
      } catch (err) {
        logger.warn('Cleanup: failed to send grace-expired email', {
          userId: sub.userId,
          subId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info(`Cleanup: пользователь ${sub.userId} переведён на FREE после grace period (подписка истекла ${sub.currentPeriodEnd?.toISOString()})`);
    }

    // ─── Page views: delete older than 90 days ─────────────────
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedViews = await prisma.pageView.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    if (deletedViews.count > 0) {
      logger.info(`Cleanup: удалено ${deletedViews.count} page_views старше 90 дней`);
    }
  } catch (err) {
    logger.error('Cleanup worker error:', err);
  }
}

export function runCleanupWorker() {
  logger.info('Cleanup worker запущен (интервал 15 мин)');
  void runCleanup();
  setInterval(() => void runCleanup(), INTERVAL_MS);
}
