import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from '../services/logger';

const router = Router();

router.get('/internal/preview', async (req: Request, res: Response) => {
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
    const requestId = req.requestId || 'unknown';
    logger.error('Edit preview error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
