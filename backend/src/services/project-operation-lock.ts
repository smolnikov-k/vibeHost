import { redis } from '../lib/redis';
import logger from './logger';

export interface ProjectOperationLock {
  acquired: boolean;
  release: () => Promise<void>;
}

/**
 * Redis-based distributed lock for project operations.
 * Prevents concurrent deploys even across multiple PM2 workers.
 * Lock auto-expires after 300s as a safety net.
 */
export async function acquireProjectOperationLock(projectId: string): Promise<ProjectOperationLock> {
  const key = `project-lock:${projectId}`;
  try {
    const result = await redis.set(key, '1', { NX: true, EX: 300 });
    if (result !== 'OK') {
      return { acquired: false, release: async () => {} };
    }
    return {
      acquired: true,
      release: async () => {
        try {
          await redis.del(key);
        } catch (err) {
          logger.warn('Failed to release project lock', { projectId, error: String(err) });
        }
      },
    };
  } catch (err) {
    // Redis down — block operation to prevent concurrent deploys / data corruption
    logger.error('Redis lock unavailable, blocking operation', { projectId, error: String(err) });
    return { acquired: false, release: async () => {} };
  }
}
