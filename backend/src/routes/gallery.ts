import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { likeLimiter } from '../middleware/rateLimit';
import logger from '../services/logger';

// In-memory guest like tracking (IP hash → Set of projectIds), max 5000 IPs
const MAX_GUEST_LIKES = 5_000;
const guestLikes = new Map<string, Set<string>>();

function getIpHash(ip: string): string {
  return crypto.createHash('sha256').update(ip + 'vibe-like-salt').digest('hex').slice(0, 16);
}

const router = Router();

// Track recent views to avoid duplicate counting (IP + projectId, 1h cooldown)
const MAX_VIEWS_MAP = 10_000;
const recentViews = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentViews) {
    if (now - time > 3600000) recentViews.delete(key);
  }
  // Hard limit: drop oldest half if over cap
  if (recentViews.size > MAX_VIEWS_MAP) {
    const entries = [...recentViews.entries()].sort((a, b) => a[1] - b[1]);
    for (const [key] of entries.slice(0, Math.floor(entries.length / 2))) recentViews.delete(key);
  }
  // Cap guest likes map too
  if (guestLikes.size > MAX_GUEST_LIKES) {
    const keys = [...guestLikes.keys()];
    for (const key of keys.slice(0, Math.floor(keys.length / 2))) guestLikes.delete(key);
  }
}, 5 * 60 * 1000); // cleanup every 5 min

// List public projects
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sort = (req.query.sort as string) || 'newest';
    const tag = req.query.tag as string | undefined;
    const search = req.query.q as string | undefined;

    const where: any = { isPublic: true, status: 'LIVE' };

    if (tag) {
      where.tags = { has: tag };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sort === 'popular' ? { likes: 'desc' as const }
      : sort === 'views' ? { views: 'desc' as const }
      : { publishedAt: 'desc' as const };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          tags: true,
          likes: true,
          views: true,
          publishedAt: true,
          user: { select: { displayName: true } },
          domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 },
        },
      }),
      prisma.project.count({ where }),
    ]);

    // If user is authenticated, check which projects they liked
    let likedIds: Set<string> = new Set();
    if (req.userId) {
      const userLikes = await prisma.projectLike.findMany({
        where: {
          userId: req.userId,
          projectId: { in: projects.map(p => p.id) },
        },
        select: { projectId: true },
      });
      likedIds = new Set(userLikes.map(l => l.projectId));
    }

    res.json({
      projects: projects.map(p => ({
        ...p,
        customDomain: p.domains[0]?.hostname ?? null,
        domains: undefined,
        isLiked: likedIds.has(p.id),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Gallery error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Popular tags — aggregate via Prisma to avoid raw SQL/table-name drift
router.get('/meta/tags', async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { isPublic: true, status: 'LIVE' },
      select: { tags: true },
      take: 2000, // quick-fix safeguard: enough for current catalog size
    });

    const counts = new Map<string, number>();
    for (const project of projects) {
      for (const rawTag of project.tags || []) {
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
    logger.error('Tags error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Get public project by slug (with deduplicated view counting)
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        tags: true,
        likes: true,
        views: true,
        isPublic: true,
        publishedAt: true,
        user: { select: { displayName: true } },
      },
    });

    if (!project || !project.isPublic) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Deduplicate views by IP (1h cooldown)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const viewKey = `${project.id}:${ip}`;
    if (!recentViews.has(viewKey)) {
      recentViews.set(viewKey, Date.now());
      await prisma.project.update({
        where: { slug },
        data: { views: { increment: 1 } },
      });
    }

    // Check if current user/guest liked this project
    let isLiked = false;
    if (req.userId) {
      const like = await prisma.projectLike.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: req.userId } },
      });
      isLiked = !!like;
    } else {
      const ipHash = getIpHash(ip);
      isLiked = guestLikes.get(ipHash)?.has(project.id) || false;
    }

    res.json({ ...project, isLiked });
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Gallery project error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Toggle like (auth or guest via IP)
router.post('/:slug/like', likeLimiter, optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, isPublic: true, likes: true },
    });

    if (!project || !project.isPublic) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Authenticated user — use DB-based likes (transaction for consistency)
    if (req.userId) {
      const existing = await prisma.projectLike.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: req.userId } },
      });

      if (existing) {
        await prisma.$transaction([
          prisma.projectLike.delete({ where: { id: existing.id } }),
          prisma.project.update({ where: { id: project.id }, data: { likes: { decrement: 1 } } }),
        ]);
        res.json({ liked: false, likes: Math.max(0, project.likes - 1) });
      } else {
        await prisma.$transaction([
          prisma.projectLike.create({ data: { projectId: project.id, userId: req.userId } }),
          prisma.project.update({ where: { id: project.id }, data: { likes: { increment: 1 } } }),
        ]);
        res.json({ liked: true, likes: project.likes + 1 });
      }
      return;
    }

    // Guest user — use IP-based in-memory likes
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ipHash = getIpHash(ip);
    const likedSet = guestLikes.get(ipHash) || new Set();

    if (likedSet.has(project.id)) {
      // Unlike
      likedSet.delete(project.id);
      if (likedSet.size === 0) guestLikes.delete(ipHash);
      else guestLikes.set(ipHash, likedSet);
      await prisma.project.update({
        where: { id: project.id },
        data: { likes: { decrement: 1 } },
      });
      res.json({ liked: false, likes: Math.max(0, project.likes - 1) });
    } else {
      // Like
      likedSet.add(project.id);
      guestLikes.set(ipHash, likedSet);
      await prisma.project.update({
        where: { id: project.id },
        data: { likes: { increment: 1 } },
      });
      res.json({ liked: true, likes: project.likes + 1 });
    }
  } catch (err) {
    const requestId = req.requestId || 'unknown';
    logger.error('Like error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
