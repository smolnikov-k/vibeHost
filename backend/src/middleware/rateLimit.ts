import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';
import logger from '../services/logger';

// Redis client for rate limiting (shared across all limiters)
let redisStore: RedisStore | undefined;

try {
  const redisClient = createClient({ url: config.redisUrl });
  redisClient.connect().catch(err => {
    logger.warn('Redis rate-limit connect failed, falling back to in-memory', { error: err.message });
  });
  redisClient.on('error', () => { /* suppress — fallback to in-memory */ });

  redisStore = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  });
} catch {
  logger.warn('Redis not available for rate limiting, using in-memory store');
}

const storeOption = redisStore ? { store: redisStore } : {};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  ...storeOption,
});

export const deployLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Лимит деплоев: 5 в час. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  ...storeOption,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 100,
  message: { error: 'Слишком много запросов.' },
  standardHeaders: true,
  legacyHeaders: false,
  ...storeOption,
});
