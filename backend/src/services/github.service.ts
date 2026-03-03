import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { getPlanLimits } from '../utils/limits';
import { config } from '../config';
import { setNginxPermissions, gitCloneShallow } from '../utils/shell';
import { injectVibeFormsScript, injectVibePatchesScript, injectYandexMetrika } from './deploy.service';

/**
 * Clone a public GitHub repo, find the directory with index.html,
 * and deploy it as a new version.
 */
export async function processGithubDeploy(
  projectId: string,
  repoUrl: string,
  subdir?: string,
  existingDeploymentId?: string,
): Promise<{ version: number; fileCount: number; sizeBytes: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { user: true },
  });
  if (!project) throw new Error('Проект не найден');

  const limits = getPlanLimits(project.user.plan);
  const cloneDir = path.join('/tmp', `vibe-github-${project.id}-${Date.now()}`);

  try {
    // Clone (shallow, single branch — safe: no shell interpolation)
    gitCloneShallow(repoUrl, cloneDir);

    // Remove .git folder
    const dotGit = path.join(cloneDir, '.git');
    if (fs.existsSync(dotGit)) {
      fs.rmSync(dotGit, { recursive: true, force: true });
    }

    // Find root with index.html
    let deployRoot = cloneDir;
    if (subdir) {
      const custom = path.resolve(cloneDir, subdir);
      // Prevent path traversal outside the clone directory
      if (!custom.startsWith(cloneDir + '/')) {
        throw new Error('Недопустимый путь поддиректории');
      }
      if (fs.existsSync(path.join(custom, 'index.html'))) {
        deployRoot = custom;
      } else {
        throw new Error(`index.html не найден в /${subdir}`);
      }
    } else {
      deployRoot = findIndexHtmlRoot(cloneDir);
    }

    // Check for forbidden files
    const allFiles = listAllFiles(deployRoot);
    for (const f of allFiles) {
      const ext = path.extname(f).toLowerCase();
      if ((config.forbiddenExtensions as readonly string[]).includes(ext)) {
        throw new Error(`Запрещённый тип файла: ${ext}`);
      }
    }

    // Calculate size
    const totalSize = allFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(f).size; } catch { return sum; }
    }, 0);

    if (totalSize > limits.maxSiteSize) {
      throw new Error(
        `Размер превышает лимит (${Math.round(totalSize / 1024 / 1024)} МБ > ${Math.round(limits.maxSiteSize / 1024 / 1024)} МБ)`
      );
    }

    if (allFiles.length > config.maxFileCount) {
      throw new Error(`Слишком много файлов: ${allFiles.length} > ${config.maxFileCount}`);
    }

    // Update project status
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'PROCESSING' },
    });

    const newVersion = project.currentVersion + 1;

    // Use pre-created deployment or create one (backward compat)
    let deployment;
    if (existingDeploymentId) {
      deployment = await prisma.deployment.update({
        where: { id: existingDeploymentId },
        data: { status: 'EXTRACTING', version: newVersion },
      });
    } else {
      deployment = await prisma.deployment.create({
        data: {
          projectId: project.id,
          version: newVersion,
          status: 'EXTRACTING',
          zipHash: `github:${repoUrl}`,
        },
      });
    }

    const siteDir = path.join(config.sitesDir, project.slug);

    // Backup old version (PRO only)
    if (fs.existsSync(siteDir) && project.user.plan === 'PRO') {
      const backupDir = path.join(config.backupsDir, project.slug, `v${project.currentVersion}`);
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
      fs.renameSync(siteDir, backupDir);
    } else if (fs.existsSync(siteDir)) {
      fs.rmSync(siteDir, { recursive: true, force: true });
    }

    // Copy deploy root to site directory
    fs.cpSync(deployRoot, siteDir, { recursive: true });

    // Inject vibe-forms, patches, and Metrika (same as ZIP deploy pipeline)
    injectVibeFormsScript(siteDir, project.slug, project.metrikaId);
    injectVibePatchesScript(siteDir, project.slug);
    if (project.metrikaId) {
      injectYandexMetrika(siteDir, project.metrikaId);
    }

    // Set permissions for Nginx (safe — no shell interpolation)
    try { setNginxPermissions(siteDir); } catch { /* non-critical */ }

    // Mark previous deployments as superseded
    await prisma.deployment.updateMany({
      where: { projectId: project.id, status: 'LIVE', id: { not: deployment.id } },
      data: { status: 'SUPERSEDED' },
    });

    // Update deployment
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: 'LIVE',
        sizeBytes: totalSize,
        fileCount: allFiles.length,
      },
    });

    // Update project
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'LIVE',
        sizeBytes: totalSize,
        fileCount: allFiles.length,
        currentVersion: newVersion,
        publishedAt: new Date(),
      },
    });

    // Recalculate user storage
    const allProjects = await prisma.project.findMany({
      where: { userId: project.user.id },
      select: { sizeBytes: true },
    });
    const totalStorage = allProjects.reduce((sum, p) => sum + Number(p.sizeBytes), 0);
    await prisma.user.update({
      where: { id: project.user.id },
      data: { storageUsed: totalStorage },
    });

    return { version: newVersion, fileCount: allFiles.length, sizeBytes: totalSize };
  } finally {
    // Cleanup clone directory
    if (fs.existsSync(cloneDir)) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }
  }
}

/**
 * Find the directory containing index.html.
 * Priority: root > /dist > /build > /public > /out > first subdir with index.html
 */
function findIndexHtmlRoot(dir: string): string {
  // Check root first
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    return dir;
  }

  // Check common build output directories
  const commonDirs = ['dist', 'build', 'public', 'out', 'docs', '_site'];
  for (const d of commonDirs) {
    const candidate = path.join(dir, d);
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  // Recursive scan (max 2 levels deep)
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const subdir = path.join(dir, entry.name);
      if (fs.existsSync(path.join(subdir, 'index.html'))) {
        return subdir;
      }
      // Level 2
      try {
        const subEntries = fs.readdirSync(subdir, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isDirectory() && !sub.name.startsWith('.')) {
            const deep = path.join(subdir, sub.name);
            if (fs.existsSync(path.join(deep, 'index.html'))) {
              return deep;
            }
          }
        }
      } catch {
        // skip unreadable
      }
    }
  }

  throw new Error('index.html не найден в репозитории. Укажите поддиректорию.');
}

/**
 * Recursively list all files in a directory.
 */
function listAllFiles(dir: string): string[] {
  const result: string[] = [];
  const walk = (d: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        result.push(full);
      }
    }
  };
  walk(dir);
  return result;
}
