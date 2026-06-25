# Эксплуатация VibeHosting

## Локальная разработка

### Backend

1. Создать `backend/.env` на базе [`backend/.env.example`](../backend/.env.example).
2. Подготовить PostgreSQL и Redis.
3. Запустить:

```bash
cd /root/vibecode/vibe-hosting/backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

### Frontend

```bash
cd /root/vibecode/vibe-hosting/frontend
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:7001/api npm run dev
```

### Ручные проверки

```bash
curl http://127.0.0.1:7001/api/health
curl http://127.0.0.1:7001/api/gallery
```

## Основные env-переменные backend

Обязательные:

- `DATABASE_URL`
- `JWT_SECRET`

Часто используемые:

- `PORT`, `HOST`
- `REDIS_URL`
- `UPLOAD_DIR`, `SITES_DIR`, `BACKUPS_DIR`
- `CORS_ORIGINS`
- `FRONTEND_URL`
- `SERVER_IP`

Почта и уведомления:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Платежи:

- `PRODAMUS_PAYFORM_URL`
- `PRODAMUS_SECRET_KEY`
- `PRODAMUS_SYSTEM_CODE`

Telegram:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`

## Production topology

PM2:

- `vibe-backend` — cwd `backend/`, script `dist/index.js`, порт `7001`
- `vibe-frontend` — cwd `frontend/`, `next start -p 7002 -H 127.0.0.1`

Nginx:

- `hostingvibe.ru` и `www.hostingvibe.ru` обслуживают frontend + `/api`
- `*.hostingvibe.ru` обслуживают опубликованные сайты из `SITES_DIR`
- password-protected сайты используют `auth_request` в `/api/site-auth`

Ключевые production-файлы:

- [`ecosystem.config.js`](../ecosystem.config.js)
- [`nginx-hostingvibe.ru`](../nginx-hostingvibe.ru)

## Деплой приложения

Ручной production-flow хранится в [`scripts/deploy.sh`](../scripts/deploy.sh).

Что делает скрипт:

1. билдит frontend
2. применяет `prisma migrate deploy`
3. билдит backend
4. перезапускает PM2
5. выполняет post-deploy health check

Базовые команды:

```bash
cd /root/vibecode/vibe-hosting
./scripts/deploy.sh
./scripts/deploy.sh rollback
```

После ручного релиза удобно дополнительно проверить:

```bash
pm2 status
curl -i http://127.0.0.1:7001/api/health
curl -I https://hostingvibe.ru
```

## Бэкапы и мониторинг

Бэкап БД:

- скрипт: [`scripts/backup-db.sh`](../scripts/backup-db.sh)
- сохраняет gzipped `pg_dump`
- retention: `14` дней

Мониторинг:

- скрипт: [`scripts/monitor.sh`](../scripts/monitor.sh)
- проверяет backend, frontend, внешний сайт, PostgreSQL, Redis, PM2, диск и swap
- для Telegram-алертов предпочтительно передавать `VIBE_TELEGRAM_BOT_TOKEN` и `VIBE_TELEGRAM_CHAT_ID` через env

## Операционные runbook'и

Точечные billing runbook'и хранятся в:

- [`backend/docs/runbooks/billing-price-normalization.md`](../backend/docs/runbooks/billing-price-normalization.md)
- [`backend/docs/runbooks/billing-price-rub-fix.md`](../backend/docs/runbooks/billing-price-rub-fix.md)

## Что не путать с runtime docs

- `reports/` — аудиты и анализы
- `QA_*`, `payment-integration-test-report.md` — QA и тестовые артефакты
- `TODO-PRODAMUS-FIX.md`, `REPORT-PRODAMUS-AUDIT-2026-03-14.md` — отдельный поток работ по Prodamus

Эти файлы важны как история, но текущую эксплуатацию и контракт приложения лучше сверять по документам в `docs/` и по исходникам.
