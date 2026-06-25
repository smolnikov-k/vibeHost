import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    const dir = config.uploadDir;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIMES = [
  'application/zip', 'application/x-zip-compressed',
  'application/gzip', 'application/x-gzip', 'application/x-tar',
  'application/x-compressed-tar', 'application/x-tgz',
];
const ALLOWED_EXTS = ['.zip', '.tar.gz', '.tgz'];

function fileFilter(_req: any, file: any, cb: any) {
  const name = file.originalname.toLowerCase();
  if (ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTS.some(ext => name.endsWith(ext))) {
    cb(null, true);
  } else {
    cb(new Error('Только ZIP или TAR.GZ архивы'));
  }
}

export const uploadZip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max (checked per plan in route)
  },
});
