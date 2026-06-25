import { Router, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { logAdminAction } from '../services/audit.service';
import logger from '../services/logger';

const execFileAsync = promisify(execFile);
const router = Router();

const BACKUP_DIR = '/var/www/vibe-hosting/backups/db';
const FILENAME_REGEX = /^backup_[\d_-]+\.(gz|dump|sql)$/;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function parseDatabaseUrl(url: string) {
  // postgresql://user:password@host:port/db
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/);
  if (!m) throw new Error('Invalid DATABASE_URL format');
  return { user: m[1], password: m[2], host: m[3], port: m[4], database: m[5] };
}

// GET / — list backups
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUP_DIR).filter(f => FILENAME_REGEX.test(f));
    const backups = files.map(name => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
    });

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ backups });
  } catch (err) {
    logger.error('Admin backups list error:', err);
    res.status(500).json({ error: 'Ошибка получения списка бэкапов' });
  }
});

// POST /create — create backup
router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup_${timestamp}.dump`;
    const filepath = path.join(BACKUP_DIR, filename);

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      res.status(500).json({ error: 'DATABASE_URL не настроен' });
      return;
    }

    const db = parseDatabaseUrl(dbUrl);

    await execFileAsync('pg_dump', [
      '-Fc',
      '-h', db.host,
      '-p', db.port,
      '-U', db.user,
      '-f', filepath,
      db.database,
    ], {
      timeout: 60000,
      env: { ...process.env, PGPASSWORD: db.password },
    });

    const stat = fs.statSync(filepath);
    const backup = { name: filename, size: stat.size, createdAt: stat.mtime.toISOString() };

    await logAdminAction(req.userId!, 'create_backup', 'backup', undefined, { filename, size: formatSize(stat.size) });
    logger.info(`Backup created: ${filename} (${formatSize(stat.size)})`);

    res.json({ backup });
  } catch (err) {
    logger.error('Admin backup create error:', err);
    res.status(500).json({ error: 'Ошибка создания бэкапа' });
  }
});

// GET /:filename/download — download backup
router.get('/:filename/download', async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;

    if (!FILENAME_REGEX.test(filename)) {
      res.status(400).json({ error: 'Некорректное имя файла' });
      return;
    }

    const filepath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }

    res.download(filepath);
  } catch (err) {
    logger.error('Admin backup download error:', err);
    res.status(500).json({ error: 'Ошибка скачивания бэкапа' });
  }
});

export default router;
