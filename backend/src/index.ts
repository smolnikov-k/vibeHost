import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { authMiddleware, adminMiddleware, optionalAuth } from './middleware/auth';
import { authLimiter, apiLimiter } from './middleware/rateLimit';
import { validateSlug } from './utils/slug';
import { prisma } from './lib/prisma';

import { verifySmtpConnection } from './services/email.service';
import { runCleanupWorker } from './services/cleanup';
import { runEngagementWorker } from './services/engagement-worker';
import { initTelegramBot } from './services/telegram.service';
import logger from './services/logger';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import deployRoutes from './routes/deploy';
import domainRoutes from './routes/domains';
import billingRoutes, { webhookRouter as billingWebhookRouter } from './routes/billing';
import galleryRoutes from './routes/gallery';
import adminRoutes from './routes/admin';
import analyticsRoutes, { publicTrackRouter } from './routes/analytics';
import reportRoutes from './routes/report';
import pixelRoutes from './routes/pixel';
import formsRoutes from './routes/forms';
import telegramRoutes from './routes/telegram';
import editRoutes, { publicPatchesRouter as publicPatchesRoutes } from './routes/edit';
import { siteAuthHandler, siteGateGet, siteGatePost } from './routes/site-gate';
const app = express();
app.set('trust proxy', 1); // behind Nginx

