# VibeHosting — Обзор проекта

## Что это
Хостинг-платформа для мгновенной публикации сайтов. Пользователь загружает ZIP/HTML → получает сайт на `slug.hostingvibe.ru`. Визуальный редактор, QR-коды, защита паролем, кастомные домены, аналитика.

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Express.js + TypeScript, port 7001 |
| Frontend | Next.js 16 + App Router + Tailwind v4, port 7002 |
| БД | PostgreSQL 16, ORM Prisma |
| Кэш | Redis (db 4) — rate limiting |
| Файлы | `/var/www/vibe-hosting/{sites,uploads,backups}` |
| PM2 | `vibe-backend`, `vibe-frontend` |
| Платежи | Prodamus (386₽/мес PRO) |
| Email | Nodemailer → smtp.yandex.ru:465 |
| Telegram бот | @Vibehostingbot — уведомления о формах |

## Тарифы

| | FREE | PRO (386₽/мес) |
|-|------|----------------|
| Сайты | 1 | 3 |
| Размер | 50MB total | 500MB per deploy, 1GB total |
| Срок жизни | 30 дней | Бессрочно |
| Кастомные домены | Нет | Да |
| Backup версий | Нет | Да |
| AI-кредиты | 10 | 10 (докупаются пакетами) |

## ENV-переменные (backend)

Обязательные: `DATABASE_URL`, `JWT_SECRET`
Платежи: `PRODAMUS_PAYFORM_URL`, `PRODAMUS_SECRET_KEY`
Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
SMTP: `SMTP_HOST/PORT/USER/PASS/FROM`
Frontend URL: `FRONTEND_URL=https://hostingvibe.ru`

## Серверы

| Сервер | IP | Роль |
|--------|------|------|
| Production | 213.159.209.228 | Основной (hostingvibe.ru) |
| Dev | 213.139.229.139 | Разработка (все проекты Кирилла) |
