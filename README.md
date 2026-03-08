# VibeHost

VibeHost — платформа для быстрого деплоя статических сайтов и фронтенд-проектов (HTML/CSS/JS, React/Vite/Next build output) с доменами, SSL, формами и базовой аналитикой.

## Стек

- **Frontend:** Next.js (TypeScript)
- **Backend:** Node.js + Express (TypeScript)
- **DB:** PostgreSQL (Prisma)
- **Infra:** Nginx, PM2, Let's Encrypt

## Структура

- `frontend/` — публичный сайт + личный кабинет
- `backend/` — API, деплой, биллинг, формы, сервисные воркеры
- `reports/` — аудиты и внутренние отчёты

## Локальный запуск

### 1) Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

## Production

Запуск/перезапуск через PM2 и reverse proxy через Nginx.
Основной домен: `https://hostingvibe.ru`

## Полезные команды

```bash
# статус PM2
pm2 status

# логи backend
pm2 logs vibe-backend

# логи frontend
pm2 logs vibe-frontend

# проверка API health
curl -s -o /dev/null -w "%{http_code}\n" https://hostingvibe.ru/api/health
```

## Примечания

- Для прод-изменений сначала фиксируйте миграции Prisma и проверяйте health-check.
- Перед релизом проверяйте legal/SEO блоки (robots, sitemap, canonical, privacy/offer/terms).
