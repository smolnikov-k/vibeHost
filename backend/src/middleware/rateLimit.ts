import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';
import logger from '../services/logger';

export let redisClient: ReturnType<typeof createClient> | undefined;
export let redisReady = false;

try {
  redisClient = createClient({ url: config.redisUrl });
  redisClient.connect()
    .then(() => {
      redisReady = true;
      logger.info('Rate-limit Redis connected');
    })
    .catch((err) => {
      redisReady = false;
      logger.warn('Redis rate-limit connect failed, falling back to in-memory', { error: err.message });
    });

  redisClient.on('error', (err) => {
    redisReady = false;
    logger.warn('Redis rate-limit client error, using in-memory fallback', { error: err.message });
  });
} catch (err) {
  redisReady = false;
  logger.warn('Redis init failed for rate limiting, using in-memory', {
    error: err instanceof Error ? err.message : String(err),
  });
}

function buildStore(prefix: string): any | undefined {
  if (!redisClient || !redisReady) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix,
  });
}

function createLimiter(base: { prefix: string; [key: string]: any }) {
  const { prefix, ...opts } = base;
  const store = buildStore(prefix);
  return rateLimit({
    ...opts,
    ...(store ? { store } : {}),
    validate: { unsharedStore: false },
  });
}

// Per-endpoint auth limiters (replace old shared authLimiter)
export const loginLimiter = createLimiter({
  prefix: 'rl:login:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = createLimiter({
  prefix: 'rl:register:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { error: 'Слишком много попыток регистрации. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const siteGateLimiter = createLimiter({
  prefix: 'rl:site-gate:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deployLimiter = createLimiter({
  prefix: 'rl:deploy:',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Лимит деплоев: 5 в час. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = createLimiter({
  prefix: 'rl:api:',
  windowMs: 60 * 1000, // 1 min
  max: 100,
  message: { error: 'Слишком много запросов.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = createLimiter({
  prefix: 'rl:forgot-pw:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 3,
  message: { error: 'Слишком много запросов на сброс пароля. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resetPasswordLimiter = createLimiter({
  prefix: 'rl:reset-pw:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { error: 'Слишком много попыток сброса пароля. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verifyEmailLimiter = createLimiter({
  prefix: 'rl:verify-email:',
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Слишком много попыток подтверждения. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendVerificationLimiter = createLimiter({
  prefix: 'rl:resend-verify:',
  windowMs: 60 * 1000, // 1 min
  max: 1,
  message: { error: 'Можно отправить код повторно через 1 минуту.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const formSubmissionLimiter = createLimiter({
  prefix: 'rl:form:',
  windowMs: 60 * 1000, // 1 min
  max: 10,
  message: { error: 'Слишком много отправок формы. Попробуйте через минуту.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const likeLimiter = createLimiter({
  prefix: 'rl:like:',
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: { error: 'Слишком много лайков. Попробуйте через минуту.' },
  standardHeaders: true,
  legacyHeaders: false,
});
