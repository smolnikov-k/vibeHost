import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { prisma } from '../lib/prisma';
import { validateZip, extractZip } from '../utils/zip';
import { getPlanLimits } from '../utils/limits';
import { config } from '../config';
import { sendDeployNotification } from './email.service';
import { sendEmailOnce } from './email-events.service';
import { setNginxPermissions } from '../utils/shell';
import logger from './logger';

/** Known build output directories in priority order */
const BUILD_OUTPUT_DIRS = ['dist', 'build', 'out', '.output/public'];

/**
 * Detect if extracted dir is a source project that needs building.
 * Returns the build script name or null if no build needed.
 */
function detectBuildProject(dir: string): string | null {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.scripts?.build) return 'build';
    return null;
  } catch {
    return null;
  }
}

/**
 * Find the build output directory after running npm build.
 */
function findBuildOutput(dir: string): string | null {
  for (const outDir of BUILD_OUTPUT_DIRS) {
    const fullPath = path.join(dir, outDir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      // Verify it has index.html
      if (fs.existsSync(path.join(fullPath, 'index.html'))) {
        return fullPath;
      }
    }
  }
  return null;
}

/**
 * Run npm install + npm run build in the project directory.
 * Timeout: 3 minutes.
 */
function runBuild(dir: string): { success: boolean; error?: string } {
  // Safe env: only PATH and locale — never leak DATABASE_URL, JWT_SECRET, etc. to user code
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp',
    LANG: process.env.LANG || 'en_US.UTF-8',
    TERM: 'dumb',
  };
  const installOpts = { cwd: dir, timeout: 180_000, stdio: 'pipe' as const, env: { ...safeEnv, NODE_ENV: 'development' } };
  const buildOpts = { cwd: dir, timeout: 180_000, stdio: 'pipe' as const, env: { ...safeEnv, NODE_ENV: 'production' } };

  try {
    // Strip dangerous lifecycle hooks to prevent arbitrary code execution
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const dangerousHooks = ['preinstall', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack', 'postpack'];
    let hooksRemoved = false;
    for (const hook of dangerousHooks) {
      if (pkg.scripts?.[hook]) {
        delete pkg.scripts[hook];
        hooksRemoved = true;
      }
    }
    if (hooksRemoved) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    }

    // Install all dependencies (including devDeps for build tools)
    // --ignore-scripts prevents lifecycle hooks from running during install
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
      execSync('npm ci --no-audit --no-fund --ignore-scripts', installOpts);
    } else {
      execSync('npm install --no-audit --no-fund --ignore-scripts', installOpts);
    }

    // Run build explicitly (only the build script, not arbitrary lifecycle hooks)
    execSync('npm run build', buildOpts);

    return { success: true };
  } catch (err: any) {
    const stderr = err.stderr?.toString().slice(-500) || err.message;
    return { success: false, error: `Ошибка сборки: ${stderr}` };
  }
}

/**
 * Validate an already-extracted directory (for tar.gz archives).
 * Same checks as validateZip but on filesystem.
 */
