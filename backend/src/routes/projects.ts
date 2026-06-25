import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import { AuthRequest } from '../middleware/auth';
import { validateSlug } from '../utils/slug';
import { getPlanLimits } from '../utils/limits';
import { deleteProjectFiles } from '../services/deploy.service';
import { config } from '../config';
import logger from '../services/logger';

const router = Router();

// List user's projects
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { deployments: true, domains: true } },
        domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 },
      },
    });
    res.json(projects.map(({ passwordHash: _ph, ...p }) => ({
      ...p,
      sizeBytes: Number(p.sizeBytes),
      customDomain: p.domains[0]?.hostname ?? null,
      domains: undefined,
    })));
  } catch (err) {
    logger.error('List projects error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create project
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, slug, description } = req.body;

    if (!title || !slug) {
      res.status(400).json({ error: 'Название и slug обязательны' });
      return;
    }
    if (typeof title !== 'string' || title.trim().length > 100) {
      res.status(400).json({ error: 'Название не более 100 символов' });
      return;
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      res.status(400).json({ error: 'Описание не более 500 символов' });
      return;
    }

    const slugError = validateSlug(slug);
    if (slugError) {
      res.status(400).json({ error: slugError });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const limits = getPlanLimits(user.plan, user.isAdmin);
    const projectCount = await prisma.project.count({ where: { userId: req.userId } });
    if (projectCount >= limits.maxProjects) {
      res.status(403).json({
        error: `Лимит проектов: ${limits.maxProjects}. Перейдите на PRO для расширения.`,
        code: 'PROJECT_LIMIT',
      });
      return;
    }

    const existingSlug = await prisma.project.findUnique({ where: { slug } });
    if (existingSlug) {
      res.status(409).json({ error: 'Этот slug уже занят' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        userId: req.userId!,
        slug,
        title,
        description: description || null,
      },
    });

    const { passwordHash: _ph, ...safeProject } = project;
    res.status(201).json({ ...safeProject, sizeBytes: Number(project.sizeBytes) });
  } catch (err) {
    logger.error('Create project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get project details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const result = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: {
        deployments: { orderBy: { createdAt: 'desc' }, take: 10 },
        domains: true,
      },
    });
    if (!result) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }
    // Detect SPA — check if index.html body has only an empty root div
    let isSPA = false;
    if (result.status === 'LIVE') {
      try {
        const indexPath = path.join(config.sitesDir, result.slug, 'index.html');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath, 'utf-8');
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          if (bodyMatch) {
            const stripped = bodyMatch[1]
              .replace(/<!--[\s\S]*?-->/g, '')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .trim();
            isSPA = /^<div\s+id=["'](root|app|__next)["'][^>]*>\s*<\/div>$/i.test(stripped);
          }
        }
      } catch { /* non-critical */ }
    }

    const { passwordHash: _ph, ...safeResult } = result;
    const verifiedDomain = result.domains.find(d => d.verified && d.sslStatus === 'ACTIVE');
    res.json({
      ...safeResult,
      sizeBytes: Number(result.sizeBytes),
      isSPA,
      customDomain: verifiedDomain?.hostname ?? null,
      deployments: result.deployments.map((d: any) => ({ ...d, sizeBytes: Number(d.sizeBytes) })),
    });
  } catch (err) {
    logger.error('Get project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update project
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const { title, description, isPublic, tags, password, passwordEnabled, metrikaId } = req.body;

    // Input validation
    if (title !== undefined && (typeof title !== 'string' || title.length > 100)) {
      res.status(400).json({ error: 'Название не более 100 символов' });
      return;
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      res.status(400).json({ error: 'Описание не более 500 символов' });
      return;
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 10 || tags.some((t: unknown) => typeof t !== 'string' || (t as string).length > 30))) {
      res.status(400).json({ error: 'Теги: массив до 10 строк, каждый до 30 символов' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = (title as string).trim();
    if (description !== undefined) data.description = (description as string).trim() || null;
    if (isPublic !== undefined) data.isPublic = !!isPublic;
    if (tags !== undefined) data.tags = (tags as string[]).map(t => t.trim()).filter(Boolean);

    // Password protection
    if (passwordEnabled === false) {
      data.passwordEnabled = false;
      data.passwordHash = null;
    } else if (password && typeof password === 'string' && password.length >= 1) {
      data.passwordHash = await bcrypt.hash(password, 10);
      data.passwordEnabled = true;
      logger.info('Password updated for project', {
        projectId,
        slug: existing.slug,
      });
    }

    // Yandex.Metrika counter ID (digits only)
    if (metrikaId !== undefined) {
      data.metrikaId = typeof metrikaId === 'string' ? metrikaId.replace(/\D/g, '') || null : null;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    const { passwordHash: _ph, ...safeProject } = project;
    res.json({ ...safeProject, sizeBytes: Number(project.sizeBytes) });
  } catch (err) {
    logger.error('Update project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Export project as ZIP
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const siteDir = path.join(config.sitesDir, project.slug);
    if (!fs.existsSync(siteDir)) {
      res.status(404).json({ error: 'Файлы проекта не найдены' });
      return;
    }

    const zipName = `${project.slug}-v${project.currentVersion}.zip`;
    const tmpZip = path.join('/tmp', `vibe-export-${crypto.randomUUID()}.zip`);

    // Create ZIP from site directory
    const zipResult = spawnSync('zip', ['-r', tmpZip, '.', '-x', '.*'], {
      cwd: siteDir,
      timeout: 30000,
      stdio: 'pipe',
    });
    if (zipResult.status !== 0) {
      res.status(500).json({ error: 'Ошибка создания архива' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const stream = fs.createReadStream(tmpZip);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlinkSync(tmpZip);
    });
    stream.on('error', () => {
      if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка отправки файла' });
      }
    });
  } catch (err) {
    logger.error('Export error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete project
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Delete from DB first (cascade deletes related records)
    await prisma.project.delete({ where: { id: projectId } });

    // Then delete files from disk (non-critical — won't block response if it fails)
    try { deleteProjectFiles(project.slug); } catch { /* files may already be gone */ }

    const agg = await prisma.project.aggregate({
      where: { userId: req.userId },
      _sum: { sizeBytes: true },
    });
    await prisma.user.update({
      where: { id: req.userId },
      data: { storageUsed: Number(agg._sum.sizeBytes || 0) },
    });

    res.json({ success: true, slug: project.slug });
  } catch (err) {
    logger.error('Delete project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Generate QR code for project URL
router.get('/:id/qr', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const domain = project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`;
    const siteUrl = `https://${domain}`;

    const format = req.query.format === 'svg' ? 'svg' : 'png';
    const sizeParam = parseInt(req.query.size as string, 10);
    const size = [200, 300, 500].includes(sizeParam) ? sizeParam : 300;

    if (format === 'svg') {
      const svg = await QRCode.toString(siteUrl, { type: 'svg', width: size, margin: 1 });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `inline; filename="${project.slug}-qr.svg"`);
      res.send(svg);
    } else {
      const buffer = await QRCode.toBuffer(siteUrl, { type: 'png', width: size, margin: 1 });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${project.slug}-qr.png"`);
      res.send(buffer);
    }
  } catch (err) {
    logger.error('QR generation error:', err);
    res.status(500).json({ error: 'Ошибка генерации QR-кода' });
  }
});

export default router;
