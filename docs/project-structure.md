# Структура проекта VibeHosting

## Зачем нужен этот файл

Это навигационная карта проекта для разработчика и ИИ-ассистента.

Статус точности на `2026-03-15`:

- структура директорий сверена с реальным деревом репозитория
- ключевые entrypoint-файлы сверены по фактическому наличию
- route -> service / util зависимости сверены по импортам
- frontend lookup сверен по текущим страницам dashboard/admin/public routes

Что этот файл НЕ обещает:

- он не заменяет чтение конкретного модуля перед изменением логики
- он не является полным поведенческим контрактом каждой функции
- он описывает навигацию и ближайшие зависимости, а не каждую ветку кода

Цель:

- не читать весь репозиторий каждый раз с нуля
- быстро находить нужный модуль
- сразу понимать ближайшие зависимости
- понимать, какие файлы являются точками входа, а какие вспомогательными

Использование:

1. Найди нужную зону по разделу "Быстрый lookup по задачам".
2. Открой entrypoint-модуль.
3. Пройди только по перечисленным рядом зависимостям.
4. Не начинай с `reports/`, `node_modules/`, `.next/` и QA-артефактов, если задача не про аудит или тестовую историю.

## Корневой уровень репозитория

```text
vibe-hosting/
├── backend/                      # Express API, Prisma, deploy/billing/domain logic
├── frontend/                     # Next.js 16 приложение: лендинг, auth, dashboard, gallery, docs
├── docs/                         # живая внутренняя документация проекта
├── scripts/                      # production-скрипты деплоя, мониторинга и обслуживания
├── reports/                      # аудиты и исторические отчёты
├── cases/                        # демо-кейсы и готовые статические примеры
├── management/                   # служебная папка, сейчас почти не используется
├── ecosystem.config.js           # PM2-конфигурация production-процессов
├── nginx-hostingvibe.ru          # Nginx-конфиг для main site и wildcard-хостинга
├── README.md                     # обзор проекта
├── TODO.md                       # общие рабочие задачи
├── QA_*.md                       # QA и тестовые артефакты
├── *PRODAMUS*.md                 # отдельный поток документации по Prodamus
└── package.json                  # root dependency только для вспомогательных инструментов
```

### Что является источником правды

- runtime backend: `backend/src/*`
- runtime frontend: `frontend/src/*`
- schema и данные: `backend/prisma/schema.prisma`
- production topology: `ecosystem.config.js`, `nginx-hostingvibe.ru`
- живая внутренняя документация: `docs/*`

### Что не читать первым делом

- `reports/` — полезно для истории, но это не текущий runtime-контракт
- `QA_REPORT_*.md`, `payment-integration-test-report.md` — тестовые артефакты
- `.claude/` — локальные служебные файлы агента
- `frontend/.next/`, `node_modules/`, `frontend/tsconfig.tsbuildinfo` — generated output
- `backend/logs/` — runtime-логи, а не архитектура

## Backend

### Карта backend

```text
backend/
├── .env / .env.example           # runtime env
├── docs/runbooks/                # точечные runbook'и по billing
├── prisma/
│   ├── schema.prisma             # модели данных
│   └── migrations/               # миграции Prisma
├── public/                       # публичные JS-ассеты, которые backend отдаёт сайтам
├── scripts/sql/                  # SQL-фиксы и разовые DB-скрипты
├── src/
│   ├── app/                      # сборка Express app
│   ├── lib/                      # singleton-клиенты Prisma/Redis
│   ├── middleware/               # auth, rate limit, upload
│   ├── routes/                   # HTTP surface
│   ├── services/                 # бизнес-логика, deploy, email, Telegram, workers
│   ├── types/                    # type augmentation
│   ├── utils/                    # slug, zip, shell, limits, hmac
│   ├── config.ts                 # env + продуктовые лимиты + пути
│   └── index.ts                  # process entrypoint
└── package.json                  # backend scripts и deps
```

### Backend entrypoints

- `backend/src/index.ts`
  - стартует HTTP-сервер
  - запускает cleanup worker
  - запускает engagement worker
  - инициализирует Telegram bot

- `backend/src/app/create-app.ts`
  - собирает Express app
  - выставляет middleware в правильном порядке
  - подключает public и protected routes

- `backend/src/config.ts`
  - продуктовые лимиты Free/Pro
  - env-переменные
  - filesystem paths
  - reserved slugs
  - SMTP / Prodamus / Telegram / Nginx settings

### Backend: что лежит где

#### `backend/src/app/`