function validateExtractedDir(dir: string, maxSize: number): { valid: boolean; error?: string; rootPrefix: string } {
  let totalSize = 0;
  let fileCount = 0;
  const filePaths: string[] = [];

  function walk(current: string, prefix: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.startsWith('__MACOSX') || entry.name.startsWith('.__')) continue;
      if (config.ignoredFiles.includes(entry.name)) continue;

      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), rel);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (config.forbiddenExtensions.includes(ext)) {
          throw new Error(`Запрещённый тип файла: ${ext}`);
        }
        if (config.ignoredFiles.includes(ext)) continue;

        const stat = fs.statSync(path.join(current, entry.name));
        totalSize += stat.size;
        fileCount++;
        filePaths.push(rel);

        if (fileCount > config.maxFileCount) throw new Error(`Слишком много файлов (макс. ${config.maxFileCount})`);
        if (totalSize > maxSize) throw new Error(`Размер превышает лимит (${Math.round(maxSize / 1024 / 1024)} МБ)`);
      }
    }
  }

  try {
    walk(dir, '');
  } catch (err: any) {
    return { valid: false, error: err.message, rootPrefix: '' };
  }

  // Detect single subfolder root
  const hasRootIndex = filePaths.includes('index.html');
  let rootPrefix = '';
  if (!hasRootIndex) {
    const topDirs = new Set(filePaths.map(fp => fp.split('/')[0]));
    if (topDirs.size === 1) {
      const d = [...topDirs][0];
      if (filePaths.includes(`${d}/index.html`)) rootPrefix = `${d}/`;
    }
  }

  const hasPackageJson = filePaths.some(fp => {
    const rel = rootPrefix ? fp.slice(rootPrefix.length) : fp;
    return rel === 'package.json';
  });

  if (!hasRootIndex && !rootPrefix && !hasPackageJson) {
    return { valid: false, error: 'Архив должен содержать index.html в корне или package.json для сборки', rootPrefix: '' };
  }

  return { valid: true, rootPrefix };
}

