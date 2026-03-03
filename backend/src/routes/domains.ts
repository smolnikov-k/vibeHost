import { Router, Response } from 'express';
import dns from 'dns';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import logger from '../services/logger';
import { provisionDomain, deprovisionDomain } from '../services/domain-provision';

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
        a: { type: 'A', name: '@', value: config.serverIp },
        txt: { type: 'TXT', name: `_vibe-verify.${hostnameClean}`, value: verifyToken },
      },
    });
  } catch (err) {
    logger.error('Add domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Verify domain DNS + auto-provision SSL
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

    // If already active, no need to re-verify
    if (domain.verified && domain.sslStatus === 'ACTIVE') {
      res.json({ verified: true, sslStatus: 'ACTIVE', message: 'Домен активен' });
      return;
    }

    // DNS verification
    let dnsVerified = domain.verified;

    if (!dnsVerified) {
      // Check A record -> our server IP
      try {
        const addresses = await dns.promises.resolve4(domain.hostname);
        if (addresses.includes(config.serverIp)) {
          dnsVerified = true;
        }
      } catch { /* A record not found */ }

      // Check CNAME -> hostingvibe.ru
      if (!dnsVerified) {
        try {
          const cnames = await dns.promises.resolveCname(domain.hostname);
          if (cnames.some(c => c.includes('hostingvibe.ru'))) {
            dnsVerified = true;
          }
        } catch { /* CNAME not found */ }
      }

      // Check TXT verify token
      if (!dnsVerified && domain.verifyToken) {
        try {
          const records = await dns.promises.resolveTxt(`_vibe-verify.${domain.hostname}`);
          const flat = records.map(r => r.join(''));
          if (flat.includes(domain.verifyToken)) {
            dnsVerified = true;
          }
        } catch { /* TXT not found */ }
      }

      if (dnsVerified) {
        await prisma.domain.update({
          where: { id: domain.id },
          data: { verified: true, verifiedAt: new Date() },
        });
      }
    }

    if (!dnsVerified) {
      res.json({
        verified: false,
        sslStatus: domain.sslStatus,
        message: `DNS-запись не найдена. Добавьте A-запись на ${config.serverIp}.`,
      });
      return;
    }

    // DNS verified — now provision SSL + Nginx
    if (domain.sslStatus !== 'ACTIVE') {
      const result = await provisionDomain(domain.id);

      if (result.success) {
        res.json({
          verified: true,
          sslStatus: 'ACTIVE',
          message: 'Домен подключён! SSL-сертификат выпущен, сайт доступен.',
        });
      } else {
        // Translate common certbot errors to user-friendly messages
        const rawError = result.error || '';
        let userMessage = 'Не удалось выпустить SSL-сертификат.';
        if (rawError.includes('NXDOMAIN') || rawError.includes('DNS problem')) {
          userMessage += ' DNS ещё не обновился — подождите 10–30 минут и попробуйте снова.';
        } else if (rawError.includes('too many certificates') || rawError.includes('rate limit')) {
          userMessage += ' Превышен лимит запросов к Let\'s Encrypt. Подождите 1 час и попробуйте снова.';
        } else if (rawError.includes('connection refused') || rawError.includes('timeout')) {
          userMessage += ' Сервер временно недоступен. Попробуйте через несколько минут.';
        } else if (rawError.includes('не указывает')) {
          userMessage += ` ${rawError}`;
        } else {
          userMessage += ' Нажмите «Повторить SSL» чтобы попробовать снова.';
        }
        res.json({
          verified: true,
          sslStatus: 'FAILED',
          message: userMessage,
        });
      }
    } else {
      res.json({ verified: true, sslStatus: 'ACTIVE', message: 'Домен активен' });
    }
  } catch (err) {
    logger.error('Verify domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete domain + cleanup Nginx/SSL
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

    // Remove Nginx config (including HTTP-only fallback configs for FAILED domains)
    await deprovisionDomain(domain.hostname);

    await prisma.domain.delete({ where: { id: domain.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete domain error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
