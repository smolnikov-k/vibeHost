import 'dotenv/config';
import { config } from './config';
import { runCleanupWorker } from './services/cleanup';
import { runEngagementWorker } from './services/engagement-worker';
import { initTelegramBot } from './services/telegram.service';
import logger from './services/logger';
import { createApp } from './app/create-app';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`Backend started on port ${config.port}`);
  runCleanupWorker();
  runEngagementWorker();
  initTelegramBot();
});
