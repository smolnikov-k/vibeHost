import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from '../services/logger';

const router = Router();

function readCookie(req: Request, name: string): string | undefined {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return undefined;
  const pairs = rawCookie.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey || rest.length === 0) continue;
    if (rawKey !== name) continue;
    const rawValue = rest.join('=');
    try { return decodeURIComponent(rawValue); } catch { return rawValue; }
  }
  return undefined;
}

router.get('/internal/preview', async (req: Request, res: Response) => {
  try {
    // Accept auth via cookie (primary), Authorization header, or legacy query token
    const cookieToken = readCookie(req, 'vibe_token');
    const bearerHeader = req.headers.authorization;
    const bearerToken = bearerHeader && bearerHeader.startsWith('Bearer ') ? bearerHeader.slice(7) : undefined;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = cookieToken || bearerToken || queryToken;

    if (!token) {
      res.status(401).json({ error: 'Требуется токен' });
      return;
    }

    if (queryToken && !cookieToken && !bearerToken) {
      logger.warn('Preview using legacy query token — migrate to cookie auth', {
        requestId: req.requestId,
      });
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { userId: string };
      userId = payload.userId;
    } catch {
      res.status(401).json({ error: 'Недействительный токен' });
      return;
    }

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
    const defaultFilePath = path.join(siteDir, 'index.html');

    if (!filePath.startsWith(siteDir + '/') && filePath !== defaultFilePath) {
      res.status(400).json({ error: 'Недопустимый путь' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `${pagePath} не найден` });
      return;
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    const bridgeScript = `<script src="${config.frontendUrl}/api/vibe-editor-bridge.js"></script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${bridgeScript}\n</body>`);
    } else {
      html += bridgeScript;
    }

    const assetBasePath = path.posix.dirname(`/${pagePath}`).replace(/\/$/, '') || '';
    const baseHref = `https://${project.slug}.hostingvibe.ru${assetBasePath}/`;
    const baseTag = `<base href="${baseHref}">`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${baseTag}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n${baseTag}`);
    }

    const spaFix = `<script>history.replaceState(null,'','/');</script>`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${spaFix}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n${spaFix}`);
    }

    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Edit preview error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
