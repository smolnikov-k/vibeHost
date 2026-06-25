import 'dotenv/config';
import { config } from './config';
import { runCleanupWorker } from './services/cleanup';
import { runEngagementWorker } from './services/engagement-worker';
import { cleanupStalePreviews } from './services/deploy.service';
import { initTelegramBot } from './services/telegram.service';
import logger from './services/logger';
import { createApp } from './app/create-app';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

const server = app.listen(+config.port, config.host, () => {
  logger.info(`Backend started on ${config.host}:${config.port}`);
  runCleanupWorker();
  runEngagementWorker();
  cleanupStalePreviews().catch(err => logger.warn('Startup preview cleanup failed', { error: String(err) }));
  setInterval(() => cleanupStalePreviews().catch(err => logger.warn('Scheduled preview cleanup failed', { error: String(err) })), 6 * 60 * 60 * 1000);
  initTelegramBot();
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
  });
  try { await prisma.$disconnect(); } catch {}
  try { await redis.quit(); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
