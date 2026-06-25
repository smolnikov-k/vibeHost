import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import logger from '../services/logger';

const router = Router();

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

/**
 * POST /api/webhook/blog-publish
 * Automated article publishing from n8n SEO workflows.
 * Auth: X-Webhook-Secret header must match BLOG_WEBHOOK_SECRET env var.
 * Body: { title, content, excerpt?, tags?, metaTitle?, metaDesc? }
 */
router.post('/blog-publish', async (req: Request, res: Response) => {
  try {
    const secret = process.env.BLOG_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('BLOG_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Webhook not configured' });
      return;
    }

    const provided = req.headers['x-webhook-secret'] as string;
    if (!provided || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided.padEnd(secret.length).slice(0, secret.length)))) {
      res.status(401).json({ error: 'Invalid webhook secret' });
      return;
    }

    const { title, content, excerpt, tags, metaTitle, metaDesc } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'title and content are required' });
      return;
    }

    const authorId = process.env.BLOG_WEBHOOK_AUTHOR_ID || 'cmm67m9rt0000whuo8238tw28';

    let slug = slugify(title);
    if (!slug) slug = crypto.randomBytes(6).toString('hex');
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

    const readTime = calculateReadTime(content);

    const article = await prisma.article.create({
      data: {
        slug,
        title,
        content,
        excerpt: excerpt || null,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string' && t.trim()) : [],
        readTime,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    logger.info('Webhook blog-publish: created article', { id: article.id, slug, title });

    res.status(201).json({ ok: true, id: article.id, slug: article.slug, url: `/blog/${article.slug}` });
  } catch (err) {
    logger.error('Webhook blog-publish error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
