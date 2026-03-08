import { prisma } from '../lib/prisma';
import { config } from '../config';
import { deleteProjectFiles } from './deploy.service';
import {
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
  sendProjectExpiringEmail,
  sendProjectSuspendedEmail,
} from './email.service';
import logger from './logger';

const INTERVAL_MS = 15 * 60 * 1000; // 15 минут

// Track which emails we already sent this run cycle (avoid duplicates across 15-min ticks)
const sentEmails = new Map<string, number>();
const SENT_TTL = 24 * 60 * 60 * 1000; // 24h cooldown per email

function shouldSendEmail(key: string): boolean {
  const last = sentEmails.get(key);
  if (last && Date.now() - last < SENT_TTL) return false;
  sentEmails.set(key, Date.now());
  return true;
}

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of sentEmails) {
    if (now - time > SENT_TTL) sentEmails.delete(key);
  }
}, 60 * 60 * 1000);

async function runCleanup() {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ─── Subscription: expiring in 3 days ──────────────────────
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
      const emailKey = `sub-expiring:${sub.userId}`;
      if (shouldSendEmail(emailKey)) {
        sendSubscriptionExpiringEmail(sub.user.email, daysLeft, sub.currentPeriodEnd).catch(() => {});
        logger.info(`Cleanup: отправлено напоминание об истечении подписки для ${sub.userId} (${daysLeft} дн.)`);
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

      const emailKey = `sub-expired:${sub.userId}`;
      if (shouldSendEmail(emailKey)) {
        sendSubscriptionExpiredEmail(sub.user.email).catch(() => {});
      }

      logger.info(`Cleanup: пользователь ${sub.userId} переведён на FREE (подписка истекла ${sub.currentPeriodEnd?.toISOString()})`);
    }

    // ─── Projects: expiring in 3 days ──────────────────────────
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
      const emailKey = `proj-expiring:${project.id}`;
      if (shouldSendEmail(emailKey)) {
        sendProjectExpiringEmail(project.user.email, project.title, project.slug, daysLeft).catch(() => {});
        logger.info(`Cleanup: напоминание об истечении проекта ${project.slug} (${daysLeft} дн.)`);
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

      const emailKey = `proj-suspended:${project.id}`;
      if (shouldSendEmail(emailKey)) {
        sendProjectSuspendedEmail(project.user.email, project.title).catch(() => {});
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
  // Запустить сразу при старте
  void runCleanup();
  // И затем по интервалу
  setInterval(() => void runCleanup(), INTERVAL_MS);
}
