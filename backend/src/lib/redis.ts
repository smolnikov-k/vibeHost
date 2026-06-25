import { createClient } from 'redis';
import { config } from '../config';
import logger from '../services/logger';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  logger.warn('Redis client error', { error: err instanceof Error ? err.message : String(err) });
});

redis.connect().catch((err) => {
  logger.error('Redis connect failed', { error: err instanceof Error ? err.message : String(err) });
});
