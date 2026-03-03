import { Router, Response } from 'express';
import dns from 'dns';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../services/logger';

const router = Router();

// List user's domains
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      where: { userId: req.userId },
      include: { project: { select: { slug: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(domains);
  } catch (err) {
    logger.error('List domains error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Add domain
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { hostname, projectId } = req.body;

    if (!hostname || !projectId) {
      res.status(400).json({ error: 'Hostname и projectId обязательны' });
      return;
    }

    const hostnameClean = hostname.toLowerCase().trim();
    if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostnameClean)) {
      res.status(400).json({ error: 'Некорректный формат домена' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.plan !== 'PRO') {
      res.status(403).json({ error: 'Кастомные домены доступны только на плане PRO', code: 'PRO_REQUIRED' });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const existing = await prisma.domain.findUnique({ where: { hostname: hostnameClean } });
    if (existing) {
      res.status(409).json({ error: 'Этот домен уже зарегистрирован' });
      return;
    }

    const verifyToken = crypto.randomUUID();

    const domain = await prisma.domain.create({
      data: {
        hostname: hostnameClean,
        projectId,
        userId: req.userId!,
        verifyToken,
      },
    });

    res.status(201).json({
      ...domain,
      instructions: {
        cname: { type: 'CNAME', name: hostnameClean, value: 'hostingvibe.ru' },
        txt: { type: 'TXT', name: `_vibe-verify.${hostnameClean}`, value: verifyToken },
      },
    });
  } catch (err) {
    logger.error('Add domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Verify domain DNS
router.post('/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const domainId = req.params.id as string;
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, userId: req.userId },
    });
    if (!domain) {
      res.status(404).json({ error: 'Домен не найден' });
      return;
    }

    if (domain.verified) {
      res.json({ verified: true, message: 'Домен уже подтверждён' });
      return;
    }

    let verified = false;

    try {
      const cnames = await dns.promises.resolveCname(domain.hostname);
      if (cnames.some(c => c.includes('hostingvibe.ru'))) {
        verified = true;
      }
    } catch {
      // CNAME not found
    }

    if (!verified && domain.verifyToken) {
      try {
        const records = await dns.promises.resolveTxt(`_vibe-verify.${domain.hostname}`);
        const flat = records.map(r => r.join(''));
        if (flat.includes(domain.verifyToken)) {
          verified = true;
        }
      } catch {
        // TXT not found
      }
    }

    if (verified) {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { verified: true, verifiedAt: new Date() },
      });
      res.json({ verified: true, message: 'Домен подтверждён! SSL-сертификат будет выпущен.' });
    } else {
      res.json({
        verified: false,
        message: 'DNS-запись не найдена. Убедитесь, что CNAME или TXT запись настроена.',
      });
    }
  } catch (err) {
    logger.error('Verify domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete domain
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const domainId = req.params.id as string;
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, userId: req.userId },
    });
    if (!domain) {
      res.status(404).json({ error: 'Домен не найден' });
      return;
    }

    await prisma.domain.delete({ where: { id: domain.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
