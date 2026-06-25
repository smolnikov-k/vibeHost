import { spawnSync } from 'child_process';

/** Safely set www-data ownership and permissions on a directory */
export function setNginxPermissions(dirPath: string): void {
  spawnSync('chown', ['-R', 'www-data:www-data', dirPath], { stdio: 'pipe' });
  spawnSync('find', [dirPath, '-type', 'd', '-exec', 'chmod', '755', '{}', '+'], { stdio: 'pipe' });
  spawnSync('find', [dirPath, '-type', 'f', '-exec', 'chmod', '644', '{}', '+'], { stdio: 'pipe' });
}

/** Safely clone a git repo (no shell interpolation) */
export function gitCloneShallow(repoUrl: string, targetDir: string, timeoutMs = 60000): void {
  const result = spawnSync('git', ['clone', '--depth', '1', '--single-branch', repoUrl, targetDir], {
    timeout: timeoutMs,
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().slice(0, 500) || 'Unknown error';
    throw new Error(`git clone failed: ${stderr}`);
  }
}
