import { prisma } from '../lib/prisma';
import {
  sendOnboardingReminderEmail,
  sendTipsEmail,
  sendWinBackEmail,
} from './email.service';
import logger from './logger';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

// Track sent emails to avoid duplicates (key → timestamp)
const sentEmails = new Map<string, number>();
const COOLDOWN_DAYS: Record<string, number> = {
  onboarding: 7,  // don't resend onboarding for 7 days
  tips: 14,       // don't resend tips for 14 days
  winback: 30,    // don't resend win-back for 30 days
};

function shouldSend(type: string, userId: string): boolean {
  const key = `${type}:${userId}`;
  const last = sentEmails.get(key);
  const cooldown = (COOLDOWN_DAYS[type] || 7) * 24 * 60 * 60 * 1000;
  if (last && Date.now() - last < cooldown) return false;
  sentEmails.set(key, Date.now());
  return true;
}

// Cleanup old entries daily
setInterval(() => {
  const now = Date.now();
  const maxCooldown = 30 * 24 * 60 * 60 * 1000;
  for (const [key, time] of sentEmails) {
    if (now - time > maxCooldown) sentEmails.delete(key);
  }
}, 24 * 60 * 60 * 1000);

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
      select: { id: true, email: true, displayName: true },
    });

    for (const user of newUsersNoDeploy) {
      if (shouldSend('onboarding', user.id)) {
        const name = user.displayName || user.email.split('@')[0];
        sendOnboardingReminderEmail(user.email, name).catch(() => {});
        logger.info(`Engagement: onboarding reminder → ${user.email}`);
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
        projects: {
          where: { status: 'LIVE' },
          select: { slug: true },
          take: 1,
        },
      },
    });

    for (const user of usersWithDeploy) {
      if (user.projects.length > 0 && shouldSend('tips', user.id)) {
        const name = user.displayName || user.email.split('@')[0];
        sendTipsEmail(user.email, name, user.projects[0].slug).catch(() => {});
        logger.info(`Engagement: tips email → ${user.email}`);
      }
    }

    // ─── Day 30: inactive → win-back ──────────────────────────
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    const inactiveUsers = await prisma.user.findMany({
      where: {
        emailOptOut: false,
        OR: [
          // lastActiveAt is 30+ days ago
          { lastActiveAt: { gte: thirtyOneDaysAgo, lte: thirtyDaysAgo } },
          // Never had lastActiveAt, but created 30 days ago
          { lastActiveAt: null, createdAt: { gte: thirtyOneDaysAgo, lte: thirtyDaysAgo } },
        ],
      },
      select: { id: true, email: true, displayName: true },
    });

    for (const user of inactiveUsers) {
      if (shouldSend('winback', user.id)) {
        const name = user.displayName || user.email.split('@')[0];
        sendWinBackEmail(user.email, name).catch(() => {});
        logger.info(`Engagement: win-back → ${user.email}`);
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
