import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
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
      },
    });
    res.json(projects.map(p => ({
      ...p,
      sizeBytes: Number(p.sizeBytes),
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

    const limits = getPlanLimits(user.plan);
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

    // FREE plan → site expires in 30 days
    const expiresAt = user.plan === 'FREE'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const project = await prisma.project.create({
      data: {
        userId: req.userId!,
        slug,
        title,
        description: description || null,
        expiresAt,
      },
    });

    res.status(201).json({ ...project, sizeBytes: Number(project.sizeBytes) });
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
    res.json({
      ...safeResult,
      sizeBytes: Number(result.sizeBytes),
      isSPA,
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

    const { title, description, isPublic, tags, password, passwordEnabled } = req.body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (tags !== undefined) data.tags = tags;

    // Password protection
    if (passwordEnabled === false) {
      data.passwordEnabled = false;
      data.passwordHash = null;
    } else if (password && typeof password === 'string' && password.length >= 1) {
      data.passwordHash = await bcrypt.hash(password, 10);
      data.passwordEnabled = true;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    res.json({ ...project, sizeBytes: Number(project.sizeBytes) });
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
    const tmpZip = path.join('/tmp', `vibe-export-${project.id}.zip`);

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

    // Удаляем файлы и бэкапы проекта с диска
    deleteProjectFiles(project.slug);

    await prisma.project.delete({ where: { id: projectId } });

    const allProjects = await prisma.project.findMany({
      where: { userId: req.userId },
      select: { sizeBytes: true },
    });
    const totalStorage = allProjects.reduce((sum, p) => sum + Number(p.sizeBytes), 0);
    await prisma.user.update({
      where: { id: req.userId },
      data: { storageUsed: totalStorage },
    });

    res.json({ success: true, slug: project.slug });
  } catch (err) {
    logger.error('Delete project error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
