import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateSlug } from '../utils/slug';
import logger from '../services/logger';

const router = Router();

router.get('/slugs/check', async (req: Request, res: Response) => {
  try {
    const slug = (req.query.slug as string || '').toLowerCase();
    const slugError = validateSlug(slug);

    if (slugError) {
      res.json({ available: false, error: slugError });
      return;
    }

    const existing = await prisma.project.findUnique({ where: { slug } });
    res.json({ available: !existing });
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Slug check error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
