import { Router, Request, Response } from 'express';
import { trackPageView, getProjectAnalytics } from '../services/analytics.service';
import { prisma } from '../lib/prisma';
import logger from '../services/logger';

// Public: pixel tracking (no auth required)
const publicTrackRouter = Router();

publicTrackRouter.post('/track', async (req: Request, res: Response) => {
  try {
    const { slug, path } = req.body;
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ error: 'slug is required' });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '0.0.0.0';

    const tracked = await trackPageView({
      slug,
      path: typeof path === 'string' ? path : '/',
      ip,
      userAgent: req.headers['user-agent'],
      referrer: typeof req.body.referrer === 'string' ? req.body.referrer : undefined,
    });

    res.json({ ok: tracked });
  } catch (err) {
    logger.error('Track endpoint error', { error: (err as Error).message });
    res.json({ ok: false });
  }
});

// Protected: project analytics (requires auth, mounted after authMiddleware)
const analyticsRouter = Router();

analyticsRouter.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
    const analytics = await getProjectAnalytics(project.id, days);
    res.json(analytics);
  } catch (err) {
    logger.error('Analytics fetch error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default analyticsRouter;
export { publicTrackRouter };
