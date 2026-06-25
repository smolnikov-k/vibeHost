import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { uploadZip } from '../middleware/upload';
import { deployLimiter } from '../middleware/rateLimit';
import { getPlanLimits } from '../utils/limits';
import { processDeploy, publishDeploy } from '../services/deploy.service';
import { processGithubDeploy } from '../services/github.service';
import { acquireProjectOperationLock } from '../services/project-operation-lock';
import { config } from '../config';
import logger from '../services/logger';

const router = Router();

function safeUnlink(filePath: string, requestId: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.warn('Failed to cleanup temporary upload', {
      requestId,
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function sendError(res: Response, status: number, error: string, requestId: string, extra: Record<string, unknown> = {}): void {
  res.status(status).json({ error, ...extra, requestId });
}

// Upload ZIP and deploy
router.post('/:id/deploy', deployLimiter, uploadZip.single('file'), async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  let lock: { release: () => Promise<void> } | null = null;
  let lockReleased = false;
  const releaseLock = async () => {
    if (lock && !lockReleased) {
      await lock.release();
      lockReleased = true;
    }
  };

  try {
    if (!req.file) {
      sendError(res, 400, 'ZIP-файл обязателен', requestId);
      return;
    }

    const projectId = req.params.id as string;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { user: true },
    });
    if (!project) {
      safeUnlink(req.file.path, requestId);
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    // Prevent concurrent deploys for the same project
    const acquiredLock = await acquireProjectOperationLock(projectId);
    if (!acquiredLock.acquired) {
      safeUnlink(req.file.path, requestId);
      sendError(res, 409, 'Деплой уже выполняется для этого проекта. Дождитесь завершения.', requestId);
      return;
    }
    lock = acquiredLock;

    // Get plan limits (size checked after extraction in deploy service)
    const limits = getPlanLimits(project.user.plan, project.user.isAdmin);

    // Calculate ZIP hash via stream (no full file in memory)
    const zipHash = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(req.file!.path);
      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

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

    // Process in background (non-blocking), release lock when done
    processDeploy(deployment.id)
      .catch(err => {
        logger.error(`Deploy ${deployment.id} failed`, {
          requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => { releaseLock(); });

  } catch (err) {
    releaseLock();
    logger.error('Deploy error', { requestId, error: err });
    if (req.file) {
      safeUnlink(req.file.path, requestId);
    }
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// List deployments
router.get('/:id/deployments', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    const deployments = await prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(deployments.map(d => ({ ...d, sizeBytes: Number(d.sizeBytes) })));
  } catch (err) {
    logger.error('List deployments error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Get deployment status
router.get('/:id/deployments/:deployId/status', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const deployId = req.params.deployId as string;
    const projectId = req.params.id as string;
    const deployment = await prisma.deployment.findFirst({
      where: { id: deployId, project: { id: projectId, userId: req.userId } },
    });
    if (!deployment) {
      sendError(res, 404, 'Деплой не найден', requestId);
      return;
    }
    res.json({ status: deployment.status, errorMessage: deployment.errorMessage });
  } catch (err) {
    logger.error('Deployment status error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// SSE: stream deployment status until terminal state
router.get('/:id/deployments/:deployId/stream', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  const deployId = req.params.deployId as string;
  const projectId = req.params.id as string;

  try {
    // Verify ownership once
    const deployment = await prisma.deployment.findFirst({
      where: { id: deployId, project: { id: projectId, userId: req.userId } },
    });
    if (!deployment) {
      sendError(res, 404, 'Деплой не найден', requestId);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable proxy buffering

    let lastStatus = '';
    const TERMINAL = ['LIVE', 'FAILED', 'SUPERSEDED', 'PREVIEW'];

    const poll = setInterval(async () => {
      try {
        const d = await prisma.deployment.findUnique({ where: { id: deployId } });
        if (!d) { clearInterval(poll); res.end(); return; }

        if (d.status !== lastStatus) {
          lastStatus = d.status;
          const payload: Record<string, unknown> = { status: d.status, errorMessage: d.errorMessage };
          if (TERMINAL.includes(d.status) && d.buildLog) {
            payload.buildLog = d.buildLog;
          }
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }

        if (TERMINAL.includes(d.status)) {
          clearInterval(poll);
          res.end();
        }
      } catch (err) {
        logger.warn('Deployment stream poll failed', {
          requestId,
          deployId,
          error: err instanceof Error ? err.message : String(err),
        });
        clearInterval(poll);
        res.end();
      }
    }, 1500);

    req.on('close', () => clearInterval(poll));
  } catch (err) {
    logger.error('Deployment stream error', {
      requestId,
      deployId,
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
    sendError(res, 500, 'Ошибка сервера', requestId);
  }
});

// Publish a PREVIEW deployment to make it LIVE
router.post('/:id/deployments/:deployId/publish', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  const { id: projectId, deployId } = req.params;
  let lock: { release: () => Promise<void> } | null = null;

  try {
    // Verify ownership
    const deployment = await prisma.deployment.findFirst({
      where: { id: deployId, project: { id: projectId, userId: req.userId } },
    });
    if (!deployment) {
      sendError(res, 404, 'Деплой не найден', requestId);
      return;
    }
    if (deployment.status !== 'PREVIEW') {
      sendError(res, 400, 'Можно опубликовать только превью-деплой', requestId);
      return;
    }

    // Acquire project lock
    const lockResult = await acquireProjectOperationLock(projectId);
    if (!lockResult.acquired) {
      sendError(res, 409, 'Другая операция уже выполняется', requestId);
      return;
    }
    lock = lockResult;

    await publishDeploy(deployId);

    res.json({ message: 'Сайт опубликован', status: 'LIVE' });
  } catch (err) {
    logger.error('Publish deploy error', { requestId, deployId, error: err instanceof Error ? err.message : String(err) });
    sendError(res, 500, err instanceof Error ? err.message : 'Ошибка публикации', requestId);
  } finally {
    if (lock) await lock.release();
  }
});

// Deploy from GitHub
router.post('/:id/deploy-github', deployLimiter, async (req: AuthRequest, res: Response) => {
  let lock: { release: () => Promise<void> } | null = null;
  let lockReleased = false;
  const releaseLock = async () => {
    if (lock && !lockReleased) {
      await lock.release();
      lockReleased = true;
    }
  };

  try {
    const requestId = req.requestId || 'unknown';
    const projectId = req.params.id as string;
    const { repoUrl, subdir } = req.body;

    if (!repoUrl) {
      sendError(res, 400, 'URL репозитория обязателен', requestId);
      return;
    }

    // Validate GitHub URL
    const urlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
    if (!urlPattern.test(repoUrl)) {
      sendError(res, 400, 'Некорректный URL GitHub-репозитория. Формат: https://github.com/user/repo', requestId);
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    const acquiredLock = await acquireProjectOperationLock(projectId);
    if (!acquiredLock.acquired) {
      sendError(res, 409, 'Операция с проектом уже выполняется. Дождитесь завершения.', requestId);
      return;
    }
    lock = acquiredLock;

    // Create deployment record upfront so client can subscribe to SSE
    const newVersion = project.currentVersion + 1;
    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        version: newVersion,
        status: 'PENDING',
        zipHash: `github:${repoUrl}`,
      },
    });

    res.json({ message: 'Деплой из GitHub запущен', status: 'PROCESSING', deploymentId: deployment.id });

    // Process in background (pass pre-created deploymentId)
    processGithubDeploy(projectId, repoUrl, subdir, deployment.id).catch(err => {
      logger.error(`GitHub deploy ${projectId} failed`, {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }).finally(() => { releaseLock(); });
  } catch (err) {
    releaseLock();
    const requestId = req.requestId || 'unknown';
    logger.error('GitHub deploy error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// List available backup versions with metadata
router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { user: true },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    const limits = getPlanLimits(project.user.plan, project.user.isAdmin);

    // Fetch deployments that have a backup on disk or are the current live version
    const deployments = await prisma.deployment.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      take: 50,
    });

    const versions = deployments
      .filter(d => d.version !== null)
      .map(d => {
        const ver = d.version as number;
        const backupPath = path.join(config.backupsDir, project.slug, `v${ver}`);
        const hasBackup = fs.existsSync(backupPath);
        return {
          version: ver,
          createdAt: d.createdAt,
          sizeBytes: Number(d.sizeBytes),
          isCurrent: ver === project.currentVersion,
          status: d.status,
          hasBackup: hasBackup || ver === project.currentVersion,
        };
      })
      .filter(v => v.hasBackup);

    res.json({
      versions,
      maxVersions: limits.maxVersions,
      plan: project.user.plan,
    });
  } catch (err) {
    logger.error('List versions error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Rollback to a previous version (uses backups, within plan version limit)
router.post('/:id/rollback', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  let lock: { release: () => Promise<void> } | null = null;
  let lockReleased = false;
  const releaseLock = async () => {
    if (lock && !lockReleased) {
      await lock.release();
      lockReleased = true;
    }
  };

  try {
    const projectId = req.params.id as string;
    const { version } = req.body;

    if (!version || typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      sendError(res, 400, 'Номер версии обязателен (целое число ≥ 1)', requestId);
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      include: { user: true },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    const acquiredLock = await acquireProjectOperationLock(projectId);
    if (!acquiredLock.acquired) {
      sendError(res, 409, 'Операция с проектом уже выполняется. Дождитесь завершения.', requestId);
      return;
    }
    lock = acquiredLock;

    if (version === project.currentVersion) {
      releaseLock();
      sendError(res, 400, 'Это уже текущая версия', requestId);
      return;
    }

    // Check backup exists on disk
    const backupDir = path.join(config.backupsDir, project.slug, `v${version}`);
    if (!fs.existsSync(backupDir)) {
      releaseLock();
      sendError(res, 404, 'Бэкап этой версии не найден', requestId);
      return;
    }

    // Check version is within plan limit (only keep last maxVersions backups)
    const limits = getPlanLimits(project.user.plan, project.user.isAdmin);
    const minAllowedVersion = Math.max(1, project.currentVersion - limits.maxVersions + 1);
    if (version < minAllowedVersion) {
      releaseLock();
      sendError(res, 403, `Версия недоступна. На вашем тарифе доступны последние ${limits.maxVersions} версий.`, requestId, { code: 'VERSION_LIMIT' });
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
    logger.error('Rollback error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  } finally {
    releaseLock();
  }
});

// Delete a backup version
router.delete('/:id/versions/:version', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const projectId = req.params.id as string;
    const version = parseInt(req.params.version, 10);

    if (!version || version < 1) {
      sendError(res, 400, 'Некорректный номер версии', requestId);
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
      return;
    }

    if (version === project.currentVersion) {
      sendError(res, 400, 'Нельзя удалить текущую версию', requestId);
      return;
    }

    const backupDir = path.join(config.backupsDir, project.slug, `v${version}`);
    if (!fs.existsSync(backupDir)) {
      sendError(res, 404, 'Бэкап этой версии не найден', requestId);
      return;
    }

    fs.rmSync(backupDir, { recursive: true, force: true });
    logger.info(`Deleted backup v${version} for project ${project.slug}`, { requestId, projectId });

    res.json({ message: `Версия ${version} удалена` });
  } catch (err) {
    logger.error('Delete version error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// List project files
router.get('/:id/files', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) {
      sendError(res, 404, 'Проект не найден', requestId);
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
      sendError(res, 400, 'Недопустимый путь', requestId);
      return;
    }

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      sendError(res, 404, 'Директория не найдена', requestId);
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
    logger.error('List files error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