- `create-app.ts` — главный сборщик Express приложения
- `security.ts` — `helmet`, CORS и базовая защита
- `request-id.ts` — correlation id для логов
- `public-routes.ts` — регистрация публичных endpoints
- `protected-routes.ts` — регистрация auth/admin endpoints
- `error-handler.ts` — централизованный error handler

#### `backend/src/lib/`

- `prisma.ts` — Prisma singleton
- `redis.ts` — Redis client

#### `backend/src/middleware/`

- `auth.ts` — cookie/Bearer/query auth, admin gate, optional auth
- `rateLimit.ts` — Redis-backed или in-memory rate limiting
- `upload.ts` — приём `.zip`, `.tar.gz`, `.tgz`

#### `backend/src/utils/`

- `zip.ts` — валидация и распаковка архивов
- `slug.ts` — правила slug
- `limits.ts` — доступ к лимитам по тарифу
- `prodamus-hmac.ts` — HMAC-проверка для webhook
- `shell.ts` — безопасные shell-обёртки для infra-операций

#### `backend/src/services/`

- `deploy.service.ts` — архивный deploy, build, публикация, автоинжект runtime scripts
- `github.service.ts` — deploy из публичного GitHub repo
- `domain-provision.ts` — выпуск SSL и конфигурация домена
- `analytics.service.ts` — pageview tracking и агрегация
- `email.service.ts` — SMTP и шаблоны писем
- `email-events.service.ts` — идемпотентная отправка email
- `telegram.service.ts` — бот и отправка лидов в Telegram
- `cleanup.ts` — lifecycle cleanup
- `engagement-worker.ts` — фоновые engagement-задачи
- `project-operation-lock.ts` — лок от конкурентных deploy/rollback операций
- `logger.ts` — winston logger

#### `backend/src/routes/`

- `health.ts` — health check
- `slug-check.ts` — проверка slug
- `auth.ts` — регистрация, логин, reset, профиль, удаление аккаунта
- `projects.ts` — CRUD проекта и export
- `deploy.ts` — загрузка архива, GitHub deploy, SSE-статусы, rollback, file browser
- `billing.ts` — подписка, платёжные ссылки, webhook, отмена
- `domains.ts` — кастомные домены и verify
- `analytics.ts` — public tracking и private analytics
- `forms.ts` — form submissions
- `gallery.ts` — публичная галерея и лайки
- `edit.ts` — editor pages, visual patches, assets
- `site-gate.ts` — парольная защита пользовательских сайтов
- `telegram.ts` — link Telegram и список submissions
- `admin.ts` — admin stats, users, reports, project moderation
- `public-assets.ts` — отдача `vibe-forms.js`, `vibe-patches.js`, `vibe-editor-bridge.js`
- `pixel.ts` — `vibe-analytics.js`
- `report.ts` — abuse reports
- `unsubscribe.ts` — email opt-out
- `internal-preview.ts` — editor preview

### Backend dependency map: куда идти по задаче

| Задача | Открыть сначала | Потом смотреть |
|---|---|---|
| Логин, регистрация, сброс пароля | `backend/src/routes/auth.ts` | `middleware/auth.ts`, `services/email.service.ts`, `services/email-events.service.ts`, `config.ts` |
| Создание/обновление проекта | `backend/src/routes/projects.ts` | `utils/slug.ts`, `utils/limits.ts`, `config.ts`, `prisma/schema.prisma` |
| Архивный деплой | `backend/src/routes/deploy.ts` | `middleware/upload.ts`, `services/deploy.service.ts`, `utils/zip.ts`, `utils/limits.ts`, `services/project-operation-lock.ts` |
| GitHub deploy | `backend/src/routes/deploy.ts` | `services/github.service.ts`, `utils/shell.ts` |
| Rollback версий | `backend/src/routes/deploy.ts` | `services/project-operation-lock.ts`, `config.ts`, `BACKUPS_DIR` логика в `deploy.service.ts` |
| Кастомные домены и SSL | `backend/src/routes/domains.ts` | `services/domain-provision.ts`, `config.ts`, `nginx-hostingvibe.ru` |
| Billing / подписка / webhook | `backend/src/routes/billing.ts` | `utils/prodamus-hmac.ts`, `services/email.service.ts`, `prisma/schema.prisma`, env в `config.ts` |
| Аналитика | `backend/src/routes/analytics.ts` | `services/analytics.service.ts`, `routes/pixel.ts`, `routes/public-assets.ts` |
| Формы и Telegram лиды | `backend/src/routes/forms.ts` | `services/telegram.service.ts`, `public/vibe-forms.js`, `deploy.service.ts` |
| Gallery и лайки | `backend/src/routes/gallery.ts` | `prisma/schema.prisma`, `frontend/src/app/gallery/page.tsx` |
| Visual patches / editor | `backend/src/routes/edit.ts` | `services/deploy.service.ts`, `public/vibe-patches.js`, `frontend/src/components/editor/*` |
| Парольная защита сайтов | `backend/src/routes/site-gate.ts` | `routes/projects.ts`, `nginx-hostingvibe.ru` |
| Admin | `backend/src/routes/admin.ts` | `middleware/auth.ts`, dashboard admin pages во frontend |

