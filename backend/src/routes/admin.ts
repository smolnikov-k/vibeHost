import { Router, Response } from 'express';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { logAdminAction } from '../services/audit.service';
import { redisClient, redisReady } from '../middleware/rateLimit';
import { MAINTENANCE_KEY } from '../middleware/maintenance';
import fs from 'fs';
import path from 'path';
import logger from '../services/logger';

const router = Router();

// Maintenance mode
router.get('/maintenance', async (_req: AuthRequest, res: Response) => {
  try {
    if (!redisClient || !redisReady) {
      res.json({ enabled: false });
      return;
    }
    const value = await redisClient.get(MAINTENANCE_KEY);
    res.json({ enabled: !!value });
  } catch (err) {
    logger.error('Admin maintenance get error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/maintenance', async (req: AuthRequest, res: Response) => {
  try {
    if (!redisClient || !redisReady) {
      res.status(503).json({ error: 'Redis недоступен' });
      return;
    }
    const { enabled } = req.body;
    if (enabled) {
      await redisClient.set(MAINTENANCE_KEY, '1');
    } else {
      await redisClient.del(MAINTENANCE_KEY);
    }
    await logAdminAction(req.userId!, enabled ? 'enable_maintenance' : 'disable_maintenance', 'system');
    res.json({ enabled: !!enabled });
  } catch (err) {
    logger.error('Admin maintenance put error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Dashboard stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

    const [
      totalUsers,
      totalProjects,
      liveProjects,
      proUsers,
      recentUsers,
      recentDeploys,
      activeSubscriptions,
      totalDomains,
      totalFormSubmissions,
      errorDeploys,
      bannedUsers,
      newToday,
      newMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.project.count({ where: { status: 'LIVE' } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.deployment.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.domain.count(),
      prisma.formSubmission.count(),
      prisma.deployment.count({ where: { status: 'FAILED' } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
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
      users: { total: totalUsers, pro: proUsers, recentWeek: recentUsers, newToday, newMonth, banned: bannedUsers },
      projects: { total: totalProjects, live: liveProjects, sitesOnDisk: diskUsed },
      deploys: { recentWeek: recentDeploys },
      storage: { totalBytes: totalStorage, totalMB: Math.round(totalStorage / 1024 / 1024) },
      subscriptions: { active: activeSubscriptions },
      domains: { total: totalDomains },
      forms: { total: totalFormSubmissions },
      errors: { deploys: errorDeploys },
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
    const plan = req.query.plan as string | undefined;
    const banned = req.query.banned as string | undefined;
    const sort = req.query.sort as string || 'newest';

    const where: any = {};
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (plan === 'FREE' || plan === 'PRO') {
      where.plan = plan;
    }
    if (banned === 'true') where.isBanned = true;
    if (banned === 'false') where.isBanned = false;

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (sort === 'storage') orderBy = { storageUsed: 'desc' };
    else if (sort === 'projects') orderBy = { projects: { _count: 'desc' } };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, displayName: true, plan: true, isAdmin: true,
          isBanned: true, storageUsed: true, storageLimit: true, createdAt: true,
          _count: { select: { projects: true } },
        },
        orderBy,
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
    const status = req.query.status as string | undefined;
    const sort = req.query.sort as string || 'newest';

    const where: any = {};
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }
    const VALID_STATUSES = ['LIVE', 'SUSPENDED', 'ERROR', 'PROCESSING'];
    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'views') orderBy = { views: 'desc' };
    else if (sort === 'size') orderBy = { sizeBytes: 'desc' };
    else if (sort === 'likes') orderBy = { likes: 'desc' };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true, title: true, slug: true, status: true,
          sizeBytes: true, views: true, likes: true, isPublic: true,
          currentVersion: true, createdAt: true, publishedAt: true,
          user: { select: { email: true, displayName: true } },
          domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      projects: projects.map(p => ({ ...p, sizeBytes: Number(p.sizeBytes), customDomain: p.domains[0]?.hostname ?? null, domains: undefined })),
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
      await logAdminAction(req.userId!, 'unsuspend_project', 'project', project.id, { slug: project.slug });
      res.json({ status: 'LIVE' });
    } else if (project.status === 'LIVE') {
      await prisma.project.update({ where: { id: project.id }, data: { status: 'SUSPENDED' } });
      await logAdminAction(req.userId!, 'suspend_project', 'project', project.id, { slug: project.slug });
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
          project: { select: { slug: true, title: true, status: true, domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      reports: reports.map(r => ({
        ...r,
        project: { ...r.project, customDomain: r.project.domains[0]?.hostname ?? null, domains: undefined },
      })),
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
    await logAdminAction(req.userId!, 'update_report', 'report', req.params.id, { status });
    res.json(report);
  } catch (err) {
    logger.error('Admin report update error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /stats/timeline — registrations, deploys, payments by day
router.get('/stats/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string || '30', 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [registrations, deploys, payments] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.deployment.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.paymentEvent.findMany({
        where: { createdAt: { gte: since }, status: 'PROCESSED' },
        select: { createdAt: true },
      }),
    ]);

    // Build timeline map
    const timeline = new Map<string, { date: string; registrations: number; deploys: number; payments: number }>();
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.now() - (days - 1 - d) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      timeline.set(key, { date: key, registrations: 0, deploys: 0, payments: 0 });
    }

    for (const r of registrations) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const entry = timeline.get(key);
      if (entry) entry.registrations++;
    }
    for (const d of deploys) {
      const key = d.createdAt.toISOString().slice(0, 10);
      const entry = timeline.get(key);
      if (entry) entry.deploys++;
    }
    for (const p of payments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      const entry = timeline.get(key);
      if (entry) entry.payments++;
    }

    res.json([...timeline.values()]);
  } catch (err) {
    logger.error('Admin timeline error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// CSV export utility
function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /users/export — CSV export of all users
router.get('/users/export', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        plan: true,
        storageUsed: true,
        emailVerified: true,
        isBanned: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = ['ID', 'Email', 'Имя', 'Тариф', 'Проектов', 'Хранилище (МБ)', 'Email подтверждён', 'Забанен', 'Дата регистрации'];
    const rows = users.map(u => [
      escapeCSV(u.id),
      escapeCSV(u.email),
      escapeCSV(u.displayName),
      escapeCSV(u.plan),
      escapeCSV(u._count.projects),
      escapeCSV((Number(u.storageUsed) / (1024 * 1024)).toFixed(1)),
      escapeCSV(u.emailVerified ? 'Да' : 'Нет'),
      escapeCSV(u.isBanned ? 'Да' : 'Нет'),
      escapeCSV(u.createdAt.toISOString().split('T')[0]),
    ].join(','));

    const csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=users_${date}.csv`);
    res.send(csv);
  } catch (err) {
    logger.error('Admin users export error:', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

// GET /projects/export — CSV export of all projects
router.get('/projects/export', async (_req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        sizeBytes: true,
        views: true,
        likes: true,
        createdAt: true,
        user: { select: { email: true } },
        _count: { select: { deployments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = ['ID', 'Название', 'Slug', 'Владелец (email)', 'Статус', 'Размер (МБ)', 'Просмотры', 'Лайки', 'Деплоев', 'Дата создания'];
    const rows = projects.map(p => [
      escapeCSV(p.id),
      escapeCSV(p.title),
      escapeCSV(p.slug),
      escapeCSV(p.user.email),
      escapeCSV(p.status),
      escapeCSV((Number(p.sizeBytes) / (1024 * 1024)).toFixed(1)),
      escapeCSV(p.views),
      escapeCSV(p.likes),
      escapeCSV(p._count.deployments),
      escapeCSV(p.createdAt.toISOString().split('T')[0]),
    ].join(','));

    const csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=projects_${date}.csv`);
    res.send(csv);
  } catch (err) {
    logger.error('Admin projects export error:', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

// GET /projects/:id — detailed project info
router.get('/projects/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true, displayName: true, plan: true } },
      },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const [deployments, domains, formCount, patchCount, qrCount] = await Promise.all([
      prisma.deployment.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, status: true, version: true, sizeBytes: true, buildLog: true, errorMessage: true, createdAt: true },
      }),
      prisma.domain.findMany({
        where: { projectId: project.id },
        select: { id: true, hostname: true, verified: true, sslStatus: true, createdAt: true },
      }),
      prisma.formSubmission.count({ where: { projectId: project.id } }),
      prisma.visualPatch.count({ where: { projectId: project.id } }),
      prisma.qrCode.count({ where: { projectId: project.id } }),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [viewsTotal, viewsToday, viewsWeek, viewsMonth] = await Promise.all([
      prisma.pageView.count({ where: { projectId: project.id } }),
      prisma.pageView.count({ where: { projectId: project.id, createdAt: { gte: todayStart } } }),
      prisma.pageView.count({ where: { projectId: project.id, createdAt: { gte: weekStart } } }),
      prisma.pageView.count({ where: { projectId: project.id, createdAt: { gte: monthStart } } }),
    ]);

    res.json({
      project: { ...project, sizeBytes: Number(project.sizeBytes) },
      deployments: deployments.map(d => ({ ...d, sizeBytes: Number(d.sizeBytes) })),
      domains,
      stats: {
        formSubmissions: formCount,
        patches: patchCount,
        qrCodes: qrCount,
        views: { total: viewsTotal, today: viewsToday, week: viewsWeek, month: viewsMonth },
      },
    });
  } catch (err) {
    logger.error('Admin project detail error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /users/:id — detailed user info
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        projects: {
          select: { id: true, slug: true, title: true, status: true, sizeBytes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        subscription: true,
        domains: {
          select: { id: true, hostname: true, verified: true, sslStatus: true, projectId: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Last 10 deployments
    const recentDeploys = await prisma.deployment.findMany({
      where: { project: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, version: true, status: true, createdAt: true,
        project: { select: { slug: true } },
      },
    });

    const { passwordHash: _, emailVerifyCode: _2, ...safeUser } = user as any;
    res.json({
      ...safeUser,
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
      projects: user.projects.map(p => ({ ...p, sizeBytes: Number(p.sizeBytes) })),
      recentDeploys,
    });
  } catch (err) {
    logger.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /users/:id — modify user (plan, ban, storageLimit)
router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === req.userId) {
      res.status(400).json({ error: 'Нельзя изменять свой аккаунт' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const { plan, isBanned, storageLimit } = req.body;
    const data: any = {};
    const changes: Record<string, unknown> = {};

    if (plan !== undefined) {
      if (!['FREE', 'PRO'].includes(plan)) {
        res.status(400).json({ error: 'Некорректный план' });
        return;
      }
      data.plan = plan;
      changes.plan = plan;
      // Adjust storage limit
      if (plan === 'PRO') {
        data.storageLimit = BigInt(config.pro.maxTotalStorage);
      } else {
        data.storageLimit = BigInt(config.free.maxTotalStorage);
      }
    }

    if (isBanned !== undefined) {
      data.isBanned = Boolean(isBanned);
      changes.isBanned = data.isBanned;
      if (data.isBanned) {
        data.tokenVersion = { increment: 1 };
      }
    }

    if (storageLimit !== undefined) {
      const sl = parseInt(storageLimit, 10);
      if (isNaN(sl) || sl < 0) {
        res.status(400).json({ error: 'Некорректный лимит хранилища' });
        return;
      }
      data.storageLimit = BigInt(sl);
      changes.storageLimit = sl;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, plan: true, isBanned: true, storageLimit: true, tokenVersion: true },
    });

    await logAdminAction(req.userId!, 'update_user', 'user', req.params.id, changes);

    res.json({
      ...updated,
      storageLimit: Number(updated.storageLimit),
    });
  } catch (err) {
    logger.error('Admin user patch error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /subscriptions — all subscriptions
router.get('/subscriptions', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = 20;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true, displayName: true } } },
      }),
      prisma.subscription.count(),
    ]);

    res.json({
      subscriptions,
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin subscriptions error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /payments — payment events
router.get('/payments', async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.paymentEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ payments });
  } catch (err) {
    logger.error('Admin payments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /subscriptions/:id — manual activate/deactivate
router.patch('/subscriptions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'CANCELLED'].includes(status)) {
      res.status(400).json({ error: 'Допустимые статусы: ACTIVE, CANCELLED' });
      return;
    }

    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) {
      res.status(404).json({ error: 'Подписка не найдена' });
      return;
    }

    const data: any = { status };
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
    }
    if (status === 'ACTIVE') {
      data.cancelledAt = null;
    }

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data,
    });

    await logAdminAction(req.userId!, 'update_subscription', 'subscription', req.params.id, { status, userId: sub.userId });

    res.json(updated);
  } catch (err) {
    logger.error('Admin subscription patch error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /domains — all domains
router.get('/domains', async (req: AuthRequest, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { slug: true, title: true } },
        user: { select: { email: true } },
      },
    });

    res.json({ domains });
  } catch (err) {
    logger.error('Admin domains error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /deployments — deployments with filters
router.get('/deployments', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const status = req.query.status as string | undefined;

    const where: any = {};
    const VALID_STATUSES = ['LIVE', 'FAILED', 'PENDING', 'EXTRACTING', 'BUILDING', 'SUPERSEDED'] as const;
    if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      where.status = status;
    }

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: { select: { slug: true, user: { select: { email: true } } } },
        },
      }),
      prisma.deployment.count({ where }),
    ]);

    res.json({
      deployments: deployments.map(d => ({
        ...d,
        sizeBytes: Number(d.sizeBytes),
      })),
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin deployments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /system — system monitoring
router.get('/system', async (_req: AuthRequest, res: Response) => {
  try {
    // CPU
    const cpus = os.cpus();
    const cpuLoad = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return Math.round((1 - idle / total) * 100);
    });

    // RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Disk (async with timeout)
    let disk = { total: '', used: '', available: '', usePercent: '' };
    try {
      const { stdout: dfOutput } = await execFileAsync('df', ['-h', '/'], { timeout: 5000 });
      const lastLine = dfOutput.trim().split('\n').pop() || '';
      const parts = lastLine.split(/\s+/);
      disk = {
        total: parts[1] || '?',
        used: parts[2] || '?',
        available: parts[3] || '?',
        usePercent: parts[4] || '?',
      };
    } catch { /* ignore */ }

    // PM2 (async with timeout)
    let pm2Processes: { name: string; status: string; cpu: number; memory: number; restarts: number; uptime: number }[] = [];
    try {
      const { stdout: pm2Output } = await execFileAsync(
        'pm2',
        ['jlist'],
        { timeout: 5000, env: { ...process.env, PM2_HOME: '/root/.pm2' } }
      );
      pm2Processes = JSON.parse(pm2Output).map((p: Record<string, any>) => ({
        name: p.name,
        status: p.pm2_env?.status,
        cpu: p.monit?.cpu,
        memory: p.monit?.memory,
        restarts: p.pm2_env?.restart_time,
        uptime: p.pm2_env?.pm_uptime,
      }));
    } catch { /* ignore */ }

    res.json({
      cpu: { cores: cpus.length, load: cpuLoad, avgLoad: Math.round(cpuLoad.reduce((a, b) => a + b, 0) / cpuLoad.length) },
      ram: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      disk,
      uptime: os.uptime(),
      pm2: pm2Processes,
    });
  } catch (err) {
    logger.error('Admin system error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /audit-log — admin actions log
router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = 20;
    const action = req.query.action as string | undefined;
    const targetType = req.query.targetType as string | undefined;

    const where: any = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          admin: { select: { email: true, displayName: true } },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    logger.error('Admin audit log error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
