import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import logger from '../services/logger';

const router = Router();

// Dashboard stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalProjects,
      liveProjects,
      proUsers,
      recentUsers,
      recentDeploys,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.project.count({ where: { status: 'LIVE' } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.deployment.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    // Disk usage
    let diskUsed = 0;
    try {
      const sitesDir = config.sitesDir;
      if (fs.existsSync(sitesDir)) {
        const entries = fs.readdirSync(sitesDir);
        for (const entry of entries) {
          const stat = fs.statSync(path.join(sitesDir, entry));
          if (stat.isDirectory()) diskUsed++;
        }
      }
    } catch { /* ignore */ }

    // Total storage from DB
    const storageAgg = await prisma.user.aggregate({ _sum: { storageUsed: true } });
    const totalStorage = Number(storageAgg._sum.storageUsed || 0);

    res.json({
      users: { total: totalUsers, pro: proUsers, recentWeek: recentUsers },
      projects: { total: totalProjects, live: liveProjects, sitesOnDisk: diskUsed },
      deploys: { recentWeek: recentDeploys },
      storage: { totalBytes: totalStorage, totalMB: Math.round(totalStorage / 1024 / 1024) },
    });
  } catch (err) {
    logger.error('Admin stats error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = 20;
    const q = (req.query.q as string || '').trim();

    const where = q ? {
      OR: [
        { email: { contains: q, mode: 'insensitive' as const } },
        { displayName: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, displayName: true, plan: true, isAdmin: true,
          storageUsed: true, storageLimit: true, createdAt: true,
          _count: { select: { projects: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map(u => ({
        ...u,
        storageUsed: Number(u.storageUsed),
        storageLimit: Number(u.storageLimit),
      })),
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List projects
router.get('/projects', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = 20;
    const q = (req.query.q as string || '').trim();

    const where = q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { slug: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true, title: true, slug: true, status: true,
          sizeBytes: true, views: true, likes: true, isPublic: true,
          currentVersion: true, createdAt: true, publishedAt: true,
          user: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      projects: projects.map(p => ({ ...p, sizeBytes: Number(p.sizeBytes) })),
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin projects error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Suspend / unsuspend project
router.patch('/projects/:id/suspend', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }
    // Only toggle between SUSPENDED and LIVE — don't unsuspend ERROR projects
    if (project.status === 'SUSPENDED') {
      await prisma.project.update({ where: { id: project.id }, data: { status: 'LIVE' } });
      res.json({ status: 'LIVE' });
    } else if (project.status === 'LIVE') {
      await prisma.project.update({ where: { id: project.id }, data: { status: 'SUSPENDED' } });
      res.json({ status: 'SUSPENDED' });
    } else {
      res.status(400).json({ error: `Нельзя изменить статус ${project.status}` });
    }
  } catch (err) {
    logger.error('Admin suspend error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List reports
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = 20;
    const status = req.query.status as string || undefined;

    const VALID_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'] as const;
    const where = status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])
      ? { status: status as typeof VALID_STATUSES[number] }
      : {};

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          project: { select: { slug: true, title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      reports,
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin reports error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update report status
router.patch('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['REVIEWED', 'RESOLVED', 'DISMISSED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Некорректный статус' });
      return;
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(report);
  } catch (err) {
    logger.error('Admin report update error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
