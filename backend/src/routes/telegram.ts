import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import crypto from 'crypto';
import logger from '../services/logger';

const router = Router();

// GET /api/telegram/status — check if Telegram is linked
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.telegramLink.findUnique({
      where: { userId: req.userId! },
      select: { chatId: true, username: true, linkedAt: true },
    });

    if (!link || !link.chatId) {
      res.json({ linked: false });
      return;
    }

    res.json({
      linked: true,
      username: link.username,
      linkedAt: link.linkedAt,
    });
  } catch (err) {
    logger.error('Telegram status error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/telegram/generate-link — create or refresh deep link code
router.post('/generate-link', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const linkCode = 'VH_' + crypto.randomBytes(12).toString('base64url');

    // Upsert: create or update the link record (reset chatId to allow re-linking)
    await prisma.telegramLink.upsert({
      where: { userId },
      create: {
        userId,
        linkCode,
        chatId: '', // empty until user clicks link in Telegram
      },
      update: {
        linkCode,
        chatId: '', // reset for re-linking
        username: null,
      },
    });

    const botUsername = config.telegram.botUsername;
    const deepLink = `https://t.me/${botUsername}?start=${linkCode}`;

    res.json({ deepLink, linkCode });
  } catch (err) {
    logger.error('Generate telegram link error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/telegram/unlink — disconnect Telegram
router.delete('/unlink', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.telegramLink.deleteMany({
      where: { userId: req.userId! },
    });

    res.json({ success: true, message: 'Telegram отвязан' });
  } catch (err) {
    logger.error('Telegram unlink error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/telegram/submissions — recent form submissions for user's projects
router.get('/submissions', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where: { project: { userId: req.userId! } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: { select: { slug: true, title: true } },
        },
      }),
      prisma.formSubmission.count({
        where: { project: { userId: req.userId! } },
      }),
    ]);

    res.json({
      submissions,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (err) {
    logger.error('Submissions list error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
