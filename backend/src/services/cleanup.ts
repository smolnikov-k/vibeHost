import { prisma } from '../lib/prisma';
import { config } from '../config';
import { deleteProjectFiles } from './deploy.service';
import {
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
  sendProjectExpiringEmail,
  sendProjectSuspendedEmail,
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

    // ─── Subscription: expired → downgrade ─────────────────────
    const expired = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lt: now },
      },
      include: { user: true },
    });

    if (expired.length > 0) {
      logger.info(`Cleanup: найдено ${expired.length} просроченных подписок`);
    }

    for (const sub of expired) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE' },
      });

      await prisma.user.update({
        where: { id: sub.userId },
        data: {
          plan: 'FREE',
          storageLimit: BigInt(config.free.maxTotalStorage),
        },
      });

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

    // ─── Projects: expiring in <=3 days ────────────────────────
    const expiringProjects = await prisma.project.findMany({
      where: {
        expiresAt: { gt: now, lte: threeDaysFromNow },
        status: { not: 'SUSPENDED' },
      },
      include: { user: true },
    });

    for (const project of expiringProjects) {
      if (!project.expiresAt) continue;
      const daysLeft = Math.ceil((project.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const dedupeKey = `project_expiring:project:${project.id}:expires:${dateKey(project.expiresAt)}:d${daysLeft}`;

      try {
        const result = await sendEmailOnce({
          dedupeKey,
          eventType: 'project_expiring',
          recipientEmail: project.user.email,
          userId: project.userId,
          category: 'lifecycle',
          payload: { projectId: project.id, expiresAt: project.expiresAt, daysLeft },
        }, () => sendProjectExpiringEmail(project.user.email, project.title, project.slug, daysLeft));

        if (result.sent) {
          logger.info(`Cleanup: напоминание об истечении проекта ${project.slug} (${daysLeft} дн.)`);
        }
      } catch (err) {
        logger.warn('Cleanup: failed to send project-expiring email', {
          projectId: project.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ─── Projects: expired → suspend ───────────────────────────
    const expiredProjects = await prisma.project.findMany({
      where: {
        expiresAt: { lt: now },
        status: { not: 'SUSPENDED' },
      },
      include: { user: true },
    });

    for (const project of expiredProjects) {
      deleteProjectFiles(project.slug);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'SUSPENDED' },
      });

      const dedupeKey = `project_suspended:project:${project.id}:expires:${dateKey(project.expiresAt)}`;
      try {
        await sendEmailOnce({
          dedupeKey,
          eventType: 'project_suspended',
          recipientEmail: project.user.email,
          userId: project.userId,
          category: 'lifecycle',
          payload: { projectId: project.id, expiresAt: project.expiresAt },
        }, () => sendProjectSuspendedEmail(project.user.email, project.title));
      } catch (err) {
        logger.warn('Cleanup: failed to send project-suspended email', {
          projectId: project.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info(`Cleanup: проект ${project.slug} приостановлен (истёк ${project.expiresAt?.toISOString()})`);
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
