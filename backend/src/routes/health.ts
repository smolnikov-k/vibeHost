import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { verifySmtpConnection } from '../services/email.service';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    const stat = await import('fs').then(fs => fs.statSync(config.sitesDir));
    checks.storage = stat.isDirectory() ? 'ok' : 'error';
  } catch {
    checks.storage = 'error';
  }

  checks.smtp = await verifySmtpConnection() ? 'ok' : 'not_configured';

  const status = Object.values(checks).every(value => value === 'ok' || value === 'not_configured')
    ? 'ok'
    : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service: 'vibe-hosting',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
