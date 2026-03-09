module.exports = {
  apps: [
    {
      name: 'vibe-backend',
      cwd: '/root/vibecode/vibe-hosting/backend',
      script: 'dist/index.js',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      wait_ready: false,
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
        // Secrets (JWT_SECRET, DATABASE_URL, PRODAMUS_*, TELEGRAM_*) load from backend/.env via dotenv
        UPLOAD_DIR: '/var/www/vibe-hosting/uploads',
        SITES_DIR: '/var/www/vibe-hosting/sites',
        BACKUPS_DIR: '/var/www/vibe-hosting/backups',
        CORS_ORIGINS: '["https://hostingvibe.ru","http://localhost:7002","http://localhost:3000"]',
      },
    },
    {
      name: 'vibe-frontend',
      cwd: '/root/vibecode/vibe-hosting/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 7002',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 7002,
        NEXT_PUBLIC_API_URL: 'https://hostingvibe.ru/api',
        NEXT_PUBLIC_SITE_URL: 'https://hostingvibe.ru',
      },
    },
  ],
};
