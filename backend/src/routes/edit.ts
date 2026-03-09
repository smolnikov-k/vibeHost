import { Router, Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from '../services/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// --- Multer for asset uploads ---

const assetUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      cb(null, '/tmp');
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_')
        .slice(0, 50);
      const unique = Date.now().toString(36);
      cb(null, `${name}-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/avif', 'font/woff', 'font/woff2', 'application/font-woff',
      'video/mp4', 'video/webm',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения, шрифты и видео'));
    }
  },
});

// --- Helper: verify project ownership ---

async function getOwnedProject(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, slug: true, userId: true, status: true, domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } },
  });
  if (!project) {
    res.status(404).json({ error: 'Проект не найден' });
    return null;
  }
  if (project.userId !== req.userId) {
    res.status(403).json({ error: 'Нет доступа' });
    return null;
  }
  return project;
}

// Whitelist CSS properties for style patches
const ALLOWED_STYLE_PROPS = [
  'color', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight',
  'letterSpacing', 'textDecoration', 'backgroundColor', 'borderRadius', 'opacity',
  'padding', 'margin', 'border', 'boxShadow', 'fontFamily', 'display',
];

function isValidSelector(selector: unknown): selector is string {
  return typeof selector === 'string'
    && selector.length > 0
    && selector.length <= 500
    && !/[<>{}]|javascript:|expression\s*\(/i.test(selector);
}

function validateStyleContent(content: unknown): { valid: boolean; error?: string } {
  if (typeof content !== 'string' || !content) {
    return { valid: false, error: 'Для style-патча нужен content с CSS-свойствами' };
  }

  try {
    const styles = JSON.parse(content) as Record<string, unknown>;
    const invalid = Object.keys(styles).filter(k => !ALLOWED_STYLE_PROPS.includes(k));
    if (invalid.length > 0) {
      return { valid: false, error: `Недопустимые CSS-свойства: ${invalid.join(', ')}` };
    }
  } catch {
    return { valid: false, error: 'content для style должен быть валидным JSON' };
  }

  return { valid: true };
}

// ======================
// PAGES
// ======================

// GET /:id/edit/pages — list HTML files in site directory
router.get('/:id/edit/pages', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const siteDir = path.join(config.sitesDir, project.slug);
    if (!fs.existsSync(siteDir)) {
      res.json({ pages: [] });
      return;
    }

    const pages: { path: string; size: number; modified: string }[] = [];

    function scanDir(dir: string, prefix: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !['node_modules', '.git', 'img', 'assets'].includes(entry.name)) {
          scanDir(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        }
        if (entry.isFile() && entry.name.endsWith('.html')) {
          const filePath = path.join(dir, entry.name);
          const stat = fs.statSync(filePath);
          pages.push({
            path: prefix ? `${prefix}/${entry.name}` : entry.name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      }
    }

    scanDir(siteDir, '');
    res.json({ pages });
  } catch (err) {
    logger.error('Edit list pages error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ======================
// PREVIEW (iframe with bridge)
// ======================

// GET /:id/edit/preview — serve site HTML with editor bridge injected
router.get('/:id/edit/preview', async (req: AuthRequest, res: Response) => {
  try {
    // Allow token from query param for iframe loading
    if (!req.userId && req.query.token) {
      const jwt = await import('jsonwebtoken');
      try {
        const decoded = jwt.default.verify(req.query.token as string, config.jwtSecret, { algorithms: ['HS256'] }) as { userId: string };
        (req as AuthRequest).userId = decoded.userId;
      } catch { /* ignore invalid token */ }
    }

    const project = await getOwnedProject(req, res);
    if (!project) return;

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

    // Inject editor bridge script before </body>
    const bridgeScript = `<script src="${config.frontendUrl}/api/vibe-editor-bridge.js"></script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${bridgeScript}\n</body>`);
    } else {
      html += bridgeScript;
    }

    // Add <base> tag for correct relative asset resolution
    const siteHost = project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`;
    const baseTag = `<base href="https://${siteHost}/">`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${baseTag}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n${baseTag}`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Edit preview error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ======================
// PATCHES CRUD
// ======================

// GET /:id/edit/patches — list patches for project
router.get('/:id/edit/patches', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const patches = await prisma.visualPatch.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    });

    res.json({ patches });
  } catch (err) {
    logger.error('Edit patches list error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /:id/edit/patches — create a patch
router.post('/:id/edit/patches', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const { selector, type, content } = req.body;
    if (!selector || !type) {
      res.status(400).json({ error: 'Укажите selector и type' });
      return;
    }
    if (!isValidSelector(selector)) {
      res.status(400).json({ error: 'Некорректный selector' });
      return;
    }
    if (!['text', 'image', 'hide', 'style'].includes(type)) {
      res.status(400).json({ error: 'type должен быть text, image, hide или style' });
      return;
    }

    // Limit patches per project to prevent abuse
    const patchCount = await prisma.visualPatch.count({ where: { projectId: project.id } });
    if (patchCount >= 200) {
      res.status(400).json({ error: 'Лимит патчей: 200 на проект' });
      return;
    }

    // Validate style patch
    if (type === 'style') {
      const styleValidation = validateStyleContent(content);
      if (!styleValidation.valid) {
        res.status(400).json({ error: styleValidation.error });
        return;
      }
    }

    const last = await prisma.visualPatch.findFirst({
      where: { projectId: project.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const patch = await prisma.visualPatch.create({
      data: {
        projectId: project.id,
        selector,
        type,
        content: content || null,
        order: (last?.order ?? -1) + 1,
      },
    });

    res.json({ patch });
  } catch (err) {
    logger.error('Edit patch create error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /:id/edit/patches/:patchId — update a patch
router.put('/:id/edit/patches/:patchId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const { patchId } = req.params;
    const existing = await prisma.visualPatch.findFirst({
      where: { id: patchId, projectId: project.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Патч не найден' });
      return;
    }

    const { selector, type, content, enabled, order } = req.body;
    if (selector !== undefined && !isValidSelector(selector)) {
      res.status(400).json({ error: 'Некорректный selector' });
      return;
    }

    if (type !== undefined && !['text', 'image', 'hide', 'style'].includes(type)) {
      res.status(400).json({ error: 'type должен быть text, image, hide или style' });
      return;
    }

    const effectiveType = (type ?? existing.type) as 'text' | 'image' | 'hide' | 'style';
    const effectiveContent = content ?? existing.content;
    if (effectiveType === 'style') {
      const styleValidation = validateStyleContent(effectiveContent);
      if (!styleValidation.valid) {
        res.status(400).json({ error: styleValidation.error });
        return;
      }
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled должен быть boolean' });
      return;
    }

    if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
      res.status(400).json({ error: 'order должен быть целым числом >= 0' });
      return;
    }

    const patch = await prisma.visualPatch.update({
      where: { id: patchId },
      data: {
        ...(selector !== undefined && { selector }),
        ...(type !== undefined && { type }),
        ...(content !== undefined && { content }),
        ...(enabled !== undefined && { enabled }),
        ...(order !== undefined && { order }),
      },
    });

    res.json({ patch });
  } catch (err) {
    logger.error('Edit patch update error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /:id/edit/patches/:patchId — delete a patch
router.delete('/:id/edit/patches/:patchId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const { patchId } = req.params;
    const existing = await prisma.visualPatch.findFirst({
      where: { id: patchId, projectId: project.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Патч не найден' });
      return;
    }

    await prisma.visualPatch.delete({ where: { id: patchId } });
    res.json({ success: true });
  } catch (err) {
    logger.error('Edit patch delete error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ======================
// ASSETS
// ======================

// POST /:id/edit/assets — upload image/file to site directory
router.post('/:id/edit/assets', assetUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const file = (req as any).file as { filename: string; path: string; mimetype: string; size: number } | undefined;
    if (!file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const siteDir = path.join(config.sitesDir, project.slug);
    const imgDir = path.join(siteDir, 'img');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }

    const dest = path.join(imgDir, file.filename);
    fs.renameSync(file.path, dest);

    const assetHost = project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`;
    const src = `https://${assetHost}/img/${file.filename}`;
    res.json({ src, name: file.filename, type: file.mimetype });
  } catch (err) {
    logger.error('Edit asset upload error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// GET /:id/edit/assets — list assets in site directory
router.get('/:id/edit/assets', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req, res);
    if (!project) return;

    const siteDir = path.join(config.sitesDir, project.slug);
    const assetHost = project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`;
    const assets: { src: string; name: string; type: string }[] = [];
    const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.mp4', '.webm'];

    function scanAssets(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanAssets(path.join(dir, entry.name));
        }
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (imgExts.includes(ext)) {
            const relPath = path.relative(siteDir, path.join(dir, entry.name));
            assets.push({
              src: `https://${assetHost}/${relPath}`,
              name: entry.name,
              type: ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`,
            });
          }
        }
      }
    }

    scanAssets(siteDir);
    res.json({ assets });
  } catch (err) {
    logger.error('Edit list assets error', { error: (err as Error).message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ======================
// BACKWARD COMPAT (temporary — old paths redirect to new)
// ======================

router.get('/:id/patches', (req: AuthRequest, res: Response) => {
  const url = req.originalUrl;
  res.redirect(url.replace('/patches', '/edit/patches'));
});
router.get('/:id/patches/preview', (req: AuthRequest, res: Response) => {
  const url = req.originalUrl;
  res.redirect(url.replace('/patches/preview', '/edit/preview'));
});
router.get('/:id/editor/pages', (req: AuthRequest, res: Response) => {
  const url = req.originalUrl;
  res.redirect(url.replace('/editor/pages', '/edit/pages'));
});
router.get('/:id/editor/assets', (req: AuthRequest, res: Response) => {
  const url = req.originalUrl;
  res.redirect(url.replace('/editor/assets', '/edit/assets'));
});

export default router;

// --- Public route (no auth) — serves patches JSON for runtime script ---

export const publicPatchesRouter = Router();

publicPatchesRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      res.json([]);
      return;
    }

    const patches = await prisma.visualPatch.findMany({
      where: { projectId: project.id, enabled: true },
      orderBy: { order: 'asc' },
      select: { selector: true, type: true, content: true },
    });

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(patches);
  } catch (err) {
    logger.error('Public patches error', { error: (err as Error).message });
    res.json([]);
  }
});
