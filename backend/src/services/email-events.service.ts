import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import logger from './logger';

type EmailCategory = 'transactional' | 'lifecycle' | 'marketing' | 'billing' | 'system';

type SendEmailOnceParams = {
  dedupeKey: string;
  eventType: string;
  recipientEmail: string;
  userId?: string;
  category?: EmailCategory;
  payload?: unknown;
};

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function payloadHash(payload?: unknown): string | undefined {
  if (payload === undefined || payload === null) return undefined;
  const encoded = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(encoded).digest('hex');
}

export async function sendEmailOnce(
  params: SendEmailOnceParams,
  sendFn: () => Promise<void>,
): Promise<{ sent: boolean; skipped: boolean }> {
  const category = params.category ?? 'transactional';
  const hash = payloadHash(params.payload);

  try {
    await prisma.emailEvent.create({
      data: {
        dedupeKey: params.dedupeKey,
        eventType: params.eventType,
        recipientEmail: params.recipientEmail,
        userId: params.userId,
        category,
        status: 'PENDING',
        payloadHash: hash,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.info('Email dedupe skip', {
        dedupeKey: params.dedupeKey,
        eventType: params.eventType,
        recipientEmail: params.recipientEmail,
      });
      return { sent: false, skipped: true };
    }
    throw err;
  }

  try {
    await sendFn();
    await prisma.emailEvent.update({
      where: { dedupeKey: params.dedupeKey },
      data: {
        status: 'SENT',
        attempts: { increment: 1 },
        sentAt: new Date(),
        lastError: null,
      },
    });
    return { sent: true, skipped: false };
  } catch (err) {
    await prisma.emailEvent.update({
      where: { dedupeKey: params.dedupeKey },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
      },
    });
    throw err;
  }
}

export async function hasRecentCategoryEmail(
  userId: string,
  categories: EmailCategory[],
  withinHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const count = await prisma.emailEvent.count({
    where: {
      userId,
      category: { in: categories },
      status: 'SENT',
      sentAt: { gte: since },
    },
  });
  return count > 0;
}

export async function canSendMarketingNow(userId: string): Promise<boolean> {
  // Quiet period: no more than one lifecycle/marketing message in 24h
  const recent = await hasRecentCategoryEmail(userId, ['lifecycle', 'marketing', 'billing'], 24);
  return !recent;
}
