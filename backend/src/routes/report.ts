import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../services/logger';

const router = Router();

const VALID_REASONS = ['SPAM', 'MALWARE', 'PHISHING', 'ILLEGAL', 'COPYRIGHT', 'OTHER'] as const;

// POST /api/report — public (rate-limited, no auth required)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { slug, reason, message } = req.body;

    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ error: 'slug обязателен' });
      return;
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      res.status(400).json({ error: 'Некорректная причина жалобы' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '0.0.0.0';

    // Limit: max 3 reports per IP per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const recentCount = await prisma.report.count({
      where: { reporterIp: ip, createdAt: { gte: todayStart } },
    });
    if (recentCount >= 3) {
      res.status(429).json({ error: 'Вы уже отправили максимум жалоб на сегодня' });
      return;
    }

    await prisma.report.create({
      data: {
        projectId: project.id,
        reason: reason as typeof VALID_REASONS[number],
        message: typeof message === 'string' ? message.slice(0, 1000) : null,
        reporterIp: ip,
      },
    });

    logger.info('Report submitted', { slug, reason, ip });
    res.json({ success: true, message: 'Жалоба отправлена. Мы рассмотрим её в ближайшее время.' });
  } catch (err) {
    logger.error('Report error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
