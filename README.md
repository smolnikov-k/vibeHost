# VibeHosting

VibeHosting — платформа для публикации статических сайтов с личным кабинетом, деплоем архивов и публичных GitHub-репозиториев, встроенной аналитикой, формами, визуальными патчами, кастомными доменами и PRO-биллингом.

## Что в проекте сейчас

- `frontend/` — Next.js 16 приложение: лендинг, auth, dashboard, gallery, `/docs`, `/ai`, legal-страницы и admin-раздел.
- `backend/` — Express + Prisma API: auth, projects, deploy, billing, domains, analytics, gallery, forms, Telegram, admin.
- `docs/` — актуальные внутренние документы по архитектуре, эксплуатации и модульному аудиту.
- `scripts/` — production-скрипты деплоя, мониторинга, бэкапов и инфраструктурной настройки.
- `backend/docs/runbooks/` — точечные runbook'и для billing-фиксов.

## Ключевые возможности

- Архивный деплой через `.zip`, `.tar.gz` или `.tgz`.
- Автосборка исходников, если в архиве есть `package.json` со скриптом `build`.
- GitHub deploy из публичного репозитория с уже готовым `index.html`.
- Публикация на `slug.hostingvibe.ru`, кастомные домены на PRO.
- Встроенная аналитика просмотров и публичная галерея проектов.
- Формы с автоинжектом `vibe-forms.js` и отправкой лидов в Telegram.
- Парольная защита сайта, визуальные патчи и редактор.
- PRO-подписка и AI-паки через Prodamus webhook.

## Текущая структура

```text
.
├── backend/
│   ├── docs/runbooks/
│   ├── prisma/
│   ├── scripts/sql/
│   └── src/
├── docs/
├── frontend/
│   └── src/
├── scripts/
├── ecosystem.config.js
└── nginx-hostingvibe.ru
```

## Локальный запуск

### 1. Backend

Предусловия:

- PostgreSQL
- Redis
- заполненный `backend/.env`
- доступные директории для `UPLOAD_DIR`, `SITES_DIR`, `BACKUPS_DIR`

```bash
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

По умолчанию backend стартует на `127.0.0.1:7001`.

### 2. Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:7001/api npm run dev
```

По умолчанию frontend стартует на `http://localhost:7002`.

### 3. Быстрые проверки

```bash
curl http://127.0.0.1:7001/api/health
curl http://127.0.0.1:7001/api/gallery
open http://localhost:7002
```

## Production topology

- `vibe-backend` — PM2, порт `7001`, entrypoint `backend/dist/index.js`
- `vibe-frontend` — PM2, порт `7002`, `next start`
- Nginx проксирует:
  - `/api/*` -> backend
  - `/` -> frontend
  - `*.hostingvibe.ru` -> опубликованные сайты
- PM2-конфиг хранится в [`ecosystem.config.js`](./ecosystem.config.js)
- Nginx-конфиг хранится в [`nginx-hostingvibe.ru`](./nginx-hostingvibe.ru)

## Где смотреть документацию

- Архитектура: [`docs/architecture.md`](./docs/architecture.md)
- Структура проекта и карта зависимостей: [`docs/project-structure.md`](./docs/project-structure.md)
- Эксплуатация и деплой: [`docs/operations.md`](./docs/operations.md)
- Актуальный модульный аудит: [`docs/module-audit-2026-03-14.md`](./docs/module-audit-2026-03-14.md)
- Публичная документация для пользователей: [`frontend/src/app/docs/page.tsx`](./frontend/src/app/docs/page.tsx)
- Машиночитаемая документация для AI: [`frontend/src/app/llms.txt/route.ts`](./frontend/src/app/llms.txt/route.ts)
- AI prompt: [`frontend/src/lib/ai-prompt.ts`](./frontend/src/lib/ai-prompt.ts)

## Полезные команды

```bash
# backend build
cd backend && npm run build

# frontend build
cd frontend && npm run build

# production deploy flow
./scripts/deploy.sh

# PM2
pm2 status
pm2 logs vibe-backend
pm2 logs vibe-frontend
```

## Важно

- Актуальный runtime-контракт смотрим по коду в `backend/src/*`, `frontend/src/*` и документам в `docs/`.
- Аудит-файлы (`*_AUDIT*.md`, `QA_*`) полезны как история изменений, но не заменяют текущую документацию проекта.

## Конфигурация и секреты

- Все секреты (`JWT_SECRET`, `DATABASE_URL`, `SMTP_*`, `PRODAMUS_*`, `TELEGRAM_*`, `SERVER_IP`) задаются только через переменные окружения / `backend/.env`.
- Шаблон — [`backend/.env.example`](./backend/.env.example). Никогда не коммитьте реальный `.env`.
- Скрипт мониторинга требует `VIBE_TELEGRAM_BOT_TOKEN` и `VIBE_TELEGRAM_CHAT_ID` в окружении.

## Лицензия

[MIT](./LICENSE) © 2026 Kirill Smolnikov
