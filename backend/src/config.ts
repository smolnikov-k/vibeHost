function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '7001', 10),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: '7d',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/4',

  // File storage
  uploadDir: process.env.UPLOAD_DIR || '/var/www/vibe-hosting/uploads',
  sitesDir: process.env.SITES_DIR || '/var/www/vibe-hosting/sites',
  backupsDir: process.env.BACKUPS_DIR || '/var/www/vibe-hosting/backups',

  // CORS — explicit origin list (no wildcards); override via CORS_ORIGINS env var (JSON array)
  corsOrigins: (() => {
    const fallback = ['https://hostingvibe.ru', 'https://www.hostingvibe.ru'];
    try { return JSON.parse(process.env.CORS_ORIGINS || JSON.stringify(fallback)); }
    catch { return fallback; }
  })(),

  // Limits
  free: {
    maxProjects: 1,
    maxSiteSize: 100 * 1024 * 1024,     // 100 MB
    maxTotalStorage: 100 * 1024 * 1024,  // 100 MB
    maxVersions: 3,
    maxQrCodes: 1,
  },
  pro: {
    maxProjects: 3,
    maxSiteSize: 500 * 1024 * 1024,     // 500 MB
    maxTotalStorage: 500 * 1024 * 1024,  // 500 MB
    maxVersions: 15,
    maxQrCodes: 30,
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
    subscriptionId: process.env.PRODAMUS_SUBSCRIPTION_ID || '',
    demoMode: process.env.PRODAMUS_DEMO_MODE === '1',
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

  // Server IP (for DNS A-record instructions)
  serverIp: process.env.SERVER_IP || '203.0.113.10',

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'https://hostingvibe.ru',

  // Backend API URL (used for webhook notification URLs sent to payment providers)
  backendUrl: process.env.BACKEND_URL || 'https://api.hostingvibe.ru',

  // Nginx
  nginxSitesAvailable: '/etc/nginx/sites-available',
  nginxSitesEnabled: '/etc/nginx/sites-enabled',
  certbotWebroot: '/root/vibecode/certbot_webroot',
  adminEmail: 'admin@hostingvibe.ru',
} as const;
