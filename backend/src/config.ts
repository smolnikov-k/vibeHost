function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '7001', 10),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: '30d',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/4',

  // File storage
  uploadDir: process.env.UPLOAD_DIR || '/var/www/vibe-hosting/uploads',
  sitesDir: process.env.SITES_DIR || '/var/www/vibe-hosting/sites',
  backupsDir: process.env.BACKUPS_DIR || '/var/www/vibe-hosting/backups',

  // CORS
  corsOrigins: JSON.parse(process.env.CORS_ORIGINS || '["http://localhost:3000","http://localhost:7002","https://hostingvibe.ru"]'),

  // Limits
  free: {
    maxProjects: 1,
    maxSiteSize: 50 * 1024 * 1024,     // 50 MB
    maxTotalStorage: 50 * 1024 * 1024,  // 50 MB
  },
  pro: {
    maxProjects: 3,
    maxSiteSize: 500 * 1024 * 1024,     // 500 MB
    maxTotalStorage: 1024 * 1024 * 1024, // 1 GB
  },

  // ZIP safety limits
  maxFileCount: 5000,
  maxCompressionRatio: 100,
  // Extensions that block the entire deploy (dangerous server-side code)
  forbiddenExtensions: [
    '.php', '.exe', '.sh', '.py', '.cgi', '.htaccess', '.bat', '.cmd',
    '.pl', '.jsp', '.asp', '.aspx', '.rb',
  ] as string[],

  // Files/patterns silently skipped during extraction (harmless but unnecessary)
  ignoredFiles: [
    '.env', '.git', '.gitignore', '.npmrc', '.dockerignore',
    '.DS_Store', 'Thumbs.db', '.gitkeep', '.gitattributes',
  ] as string[],

  // Reserved slugs
  reservedSlugs: [
    'www', 'api', 'admin', 'app', 'mail', 'ftp', 'static', 'cdn',
    'billing', 'support', 'help', 'blog', 'docs', 'status', 'gallery',
    'dashboard', 'login', 'register', 'settings', 'account',
  ] as string[],

  // Prodamus
  prodamus: {
    payformUrl: process.env.PRODAMUS_PAYFORM_URL || '',
    secretKey: process.env.PRODAMUS_SECRET_KEY || '',
    systemCode: process.env.PRODAMUS_SYSTEM_CODE || '',
  },

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.yandex.ru',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'VibeHosting <noreply@hostingvibe.ru>',
  },

  // Telegram bot
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'VibeHostingBot',
  },

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'https://hostingvibe.ru',

  // Nginx
  nginxSitesAvailable: '/etc/nginx/sites-available',
  nginxSitesEnabled: '/etc/nginx/sites-enabled',
  certbotWebroot: '/root/vibecode/certbot_webroot',
  adminEmail: 'admin@hostingvibe.ru',
} as const;
