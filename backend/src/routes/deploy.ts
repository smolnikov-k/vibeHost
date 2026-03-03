import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { uploadZip } from '../middleware/upload';
import { deployLimiter } from '../middleware/rateLimit';
import { getPlanLimits } from '../utils/limits';
import { processDeploy } from '../services/deploy.service';
import { processGithubDeploy } from '../services/github.service';
import { config } from '../config';
import logger from '../services/logger';

const router = Router();

// Upload ZIP and deploy
router.post('/:id/deploy', deployLimiter, uploadZip.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ZIP-файл обязателен' });
      return;
    }

    const projectId = req.params.id as string;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { user: true },
    });
    if (!project) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Check file size against plan limit
    const limits = getPlanLimits(project.user.plan);
    if (req.file.size > limits.maxSiteSize) {
      fs.unlinkSync(req.file.path);
      res.status(413).json({
        error: `Размер файла превышает лимит (${Math.round(limits.maxSiteSize / 1024 / 1024)} МБ)`,
        code: 'SIZE_LIMIT',
      });
      return;
    }

    // Calculate ZIP hash
    const fileBuffer = fs.readFileSync(req.file.path);
    const zipHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Create deployment record
    const newVersion = project.currentVersion + 1;
    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        version: newVersion,
        status: 'PENDING',
        zipHash,
      },
    });

    // Rename file to include deploymentId for lookup (preserve extension)
    const origName = req.file.originalname.toLowerCase();
    const ext = origName.endsWith('.tar.gz') ? '.tar.gz' : origName.endsWith('.tgz') ? '.tgz' : '.zip';
    const newPath = path.join(config.uploadDir, `${deployment.id}${ext}`);
    fs.renameSync(req.file.path, newPath);

    res.json({
      deploymentId: deployment.id,
      version: newVersion,
      status: 'PENDING',
      message: 'Деплой запущен',
    });

    // Process in background (non-blocking)
    processDeploy(deployment.id).catch(err => {
      logger.error(`Deploy ${deployment.id} failed:`, err);
    });

  } catch (err) {
    logger.error('Deploy error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List deployments
router.get('/:id/deployments', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const deployments = await prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(deployments.map(d => ({ ...d, sizeBytes: Number(d.sizeBytes) })));
  } catch (err) {
    logger.error('List deployments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get deployment status
router.get('/:id/deployments/:deployId/status', async (req: AuthRequest, res: Response) => {
  try {
    const deployId = req.params.deployId as string;
    const projectId = req.params.id as string;
    const deployment = await prisma.deployment.findFirst({
      where: { id: deployId, project: { id: projectId, userId: req.userId } },
    });
    if (!deployment) {
      res.status(404).json({ error: 'Деплой не найден' });
      return;
    }
    res.json({ status: deployment.status, errorMessage: deployment.errorMessage });
  } catch (err) {
    logger.error('Deployment status error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Deploy from GitHub
router.post('/:id/deploy-github', deployLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const { repoUrl, subdir } = req.body;

    if (!repoUrl) {
      res.status(400).json({ error: 'URL репозитория обязателен' });
      return;
    }

    // Validate GitHub URL
    const urlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
    if (!urlPattern.test(repoUrl)) {
      res.status(400).json({ error: 'Некорректный URL GitHub-репозитория. Формат: https://github.com/user/repo' });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    res.json({ message: 'Деплой из GitHub запущен', status: 'PROCESSING' });

    // Process in background
    processGithubDeploy(projectId, repoUrl, subdir).catch(err => {
      logger.error(`GitHub deploy ${projectId} failed:`, err);
    });
  } catch (err) {
    logger.error('GitHub deploy error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Rollback to a previous version (PRO only — uses backups)
router.post('/:id/rollback', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const { version } = req.body;

    if (!version || typeof version !== 'number') {
      res.status(400).json({ error: 'Номер версии обязателен' });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { user: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    if (version === project.currentVersion) {
      res.status(400).json({ error: 'Это уже текущая версия' });
      return;
    }

    // Check backup exists
    const backupDir = path.join(config.backupsDir, project.slug, `v${version}`);
    if (!fs.existsSync(backupDir)) {
      res.status(404).json({ error: 'Бэкап этой версии не найден. Откат доступен только для PRO.' });
      return;
    }

    const siteDir = path.join(config.sitesDir, project.slug);

    // Backup current version before rollback
    if (fs.existsSync(siteDir)) {
      const currentBackupDir = path.join(config.backupsDir, project.slug, `v${project.currentVersion}`);
      if (!fs.existsSync(currentBackupDir)) {
        fs.mkdirSync(currentBackupDir, { recursive: true });
        fs.cpSync(siteDir, currentBackupDir, { recursive: true });
      }
      fs.rmSync(siteDir, { recursive: true, force: true });
    }

    // Restore backup
    fs.cpSync(backupDir, siteDir, { recursive: true });

    // Mark all deployments as superseded, find the rollback target
    await prisma.deployment.updateMany({
      where: { projectId, status: 'LIVE' },
      data: { status: 'SUPERSEDED' },
    });

    const targetDeployment = await prisma.deployment.findFirst({
      where: { projectId, version },
    });

    if (targetDeployment) {
      await prisma.deployment.update({
        where: { id: targetDeployment.id },
        data: { status: 'LIVE' },
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { currentVersion: version, status: 'LIVE' },
    });

    res.json({
      message: `Откат к версии ${version} выполнен`,
      version,
    });
  } catch (err) {
    logger.error('Rollback error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List project files
router.get('/:id/files', async (req: AuthRequest, res: Response) => {
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
      res.json({ files: [], total: 0 });
      return;
    }

    const relativePath = (req.query.path as string) || '';
    // Prevent path traversal
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    const targetDir = path.join(siteDir, safePath);

    if (!targetDir.startsWith(siteDir)) {
      res.status(400).json({ error: 'Недопустимый путь' });
      return;
    }

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      res.status(404).json({ error: 'Директория не найдена' });
      return;
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = entries.map(entry => {
      const fullPath = path.join(targetDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
        size: entry.isFile() ? stat.size : undefined,
        modified: stat.mtime.toISOString(),
      };
    });

    // Sort: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      path: safePath || '/',
      files,
      total: files.length,
    });
  } catch (err) {
    logger.error('List files error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
