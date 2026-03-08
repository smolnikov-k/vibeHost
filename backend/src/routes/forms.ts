import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { sendFormToTelegram } from '../services/telegram.service';
import logger from '../services/logger';
import crypto from 'crypto';

const router = Router();

// CORS middleware for form endpoints — only allow *.hostingvibe.ru and verified custom domains
async function formCors(req: Request, res: Response, next: NextFunction): Promise<void> {
  const origin = req.headers.origin;
  if (origin) {
    let allowed = false;
    try {
      const url = new URL(origin);
      if (url.hostname === 'hostingvibe.ru' || url.hostname.endsWith('.hostingvibe.ru')) {
        allowed = true;
      } else {
        // Check verified custom domains
        const domain = await prisma.domain.findFirst({
          where: { hostname: url.hostname, verified: true },
        });
        if (domain) allowed = true;
      }
    } catch { /* invalid origin URL */ }

    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    }
  }
  if ((req as unknown as { method: string }).method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  next();
}
router.use('/:slug', formCors);

// POST /api/forms/:slug — receive form data and send to Telegram
router.post('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        userId: true,
        status: true,
        domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 },
        user: {
          select: {
            telegramLink: {
              select: { chatId: true },
            },
          },
        },
      },
    });

    if (!project || project.status !== 'LIVE') {
      res.status(404).json({ error: 'Сайт не найден' });
      return;
    }

    // Extract form name from internal field
    const formName: string | null = req.body._vibe_form_name
      ? String(req.body._vibe_form_name).substring(0, 100)
      : null;

    // Collect form fields from body (supports JSON and urlencoded)
    // Limit: max 20 fields, max 2048 chars per value
    const formData: Record<string, string> = {};
    let fieldCount = 0;
    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('_vibe_')) continue; // skip internal fields
      if (++fieldCount > 20) break;
      formData[key.slice(0, 100)] = String(value).slice(0, 2048);
    }

    if (Object.keys(formData).length === 0) {
      res.status(400).json({ error: 'Пустая форма' });
      return;
    }

    // Hash IP for privacy
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '';
    const hashedIp = crypto.createHash('sha256')
      .update(ip + new Date().toISOString().slice(0, 10))
      .digest('hex')
      .slice(0, 16);

    // Save submission + send to Telegram
    const chatId = project.user.telegramLink?.chatId;
    const customDomain = project.domains[0]?.hostname ?? null;
    const sentToTg = chatId ? await sendFormToTelegram(chatId, project.slug, formData, formName, customDomain) : false;

    await prisma.formSubmission.create({
      data: {
        projectId: project.id,
        formName,
        data: formData,
        ip: hashedIp,
        sentToTg,
      },
    });

    // Redirect for regular form submits (non-AJAX)
    // Only allow relative URLs or same subdomain to prevent open redirect
    const redirectUrl = req.body._vibe_redirect;
    if (redirectUrl && typeof redirectUrl === 'string' && !req.headers['x-requested-with']) {
      const isRelative = redirectUrl.startsWith('/') && !redirectUrl.startsWith('//');
      const isAllowedDomain = redirectUrl.startsWith(`https://${slug}.hostingvibe.ru`)
        || (customDomain && redirectUrl.startsWith(`https://${customDomain}`));
      if (isRelative || isAllowedDomain) {
        res.redirect(redirectUrl);
        return;
      }
    }

    res.json({
      success: true,
      message: 'Заявка отправлена',
      sentToTelegram: sentToTg,
    });
  } catch (err) {
    logger.error('Form submission error', { slug, error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
