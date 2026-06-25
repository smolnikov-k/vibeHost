import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../services/logger';

const router = Router();

// In-memory view dedup (articleId:ip -> timestamp, 1h cooldown)
const MAX_VIEWS_MAP = 10_000;
const recentViews = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentViews) {
    if (now - time > 3600000) recentViews.delete(key);
  }
  if (recentViews.size > MAX_VIEWS_MAP) {
    const entries = [...recentViews.entries()].sort((a, b) => a[1] - b[1]);
    for (const [key] of entries.slice(0, Math.floor(entries.length / 2))) recentViews.delete(key);
  }
}, 5 * 60 * 1000);

// GET / — list published articles
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const tag = req.query.tag as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { status: 'PUBLISHED' };

    if (tag) {
      where.tags = { has: tag };
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          viewCount: true,
          readTime: true,
          tags: true,
          author: { select: { displayName: true } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    res.json({
      articles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Blog list error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// GET /tags — popular tags
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const articles = await prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      select: { tags: true },
      take: 2000,
    });

    const counts = new Map<string, number>();
    for (const article of articles) {
      for (const rawTag of article.tags || []) {
        const tag = rawTag.trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    const tags = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 30);

    res.json(tags);
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Blog tags error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// GET /:slug — single article
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const article = await prisma.article.findUnique({
      where: { slug },
      include: {
        author: { select: { displayName: true } },
      },
    });

    if (!article || article.status !== 'PUBLISHED') {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    // Deduplicate views by IP (1h cooldown)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const viewKey = `${article.id}:${ip}`;
    if (!recentViews.has(viewKey)) {
      recentViews.set(viewKey, Date.now());
      prisma.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});
    }

    res.json(article);
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Blog article error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