export async function processDeploy(deploymentId: string): Promise<void> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { project: { include: { user: true, domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } } } },
  });

  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

  const { project } = deployment;
  const user = project.user;
  const limits = getPlanLimits(user.plan);

  // Find the uploaded archive
  const uploadDir = config.uploadDir;
  const archiveFiles = fs.readdirSync(uploadDir).filter(f => f.includes(deploymentId));
  if (archiveFiles.length === 0) throw new Error('Archive file not found');
  const archivePath = path.join(uploadDir, archiveFiles[0]);
  const isTarGz = archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz');

  try {
    // Update status to EXTRACTING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'EXTRACTING' },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'PROCESSING' },
    });

    const tempDir = path.join('/tmp', `vibe-extract-${deploymentId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    if (isTarGz) {
      // Extract tar.gz via system tar, then validate extracted files
      const tarResult = spawnSync('tar', ['xzf', archivePath, '-C', tempDir], { timeout: 60_000, stdio: 'pipe' });
      if (tarResult.status !== 0) {
        await failDeploy(deploymentId, project.id, 'Ошибка распаковки архива');
        fs.rmSync(tempDir, { recursive: true, force: true });
        return;
      }
      const validation = validateExtractedDir(tempDir, limits.maxSiteSize);
      if (!validation.valid) {
        await failDeploy(deploymentId, project.id, validation.error!);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return;
      }
      // If files are in a single subfolder, move them up
      if (validation.rootPrefix) {
        const subDir = path.join(tempDir, validation.rootPrefix.replace(/\/$/, ''));
        const tmpMove = path.join('/tmp', `vibe-move-${deploymentId}`);
        fs.renameSync(subDir, tmpMove);
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.renameSync(tmpMove, tempDir);
      }
    } else {
      // ZIP flow
      const validation = validateZip(archivePath, limits.maxSiteSize);
      if (!validation.valid) {
        await failDeploy(deploymentId, project.id, validation.error!);
        return;
      }
      extractZip(archivePath, tempDir, validation.rootPrefix);
    }

    // Auto-build if source project detected (has package.json with build script)
    const buildScript = detectBuildProject(tempDir);
    let deployDir = tempDir;

    if (buildScript) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'BUILDING' },
      });
      logger.info(`Building project ${project.slug}...`);

      const buildResult = runBuild(tempDir);
      if (!buildResult.success) {
        await failDeploy(deploymentId, project.id, buildResult.error!);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return;
      }

      // Find build output (dist/, build/, out/)
      const outputDir = findBuildOutput(tempDir);
      if (!outputDir) {
        await failDeploy(deploymentId, project.id, 'Сборка прошла, но не найден index.html в dist/, build/ или out/');
        fs.rmSync(tempDir, { recursive: true, force: true });
        return;
      }

      // Move build output to a clean temp dir
      const buildTempDir = path.join('/tmp', `vibe-built-${deploymentId}`);
      fs.renameSync(outputDir, buildTempDir);
      fs.rmSync(tempDir, { recursive: true, force: true });
      deployDir = buildTempDir;

      logger.info(`Build complete for ${project.slug}, output: ${path.basename(outputDir)}`);
    }

    // Calculate final size and file count from deployDir
    let totalSize = 0;
    let fileCount = 0;
    const countFiles = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { countFiles(full); }
        else { totalSize += fs.statSync(full).size; fileCount++; }
      }
    };
    countFiles(deployDir);

    // Atomic swap
    const siteDir = path.join(config.sitesDir, project.slug);

    // Backup old version if it exists (PRO only)
    if (fs.existsSync(siteDir) && user.plan === 'PRO') {
      const backupDir = path.join(config.backupsDir, project.slug, `v${project.currentVersion}`);
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
      fs.renameSync(siteDir, backupDir);
    } else if (fs.existsSync(siteDir)) {
      fs.rmSync(siteDir, { recursive: true, force: true });
    }

    // Move files to site directory
    fs.renameSync(deployDir, siteDir);

    // Auto-inject vibe-forms.js into HTML files for Telegram form forwarding
    try { injectVibeFormsScript(siteDir, project.slug, project.metrikaId); } catch { /* non-critical */ }

    // Auto-inject vibe-patches.js for visual patches runtime
    try { injectVibePatchesScript(siteDir, project.slug); } catch { /* non-critical */ }

    // Auto-inject vibe-analytics.js for built-in analytics dashboard
    try { injectVibeAnalyticsScript(siteDir, project.slug); } catch { /* non-critical */ }

    // Auto-inject Yandex.Metrika counter if configured
    if (project.metrikaId) {
      try { injectYandexMetrika(siteDir, project.metrikaId); } catch { /* non-critical */ }
    }

    // Set permissions for Nginx (safe — no shell interpolation)
    try { setNginxPermissions(siteDir); } catch { /* non-critical */ }

    // Atomic: update deployment status, project, and recalculate storage in a single transaction
    await prisma.$transaction(async (tx) => {
      // Mark previous deployments as superseded
      await tx.deployment.updateMany({
        where: { projectId: project.id, status: 'LIVE', id: { not: deploymentId } },
        data: { status: 'SUPERSEDED' },
      });

      // Update deployment
      await tx.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'LIVE',
          sizeBytes: totalSize,
          fileCount: fileCount,
        },
      });

      // Update project (atomic increment to avoid race condition)
      await tx.project.update({
        where: { id: project.id },
        data: {
          status: 'LIVE',
          sizeBytes: totalSize,
          fileCount: fileCount,
          currentVersion: { increment: 1 },
          publishedAt: new Date(),
        },
      });

      // Recalculate user storage (single aggregate instead of findMany + reduce)
      const agg = await tx.project.aggregate({
        where: { userId: user.id },
        _sum: { sizeBytes: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { storageUsed: Number(agg._sum.sizeBytes || 0) },
      });
    });

    // Cleanup ZIP
    fs.unlinkSync(archivePath);

    // Deploy notification (idempotent fire-and-forget)
    const customDomain = project.domains[0]?.hostname ?? null;
    sendEmailOnce({
      dedupeKey: `deploy_live:deployment:${deployment.id}`,
      eventType: 'deploy_live',
      recipientEmail: user.email,
      userId: user.id,
      category: 'transactional',
      payload: { projectId: project.id, deploymentId: deployment.id, customDomain },
    }, () => sendDeployNotification(user.email, project.title, project.slug, customDomain)).catch(() => {});

  } catch (err) {
    await failDeploy(deploymentId, project.id, (err as Error).message);
    // Cleanup temp files
    for (const prefix of ['vibe-extract-', 'vibe-built-']) {
      const tmp = path.join('/tmp', `${prefix}${deploymentId}`);
      if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    }
    throw err;
  }
}

async function failDeploy(deploymentId: string, projectId: string, error: string): Promise<void> {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'FAILED', errorMessage: error },
  });
  // Only set project to ERROR if there's no existing LIVE deployment
  const hasLive = await prisma.deployment.findFirst({
    where: { projectId, status: 'LIVE', id: { not: deploymentId } },
  });
  if (!hasLive) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ERROR' },
    });
  }
}

/**
 * Inject vibe-forms.js into all HTML files in the site directory.
 * Adds a script tag before </body> that silently forwards form data to our API.
 */
export function injectVibeFormsScript(dir: string, slug: string, metrikaId?: string | null): void {
  const metrikaAttr = metrikaId ? ` data-metrika-id="${metrikaId.replace(/\D/g, '')}"` : '';
  const scriptTag = `<script src="https://hostingvibe.ru/api/vibe-forms.js" data-vibe-auto data-slug="${slug}"${metrikaAttr} defer></script>`;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          let html = fs.readFileSync(full, 'utf-8');
          if (html.includes('vibe-forms.js')) {
            // Replace any existing vibe-forms.js tag (may lack data-vibe-auto / data-slug)
            const oldTag = html.match(/<script[^>]*vibe-forms\.js[^>]*><\/script>/);
            if (oldTag && oldTag[0] !== scriptTag) {
              html = html.replace(oldTag[0], scriptTag);
              fs.writeFileSync(full, html);
            }
            continue;
          }
          if (html.includes('</body>')) {
            html = html.replace('</body>', scriptTag + '\n</body>');
            fs.writeFileSync(full, html);
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(dir);
}

/**
 * Inject vibe-patches.js into all HTML files in the site directory.
 * Applies visual patches (text, image, hide) at runtime on user sites.
 */
export function injectVibePatchesScript(dir: string, slug: string): void {
  const scriptTag = `<script src="https://hostingvibe.ru/api/vibe-patches.js" data-slug="${slug}" defer></script>`;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          let html = fs.readFileSync(full, 'utf-8');
          if (html.includes('vibe-patches.js')) continue;
          if (html.includes('</body>')) {
            html = html.replace('</body>', scriptTag + '\n</body>');
            fs.writeFileSync(full, html);
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(dir);
}

/**
 * Inject Yandex.Metrika counter into all HTML files if metrikaId is set.
 */
export function injectYandexMetrika(dir: string, metrikaId: string): void {
  const sanitized = metrikaId.replace(/\D/g, '');
  if (!sanitized) return;

  const scriptTag = `<!-- Yandex.Metrika counter -->\n<script type="text/javascript">\n   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};\n   m[i].l=1*new Date();\n   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}\n   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})\n   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");\n   ym(${sanitized}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });\n</script>\n<noscript><div><img src="https://mc.yandex.ru/watch/${sanitized}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>\n<!-- /Yandex.Metrika counter -->`;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          let html = fs.readFileSync(full, 'utf-8');
          if (html.includes('mc.yandex.ru/metrika')) continue;
          if (html.includes('</head>')) {
            html = html.replace('</head>', scriptTag + '\n</head>');
            fs.writeFileSync(full, html);
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(dir);
}

/**
 * Inject vibe-analytics.js into all HTML files for built-in analytics dashboard.
 */
export function injectVibeAnalyticsScript(dir: string, slug: string): void {
  const scriptTag = `<script src="https://hostingvibe.ru/api/vibe-analytics.js" data-slug="${slug}" defer></script>`;

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          let html = fs.readFileSync(full, 'utf-8');
          if (html.includes('vibe-analytics.js')) continue;
          if (html.includes('</body>')) {
            html = html.replace('</body>', scriptTag + '\n</body>');
            fs.writeFileSync(full, html);
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(dir);
}

export function deleteProjectFiles(slug: string): void {
  const siteDir = path.join(config.sitesDir, slug);
  const backupDir = path.join(config.backupsDir, slug);

  if (fs.existsSync(siteDir)) {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}
