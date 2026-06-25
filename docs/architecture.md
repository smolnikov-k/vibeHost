# Архитектура VibeHosting

## Срез на 2026-03-14

Репозиторий разделён на два runtime-модуля:

- `frontend/` — Next.js 16 + React 19, пользовательский сайт и кабинет.
- `backend/` — Express API на TypeScript с Prisma/PostgreSQL и Redis rate limit.

Production-топология:

- frontend: `127.0.0.1:7002`
- backend: `127.0.0.1:7001`
- Nginx: reverse proxy для `hostingvibe.ru` и wildcard-хостинг для `*.hostingvibe.ru`
- PM2: процессы `vibe-frontend` и `vibe-backend`

## Frontend

Основные публичные маршруты:

- `/` — лендинг продукта.
- `/gallery` — публичная галерея опубликованных проектов.
- `/docs` — пользовательская документация по деплою.
- `/ai` — готовый prompt для AI-ассистентов.
- `/llms.txt` — машиночитаемая версия deploy docs.
- `/offer`, `/privacy`, `/terms` — legal-страницы.

Auth-маршруты:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

Dashboard:

- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/projects/[id]/analytics`
- `/projects/[id]/edit`
- `/domains`
- `/billing`
- `/billing/success`
- `/settings`

Admin:

- `/admin`
- `/admin/users`
- `/admin/projects`
- `/admin/reports`

Ключевые frontend-модули:

- `src/lib/api.ts` — единый API client.
- `src/lib/auth.tsx` — auth context и инициализация текущего пользователя.
- `src/middleware.ts` — защита dashboard/auth страниц по cookie `vibe_token`.
- `src/components/editor/*` — визуальный редактор и style controls.
- `src/components/landing/*` — лендинг и маркетинговые секции.

## Backend

API собирается в `backend/src/app/create-app.ts`.

Публичные группы API:

- `/api/health` — health check DB/storage/SMTP.
- `/api/slugs/check` — проверка slug.
- `/api/track` и `/api/vibe-analytics.js` — встроенная аналитика.
- `/api/vibe-forms.js`, `/api/vibe-editor-bridge.js`, `/api/vibe-patches.js` — публичные ассеты платформы.
- `/api/forms/:slug` — сбор form submissions.
- `/api/gallery/*` — публичная галерея и лайки.
- `/api/report` — abuse reports.
- `/api/auth/*` — register/login/me/forgot-password/reset-password/change-password/profile/logout/delete-account.
- `/api/site-auth`, `/api/site-context`, `/api/site-gate/:slug` — парольная защита сайтов и host-mapping.
- `/api/internal/preview` — preview flow для editor.
- `/api/unsubscribe` — opt-out из email-коммуникаций.

Защищённые группы API:

- `/api/projects/*` — CRUD проектов, deploy, rollback, analytics, editor/patches, export, file browser.
- `/api/domains/*` — подключение и верификация кастомных доменов.
- `/api/billing/*` — статус подписки, платёжные ссылки, webhook, отмена.
- `/api/telegram/*` — линк Telegram и просмотр лидов.
- `/api/admin/*` — админская статистика, пользователи, проекты, репорты.

## Деплой-пайплайн

Поддерживаемые входы:

- архив `.zip`
- архив `.tar.gz` / `.tgz`
- публичный GitHub-репозиторий

Архивный деплой:

1. Загрузка архива в `UPLOAD_DIR`.
2. Валидация размера, количества файлов, forbidden extensions, path traversal.
3. Распаковка.
4. Если найден `package.json` со скриптом `build`, запускается:
   - `npm ci` или `npm install`
   - `npm run build`
5. Ищется build output с `index.html` в `dist/`, `build/`, `out/` или `.output/public/`.
6. Сайт атомарно публикуется в `SITES_DIR/<slug>`.
7. В HTML автоматически инжектятся:
   - `vibe-forms.js`
   - `vibe-patches.js`
   - `vibe-analytics.js`
   - Yandex.Metrika, если у проекта задан `metrikaId`

GitHub deploy:

- принимает только публичный `https://github.com/<owner>/<repo>`
- build не запускается
- backend ищет уже готовый `index.html` в корне, `dist/`, `build/`, `public/`, `out/`, `docs/`, `_site/` или в переданной `subdir`

Rollback:

- доступен только для PRO
- использует бэкапы из `BACKUPS_DIR/<slug>/v<version>`

## Данные

Основные модели Prisma:

- `User`
- `Project`
- `Deployment`
- `Domain`
- `Subscription`
- `ProjectLike`
- `PageView`
- `Report`
- `TelegramLink`
- `FormSubmission`
- `EditorPage`
- `PasswordReset`
- `EmailEvent`
- `PaymentEvent`
- `VisualPatch`

Product-ограничения, зашитые в config:

- Free: `1` проект, `50 MB` на сайт, `50 MB` total storage
- Pro: `3` проекта, `500 MB` на сайт, `1 GB` total storage
- максимум `5000` файлов на деплой
- деплой-лимит: `5` операций в час на проектный endpoint

## Фоновая работа

Backend при старте поднимает:

- cleanup worker
- engagement worker
- Telegram bot

Также используются:

- Prisma singleton
- Redis client
- централизованный `winston` logger

## Инфраструктурные зависимости

- PostgreSQL
- Redis
- PM2
- Nginx
- Let’s Encrypt / Certbot
- SMTP
- Prodamus
- Telegram Bot API

## Что считать источником правды

- API-контракт: `backend/src/routes/*`
- продуктовые лимиты и env defaults: `backend/src/config.ts`
- production-process topology: `ecosystem.config.js`
- публичные ограничения деплоя: `/docs`, `/llms.txt`, `frontend/src/lib/ai-prompt.ts`
