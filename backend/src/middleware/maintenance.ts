import { Request, Response, NextFunction } from 'express';
import { redisClient, redisReady } from './rateLimit';
import logger from '../services/logger';

const MAINTENANCE_KEY = 'vibe:maintenance';
const SKIP_PREFIXES = ['/api/admin', '/api/health', '/api/billing/webhook', '/api/internal/preview'];

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!redisClient || !redisReady) {
    return next();
  }

  // Skip maintenance check for whitelisted paths
  for (const prefix of SKIP_PREFIXES) {
    if (req.path.startsWith(prefix)) {
      return next();
    }
  }

  try {
    const value = await redisClient.get(MAINTENANCE_KEY);
    if (value) {
      res.status(503).json({ error: 'Сервис на техническом обслуживании', maintenance: true });
      return;
    }
  } catch (err) {
    logger.warn('Maintenance check failed, skipping (fail-open)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  next();
}

export { MAINTENANCE_KEY };