app.use(helmet({
  contentSecurityPolicy: false, // frontend handles CSP
  crossOriginEmbedderPolicy: false, // editor iframe preview
}));
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    // Allow configured origins + all *.hostingvibe.ru subdomains
    if (config.corsOrigins.includes(origin) || origin.endsWith('.hostingvibe.ru') || origin.endsWith('.hostingvibe.ru/')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Health check (DB + disk)
app.get('/api/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  try {
    const fs = await import('fs');
    const stat = fs.statSync(config.sitesDir);
    checks.storage = stat.isDirectory() ? 'ok' : 'error';
  } catch {
    checks.storage = 'error';
  }
  checks.smtp = await verifySmtpConnection() ? 'ok' : 'not_configured';
  const status = Object.values(checks).every(v => v === 'ok' || v === 'not_configured') ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service: 'vibe-hosting',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Public: check slug availability
app.get('/api/slugs/check', async (req: Request, res: Response) => {
  try {
    const slug = (req.query.slug as string || '').toLowerCase();
    const slugError = validateSlug(slug);
    if (slugError) {
      res.json({ available: false, error: slugError });
      return;
    }
    const existing = await prisma.project.findUnique({ where: { slug } });
    res.json({ available: !existing });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Public: analytics pixel + tracking
app.use('/api', pixelRoutes);
app.use('/api', apiLimiter, publicTrackRouter);

// Public: vibe-forms.js widget (no auth — loaded by user sites, including custom domains)
app.get('/api/vibe-forms.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '..', 'public', 'vibe-forms.js'));
});

// Public: form submissions (no auth — called from user sites)
app.use('/api/forms', apiLimiter, formsRoutes);

// Public: patches JSON (no auth — called from vibe-patches.js on user sites)
app.use('/api/patches', apiLimiter, publicPatchesRoutes);

// Public: serve vibe-editor-bridge.js
app.get('/api/vibe-editor-bridge.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, '..', 'public', 'vibe-editor-bridge.js'));
});

// Public: serve vibe-patches.js (loaded by user sites, including custom domains)
app.get('/api/vibe-patches.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '..', 'public', 'vibe-patches.js'));
});

// Public: report
app.use('/api/report', apiLimiter, reportRoutes);

// Public: gallery
app.use('/api/gallery', apiLimiter, galleryRoutes);

// Public: unsubscribe from marketing emails
app.get('/api/unsubscribe', apiLimiter, async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) { res.status(400).send('Неверная ссылка'); return; }
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { email: string; action: string };
    if (payload.action !== 'unsubscribe') { res.status(400).send('Неверная ссылка'); return; }
    await prisma.user.updateMany({ where: { email: payload.email }, data: { emailOptOut: true } });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Отписка</title></head><body style="font-family:sans-serif;text-align:center;padding:80px 20px"><h2>Вы отписались от рассылки</h2><p>Вы больше не будете получать маркетинговые письма от VibeHosting.</p><p style="margin-top:24px"><a href="${config.frontendUrl}" style="color:#10b981">Вернуться на сайт</a></p></body></html>`);
  } catch {
    res.status(400).send('Ссылка недействительна или просрочена');
  }
});

// Auth routes: optionalAuth sets userId if token present, handlers enforce auth where needed
app.use('/api/auth', authLimiter, optionalAuth, authRoutes);

// Public: billing webhook (no auth, signature-verified)
// Capture raw body for HMAC verification before JSON parsing
app.use('/api/billing/webhook', express.json({
  verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; },
}));
app.use('/api/billing/webhook', billingWebhookRouter);

// Public: site password gate (Nginx auth_request + password form)
app.get('/api/site-auth', siteAuthHandler);
app.get('/api/site-gate/:slug', siteGateGet);
app.post('/api/site-gate/:slug', authLimiter, siteGatePost);

// Public: editor preview — served via subdomain (slug.hostingvibe.ru/__vibe_preview)
// Nginx proxies /__vibe_preview from the subdomain to /api/internal/preview
import jwt from 'jsonwebtoken';
import fs from 'fs';
app.get('/api/internal/preview', apiLimiter, async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(401).json({ error: 'Требуется токен' });
      return;
    }
    let userId: string;
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { userId: string };
      userId = payload.userId;
    } catch {
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }
    // Extract slug from Host header (set by Nginx: slug.hostingvibe.ru)
    const host = req.headers['x-original-host'] as string || req.headers.host || '';
    const slugMatch = host.match(/^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru/);
    if (!slugMatch) {
      res.status(400).json({ error: 'Недопустимый хост' });
      return;
    }
    const slug = slugMatch[1];
    const project = await prisma.project.findFirst({
      where: { slug },
      select: { id: true, slug: true, userId: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }
    if (project.userId !== userId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
    const pagePath = (req.query.path as string) || 'index.html';
    if (pagePath.includes('..') || pagePath.startsWith('/')) {
      res.status(400).json({ error: 'Недопустимый путь' });
      return;
    }
    const siteDir = path.join(config.sitesDir, project.slug);
    const filePath = path.resolve(siteDir, pagePath);
    if (!filePath.startsWith(siteDir + '/') && filePath !== path.join(siteDir, 'index.html')) {
      res.status(400).json({ error: 'Недопустимый путь' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `${pagePath} не найден` });
      return;
    }
    let html = fs.readFileSync(filePath, 'utf-8');
    // Inject bridge script before </body> — origin matches so no CORS issues
    const bridgeScript = `<script src="${config.frontendUrl}/api/vibe-editor-bridge.js"></script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${bridgeScript}\n</body>`);
    } else {
      html += bridgeScript;
    }
    // SPA fix: rewrite pathname from /__vibe_preview to / so client-side routers find their root route
    const spaFix = `<script>history.replaceState(null,'','/');</script>`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${spaFix}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n${spaFix}`);
    }
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Edit preview error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// --- Auth middleware for all routes below ---
app.use('/api', authMiddleware);
app.use('/api/projects', apiLimiter, projectRoutes);
app.use('/api/projects', apiLimiter, deployRoutes);
app.use('/api/projects', apiLimiter, analyticsRoutes); // /:id/analytics
app.use('/api/domains', apiLimiter, domainRoutes);
app.use('/api/billing', apiLimiter, billingRoutes);
app.use('/api/telegram', apiLimiter, telegramRoutes);
app.use('/api/projects', apiLimiter, editRoutes);
app.use('/api/admin', adminMiddleware, adminRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  if (err.message === 'Только ZIP или TAR.GZ архивы') {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(config.port, () => {
  logger.info(`Backend started on port ${config.port}`);
  runCleanupWorker();
  runEngagementWorker();
  initTelegramBot();
});