### Backend flow dependencies

#### Deploy flow

`frontend dashboard`
-> `frontend/src/lib/api.ts`
-> `backend/src/routes/deploy.ts`
-> `backend/src/middleware/upload.ts`
-> `backend/src/services/deploy.service.ts`
-> `backend/src/utils/zip.ts`
-> `backend/src/config.ts`
-> `backend/prisma/schema.prisma`

#### Billing flow

`frontend/src/app/(dashboard)/billing/page.tsx`
-> `frontend/src/lib/api.ts`
-> `backend/src/routes/billing.ts`
-> `backend/src/utils/prodamus-hmac.ts`
-> `backend/src/services/email.service.ts`
-> `backend/prisma/schema.prisma`

#### Domain flow

`frontend/src/app/(dashboard)/domains/page.tsx`
-> `frontend/src/lib/api.ts`
-> `backend/src/routes/domains.ts`
-> `backend/src/services/domain-provision.ts`
-> `nginx-hostingvibe.ru`

## Frontend

### Карта frontend

```text
frontend/
├── public/                       # favicon, manifest, статические иконки
├── src/
│   ├── app/                      # App Router страницы и layouts
│   ├── components/               # UI-компоненты по доменам
│   ├── lib/                      # api client, auth, prompt, toast, utils
│   ├── types/                    # типы
│   └── middleware.ts             # защита route groups по cookie
├── next.config.ts                # next config и redirects
├── postcss.config.mjs            # postcss/tailwind
└── package.json                  # frontend scripts и deps
```

### Frontend entrypoints

- `frontend/src/app/layout.tsx`
  - глобальный layout
  - общие provider/метаданные/обвязка

- `frontend/src/app/page.tsx`
  - главный landing page

- `frontend/src/lib/api.ts`
  - единая точка всех вызовов backend API
  - почти все dashboard-экраны зависят от него

- `frontend/src/lib/auth.tsx`
  - auth context
  - инициализация пользователя
  - маршрутная авторизация в UI-слое

- `frontend/src/middleware.ts`
  - server-side route protection по cookie `vibe_token`

### `frontend/src/app/`

#### Public pages

- `page.tsx` — лендинг
- `gallery/page.tsx` — публичная галерея
- `docs/page.tsx` — пользовательская документация
- `ai/page.tsx` + `AiPageContent.tsx` — AI prompt surface
- `llms.txt/route.ts` — машиночитаемая документация
- `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` — SEO/system pages
- `not-found.tsx` — 404

#### Auth group

- `(auth)/login/page.tsx`
- `(auth)/register/page.tsx`
- `(auth)/forgot-password/page.tsx`
- `(auth)/reset-password/page.tsx`

Зависимости:

- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.tsx`

#### Dashboard group

- `(dashboard)/projects/page.tsx` — список проектов
- `(dashboard)/projects/new/page.tsx` — создание проекта
- `(dashboard)/projects/[id]/page.tsx` — главный workspace проекта
- `(dashboard)/projects/[id]/analytics/page.tsx` — аналитика проекта
- `(dashboard)/projects/[id]/edit/page.tsx` — visual editor
- `(dashboard)/billing/page.tsx`
- `(dashboard)/billing/success/page.tsx`
- `(dashboard)/domains/page.tsx`
- `(dashboard)/settings/page.tsx`

#### Admin group

- `(admin)/admin/page.tsx`
- `(admin)/admin/users/page.tsx`
- `(admin)/admin/projects/page.tsx`
- `(admin)/admin/reports/page.tsx`

#### Legal group

- `(legal)/offer/page.tsx`
- `(legal)/privacy/page.tsx`
- `(legal)/terms/page.tsx`

### `frontend/src/components/`

#### Общие

- `ErrorBoundary.tsx`
- `ToastContainer.tsx`
- `onboarding-modal.tsx`

#### Landing

- `landing/Header.tsx`
- `landing/Hero.tsx`
- `landing/SocialProof.tsx`
- `landing/Supports.tsx`
- `landing/Showcase.tsx`
- `landing/HowItWorks.tsx`
- `landing/Features.tsx`
- `landing/UseCases.tsx`
- `landing/Stats.tsx`
- `landing/Testimonials.tsx`
- `landing/Comparison.tsx`
- `landing/TrustSignals.tsx`
- `landing/Pricing.tsx`
- `landing/FAQ.tsx`
- `landing/CTA.tsx`
- `landing/Footer.tsx`

#### Editor

- `editor/VibeEditor.tsx`
- `editor/StyleEditor.tsx`

#### Analytics / Cookies

- `analytics/YandexMetrika.tsx`
- `cookies/CookieConsentBanner.tsx`

### `frontend/src/lib/`

- `api.ts` — главный API client
- `auth.tsx` — auth context и текущий пользователь
- `ai-prompt.ts` — prompt для AI-инструкций
- `toast.ts` — toast helpers
- `consent.ts` — cookie consent storage
- `useAnimate.ts` — animation helper
- `utils.ts` — утилиты интерфейса

### Frontend dependency map: куда идти по задаче

| Задача | Открыть сначала | Потом смотреть |
|---|---|---|
| Любой API-вызов из UI | `frontend/src/lib/api.ts` | нужную страницу в `frontend/src/app/*`, затем backend route |
| Авторизация в UI | `frontend/src/lib/auth.tsx` | `frontend/src/middleware.ts`, `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts` |
| Dashboard проектов | `frontend/src/app/(dashboard)/projects/[id]/page.tsx` | `frontend/src/app/(dashboard)/projects/[id]/components/*`, `frontend/src/lib/api.ts`, `backend/src/routes/projects.ts`, `backend/src/routes/deploy.ts` |
| Deploy uploader / version history / files | `frontend/src/app/(dashboard)/projects/[id]/components/DeployUploader.tsx` | `DeploymentHistory.tsx`, `FileNavigator.tsx`, `frontend/src/lib/api.ts`, `backend/src/routes/deploy.ts` |
| Billing UI | `frontend/src/app/(dashboard)/billing/page.tsx` | `frontend/src/lib/api.ts`, `backend/src/routes/billing.ts` |
| Домены | `frontend/src/app/(dashboard)/domains/page.tsx` | `frontend/src/lib/api.ts`, `backend/src/routes/domains.ts` |
| Настройки пользователя | `frontend/src/app/(dashboard)/settings/page.tsx` | `frontend/src/lib/auth.tsx`, `frontend/src/lib/api.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/telegram.ts` |
| Галерея | `frontend/src/app/gallery/page.tsx` | `frontend/src/lib/api.ts`, `backend/src/routes/gallery.ts` |
| Visual editor | `frontend/src/app/(dashboard)/projects/[id]/edit/page.tsx` | `frontend/src/components/editor/*`, `backend/src/routes/edit.ts`, `backend/src/routes/internal-preview.ts` |
| Публичные docs и AI docs | `frontend/src/app/docs/page.tsx` | `frontend/src/app/llms.txt/route.ts`, `frontend/src/lib/ai-prompt.ts` |
| Admin UI | `frontend/src/app/(admin)/admin/*` | `frontend/src/lib/api.ts`, `backend/src/routes/admin.ts` |

## Scripts, infra и эксплуатация

### `scripts/`

- `deploy.sh` — production deploy приложения
- `monitor.sh` — мониторинг backend/frontend/site/infra
- `backup-db.sh` — backup PostgreSQL
- `check-ssl.sh` — проверка SSL
- `deploy-cases.sh` — выкладка demo cases
- `setup-cases.js`, `setup-cases.sh` — настройка кейсов
- `setup-firewall.sh` — настройка firewall
- `setup-logrotate.sh` — настройка logrotate
- `crontab-backup.txt` — пример cron для backup
- `audit/run_cycle.sh` — служебный запуск audit cycle

### Production-конфиги

- `ecosystem.config.js`
  - PM2 apps:
    - `vibe-backend`
    - `vibe-frontend`

- `nginx-hostingvibe.ru`
  - main site `hostingvibe.ru`
  - `www` host
  - wildcard subdomains `*.hostingvibe.ru`
  - password gate через `auth_request`

## Документация и артефакты

### `docs/`

- `architecture.md` — архитектура проекта
- `operations.md` — эксплуатация и production flow
- `module-audit-2026-03-14.md` — текущий модульный аудит
- `project-structure.md` — этот файл

### `reports/`

Исторические аудиты, маркетинговые документы и план-файлы:

- `AUDIT-*.md`
- `FIXES-*.md`
- `FIXPLAN.md`
- `FINAL-REPORT.md`
- `audit-cycle/*`
- `audit-2026-03-08-multi-agent/*`
- `email/*`
- `marketing/*`

Это полезный контекст, но не первый файл для повседневной навигации по runtime-коду.

### `cases/`

Готовые демонстрационные статические кейсы и архивы:

- `barber/`
- `business/`
- `design/`
- `dev/`
- `freelance/`
- `hackathon/`
- `illustrator/`
- `marketing/`
- `nutrition/`
- `saas/`
- `smm/`
- `students/`
- `case-*.zip`

Нужны для demo-контента и примеров сайтов, а не для core logic продукта.

## Самые важные файлы проекта

Если нужно начать максимально быстро, почти всегда достаточно открыть этот набор:

### Backend

- `backend/src/index.ts`
- `backend/src/app/create-app.ts`
- `backend/src/config.ts`
- `backend/src/routes/deploy.ts`
- `backend/src/routes/projects.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/billing.ts`
- `backend/src/services/deploy.service.ts`
- `backend/prisma/schema.prisma`

### Frontend

- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.tsx`
- `frontend/src/middleware.ts`
- `frontend/src/app/(dashboard)/projects/[id]/page.tsx`
- `frontend/src/app/(dashboard)/domains/page.tsx`
- `frontend/src/app/(dashboard)/billing/page.tsx`
- `frontend/src/app/(dashboard)/settings/page.tsx`

### Infra

- `ecosystem.config.js`
- `nginx-hostingvibe.ru`
- `scripts/deploy.sh`

## Быстрый lookup по задачам

| Если задача про... | Начни с... |
|---|---|
| auth | `frontend/src/lib/auth.tsx` + `backend/src/routes/auth.ts` |
| deploy архива | `backend/src/routes/deploy.ts` + `backend/src/services/deploy.service.ts` |
| GitHub deploy | `backend/src/routes/deploy.ts` + `backend/src/services/github.service.ts` |
| проекты | `frontend/src/app/(dashboard)/projects/*` + `backend/src/routes/projects.ts` |
| editor | `frontend/src/components/editor/*` + `backend/src/routes/edit.ts` |
| visual patches | `backend/src/routes/edit.ts` + `backend/public/vibe-patches.js` |
| billing | `frontend/src/app/(dashboard)/billing/page.tsx` + `backend/src/routes/billing.ts` |
| Prodamus webhook | `backend/src/routes/billing.ts` + `backend/src/utils/prodamus-hmac.ts` |
| домены и SSL | `frontend/src/app/(dashboard)/domains/page.tsx` + `backend/src/routes/domains.ts` + `backend/src/services/domain-provision.ts` |
| forms / Telegram | `backend/src/routes/forms.ts` + `backend/src/services/telegram.service.ts` |
| analytics | `backend/src/routes/analytics.ts` + `backend/src/services/analytics.service.ts` |
| gallery | `frontend/src/app/gallery/page.tsx` + `backend/src/routes/gallery.ts` |
| admin | `frontend/src/app/(admin)/admin/*` + `backend/src/routes/admin.ts` |
| SEO / docs / AI prompt | `frontend/src/app/docs/page.tsx` + `frontend/src/app/llms.txt/route.ts` + `frontend/src/lib/ai-prompt.ts` |
| production infra | `ecosystem.config.js` + `nginx-hostingvibe.ru` + `scripts/deploy.sh` |

## Рекомендуемый порядок чтения для ИИ

### Если задача backend

1. `backend/src/app/create-app.ts`
2. нужный файл из `backend/src/routes/`
3. его зависимости из `services/`, `utils/`, `middleware/`
4. `backend/prisma/schema.prisma`, если задача затрагивает данные

### Если задача frontend

1. нужная страница в `frontend/src/app/`
2. `frontend/src/lib/api.ts`
3. связанные компоненты в `frontend/src/components/`
4. соответствующий backend route

### Если задача infra / production

1. `ecosystem.config.js`
2. `nginx-hostingvibe.ru`
3. `scripts/deploy.sh`
4. `docs/operations.md`

Этот файл стоит держать первой точкой входа для любых следующих сессий, где нужно быстро ориентироваться в проекте.
