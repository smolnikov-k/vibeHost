import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

export interface ZipValidationResult {
  valid: boolean;
  error?: string;
  totalSize: number;
  fileCount: number;
  hasIndex: boolean;
  rootPrefix: string; // e.g. '' or 'dist/' if all files are in a subfolder
}

export function validateZip(zipPath: string, maxSize: number): ZipValidationResult {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  let totalSize = 0;
  let fileCount = 0;
  const filePaths: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;

    // Skip macOS resource fork junk (__MACOSX/)
    if (entryName.startsWith('__MACOSX/') || entryName.startsWith('.__')) continue;

    // Path traversal check
    if (entryName.includes('..') || entryName.startsWith('/')) {
      return { valid: false, error: `Запрещённый путь в архиве: ${entryName}`, totalSize: 0, fileCount: 0, hasIndex: false, rootPrefix: '' };
    }

    // Forbidden file extensions (block entire deploy)
    const ext = path.extname(entryName).toLowerCase();
    if (config.forbiddenExtensions.includes(ext)) {
      return { valid: false, error: `Запрещённый тип файла: ${ext}`, totalSize: 0, fileCount: 0, hasIndex: false, rootPrefix: '' };
    }

    // Ignored files — silently skip (don't count toward size/fileCount)
    const baseName = path.basename(entryName);
    if (config.ignoredFiles.includes(baseName) || config.ignoredFiles.includes(ext)) {
      continue;
    }

    totalSize += entry.header.size;
    fileCount++;
    filePaths.push(entryName);

    // File count limit
    if (fileCount > config.maxFileCount) {
      return { valid: false, error: `Слишком много файлов (макс. ${config.maxFileCount})`, totalSize, fileCount, hasIndex: false, rootPrefix: '' };
    }

    // Size limit
    if (totalSize > maxSize) {
      return { valid: false, error: `Размер превышает лимит (${Math.round(maxSize / 1024 / 1024)} МБ)`, totalSize, fileCount, hasIndex: false, rootPrefix: '' };
    }
  }

  // Compression ratio check (ZIP bomb protection)
  const zipFileSize = fs.statSync(zipPath).size;
  if (zipFileSize > 0 && totalSize / zipFileSize > config.maxCompressionRatio) {
    return { valid: false, error: 'Подозрительный коэффициент сжатия', totalSize, fileCount, hasIndex: false, rootPrefix: '' };
  }

  // Check for index.html - either in root or in a single subfolder
  const hasRootIndex = filePaths.includes('index.html');

  // Detect if all files are inside a single subfolder (e.g. dist/, build/, out/)
  let rootPrefix = '';
  if (!hasRootIndex) {
    const topDirs = new Set<string>();
    for (const fp of filePaths) {
      const firstPart = fp.split('/')[0];
      topDirs.add(firstPart);
    }
    if (topDirs.size === 1) {
      const dir = [...topDirs][0];
      if (filePaths.includes(`${dir}/index.html`)) {
        rootPrefix = `${dir}/`;
      }
    }
  }

  const hasIndex = hasRootIndex || rootPrefix !== '';

  // If package.json with build script is present, index.html will appear after build
  const hasPackageJson = filePaths.some(fp => {
    const rel = rootPrefix ? fp.slice(rootPrefix.length) : fp;
    return rel === 'package.json';
  });

  if (!hasIndex && !hasPackageJson) {
    return { valid: false, error: 'Архив должен содержать index.html в корне или package.json для сборки', totalSize, fileCount, hasIndex: false, rootPrefix: '' };
  }

  return { valid: true, totalSize, fileCount, hasIndex: hasIndex || hasPackageJson, rootPrefix };
}

function shouldSkipFile(entryName: string): boolean {
  if (entryName.startsWith('__MACOSX/') || entryName.startsWith('.__')) return true;
  const baseName = path.basename(entryName);
  const ext = path.extname(entryName).toLowerCase();
  return config.ignoredFiles.includes(baseName) || config.ignoredFiles.includes(ext);
}

export function extractZip(zipPath: string, destDir: string, rootPrefix: string): void {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (shouldSkipFile(entry.entryName)) continue;

    let relativePath = entry.entryName;
    if (rootPrefix) {
      if (!relativePath.startsWith(rootPrefix)) continue;
      relativePath = relativePath.slice(rootPrefix.length);
      if (!relativePath) continue;
    }

    const fullPath = path.join(destDir, relativePath);
    const resolved = path.resolve(fullPath);

    // Path traversal safety check
    if (!resolved.startsWith(path.resolve(destDir))) continue;

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, entry.getData());
  }
}
