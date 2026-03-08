import { prisma } from '../lib/prisma';
import {
  sendOnboardingReminderEmail,
  sendTipsEmail,
  sendWinBackEmail,
} from './email.service';
import { canSendMarketingNow, sendEmailOnce } from './email-events.service';
import logger from './logger';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

function dayKey(date: Date | null | undefined): string {
  if (!date) return 'none';
  return date.toISOString().slice(0, 10);
}

async function runEngagement() {
  try {
    const now = new Date();

    // ─── Day 3: no deploys → onboarding reminder ──────────────
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    const newUsersNoDeploy = await prisma.user.findMany({
      where: {
        createdAt: { gte: fourDaysAgo, lte: threeDaysAgo },
        emailOptOut: false,
        projects: { none: { status: 'LIVE' } },
      },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    for (const user of newUsersNoDeploy) {
      if (!(await canSendMarketingNow(user.id))) {
        logger.info(`Engagement: onboarding skipped by quiet-period → ${user.email}`);
        continue;
      }

      const name = user.displayName || user.email.split('@')[0];
      const dedupeKey = `eng_onboarding:user:${user.id}:created:${dayKey(user.createdAt)}`;

      try {
        const result = await sendEmailOnce({
          dedupeKey,
          eventType: 'eng_onboarding',
          recipientEmail: user.email,
          userId: user.id,
          category: 'marketing',
          payload: { userId: user.id, cohort: dayKey(user.createdAt) },
        }, () => sendOnboardingReminderEmail(user.email, name));

        if (result.sent) logger.info(`Engagement: onboarding reminder → ${user.email}`);
      } catch (err) {
        logger.warn('Engagement onboarding send failed', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ─── Day 7: has deploy → tips ─────────────────────────────
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const usersWithDeploy = await prisma.user.findMany({
      where: {
        createdAt: { gte: eightDaysAgo, lte: sevenDaysAgo },
        emailOptOut: false,
        projects: { some: { status: 'LIVE' } },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        projects: {
          where: { status: 'LIVE' },
          select: { slug: true },
          take: 1,
        },
      },
    });

    for (const user of usersWithDeploy) {
      if (user.projects.length === 0) continue;
      if (!(await canSendMarketingNow(user.id))) {
        logger.info(`Engagement: tips skipped by quiet-period → ${user.email}`);
        continue;
      }

      const name = user.displayName || user.email.split('@')[0];
      const dedupeKey = `eng_tips:user:${user.id}:created:${dayKey(user.createdAt)}`;

      try {
        const result = await sendEmailOnce({
          dedupeKey,
          eventType: 'eng_tips',
          recipientEmail: user.email,
          userId: user.id,
          category: 'marketing',
          payload: { userId: user.id, cohort: dayKey(user.createdAt), slug: user.projects[0].slug },
        }, () => sendTipsEmail(user.email, name, user.projects[0].slug));

        if (result.sent) logger.info(`Engagement: tips email → ${user.email}`);
      } catch (err) {
        logger.warn('Engagement tips send failed', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ─── Day 30: inactive → win-back ──────────────────────────
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    const inactiveUsers = await prisma.user.findMany({
      where: {
        emailOptOut: false,
        OR: [
          { lastActiveAt: { gte: thirtyOneDaysAgo, lte: thirtyDaysAgo } },
          { lastActiveAt: null, createdAt: { gte: thirtyOneDaysAgo, lte: thirtyDaysAgo } },
        ],
      },
      select: { id: true, email: true, displayName: true, createdAt: true, lastActiveAt: true },
    });

    for (const user of inactiveUsers) {
      if (!(await canSendMarketingNow(user.id))) {
        logger.info(`Engagement: winback skipped by quiet-period → ${user.email}`);
        continue;
      }

      const name = user.displayName || user.email.split('@')[0];
      const inactivityAnchor = dayKey(user.lastActiveAt || user.createdAt);
      const dedupeKey = `eng_winback:user:${user.id}:anchor:${inactivityAnchor}`;

      try {
        const result = await sendEmailOnce({
          dedupeKey,
          eventType: 'eng_winback',
          recipientEmail: user.email,
          userId: user.id,
          category: 'marketing',
          payload: { userId: user.id, inactivityAnchor },
        }, () => sendWinBackEmail(user.email, name));

        if (result.sent) logger.info(`Engagement: win-back → ${user.email}`);
      } catch (err) {
        logger.warn('Engagement winback send failed', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error('Engagement worker error:', err);
  }
}

export function runEngagementWorker() {
  logger.info('Engagement worker запущен (интервал 6 ч)');
  // First run after 5 minutes (let server warm up)
  setTimeout(() => void runEngagement(), 5 * 60 * 1000);
  setInterval(() => void runEngagement(), INTERVAL_MS);
}
