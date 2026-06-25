import { Router, Response, Request } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from '../services/audit.service';
import logger from '../services/logger';

const router = Router();

const BLOG_ASSETS_DIR = '/var/www/vibe-hosting/blog-assets';

// Ensure blog-assets directory exists
if (!fs.existsSync(BLOG_ASSETS_DIR)) {
  fs.mkdirSync(BLOG_ASSETS_DIR, { recursive: true });
}

// --- Transliteration for slug generation ---
const cyrToLat: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(ch => cyrToLat[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function calculateReadTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// --- Multer for blog image uploads ---
const blogImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      cb(null, BLOG_ASSETS_DIR);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения (jpg, png, gif, webp)'));
    }
  },
});

// GET / — all articles (including drafts)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};

    const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      where.status = status;
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { displayName: true, email: true } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      articles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('Admin blog list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST / — create article
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, slug: customSlug, content, excerpt, coverImage, tags, metaTitle, metaDesc, ogImage } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Заголовок и содержание обязательны' });
      return;
    }

    let slug = customSlug ? slugify(customSlug) : slugify(title);
    if (!slug) {
      slug = crypto.randomBytes(6).toString('hex');
    }

    // Ensure unique slug
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const readTime = calculateReadTime(content);

    const article = await prisma.article.create({
      data: {
        slug,
        title,
        content,
        excerpt: excerpt || null,
        coverImage: coverImage || null,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string' && t.trim()) : [],
        readTime,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        ogImage: ogImage || null,
        authorId: req.userId!,
      },
    });

    await logAdminAction(req.userId!, 'create_article', 'article', article.id, { title, slug });

    res.status(201).json(article);
  } catch (err) {
    logger.error('Admin blog create error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /:id — get for editing
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { displayName: true, email: true } },
      },
    });

    if (!article) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    res.json(article);
  } catch (err) {
    logger.error('Admin blog get error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /:id — update
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    const { title, slug: customSlug, content, excerpt, coverImage, tags, metaTitle, metaDesc, ogImage } = req.body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (customSlug !== undefined) {
      const newSlug = slugify(customSlug);
      if (newSlug && newSlug !== existing.slug) {
        const conflict = await prisma.article.findUnique({ where: { slug: newSlug } });
        if (conflict) {
          res.status(409).json({ error: 'Такой slug уже занят' });
          return;
        }
        data.slug = newSlug;
      }
    }
    if (content !== undefined) {
      data.content = content;
      data.readTime = calculateReadTime(content);
    }
    if (excerpt !== undefined) data.excerpt = excerpt || null;
    if (coverImage !== undefined) data.coverImage = coverImage || null;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string' && t.trim()) : [];
    if (metaTitle !== undefined) data.metaTitle = metaTitle || null;
    if (metaDesc !== undefined) data.metaDesc = metaDesc || null;
    if (ogImage !== undefined) data.ogImage = ogImage || null;

    const article = await prisma.article.update({
      where: { id: req.params.id },
      data,
    });

    await logAdminAction(req.userId!, 'update_article', 'article', article.id, { fields: Object.keys(data) });

    res.json(article);
  } catch (err) {
    logger.error('Admin blog update error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    await prisma.article.delete({ where: { id: req.params.id } });

    await logAdminAction(req.userId!, 'delete_article', 'article', req.params.id, { title: existing.title });

    res.json({ success: true });
  } catch (err) {
    logger.error('Admin blog delete error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /:id/publish
router.post('/:id/publish', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    const article = await prisma.article.update({
      where: { id: req.params.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    await logAdminAction(req.userId!, 'publish_article', 'article', article.id, { title: article.title });

    res.json(article);
  } catch (err) {
    logger.error('Admin blog publish error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /:id/unpublish
router.post('/:id/unpublish', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    const article = await prisma.article.update({
      where: { id: req.params.id },
      data: { status: 'DRAFT' },
    });

    await logAdminAction(req.userId!, 'unpublish_article', 'article', article.id, { title: article.title });

    res.json(article);
  } catch (err) {
    logger.error('Admin blog unpublish error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /upload-image
router.post('/upload-image', blogImageUpload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const url = `/blog-assets/${req.file.filename}`;

    await logAdminAction(req.userId!, 'upload_blog_image', 'article', undefined, { filename: req.file.filename });

    res.json({ url });
  } catch (err) {
    logger.error('Admin blog upload error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
