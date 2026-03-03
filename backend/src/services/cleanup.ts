import { prisma } from '../lib/prisma';
import { config } from '../config';
import { deleteProjectFiles } from './deploy.service';
import logger from './logger';

const INTERVAL_MS = 15 * 60 * 1000; // 15 минут

async function runCleanup() {
  try {
    const now = new Date();

    // Найти просроченные подписки (ACTIVE, но период истёк)
    const expired = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lt: now },
      },
      include: { user: true },
    });

    if (expired.length === 0) return;

    logger.info(`Cleanup: найдено ${expired.length} просроченных подписок`);

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

      logger.info(`Cleanup: пользователь ${sub.userId} переведён на FREE (подписка истекла ${sub.currentPeriodEnd?.toISOString()})`);
    }

    // Очистка истёкших проектов (expiresAt < now)
    const expiredProjects = await prisma.project.findMany({
      where: {
        expiresAt: { lt: now },
        status: { not: 'SUSPENDED' },
      },
    });

    for (const project of expiredProjects) {
      deleteProjectFiles(project.slug);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'SUSPENDED' },
      });
      logger.info(`Cleanup: проект ${project.slug} приостановлен (истёк ${project.expiresAt?.toISOString()})`);
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
