# VibeHosting — Архитектура

## Структура каталогов

```
backend/
  src/
    index.ts              — точка входа, порядок middleware и маршрутов
    config.ts             — конфиг из env vars + лимиты + reserved slugs
    lib/prisma.ts         — singleton Prisma Client
    middleware/
      auth.ts             — authMiddleware, optionalAuth, adminMiddleware
      rateLimit.ts        — authLimiter(10/15min), deployLimiter(5/hr), apiLimiter(100/min)
      upload.ts           — multer для ZIP
    routes/
      auth.ts             — register, login, me, forgot/reset/change password
      projects.ts         — CRUD, export, files
      deploy.ts           — upload ZIP, GitHub deploy, rollback
      domains.ts          — custom domains + DNS verify + SSL provision
      billing.ts          — Prodamus payments + webhook
      gallery.ts          — public gallery + likes + views
      analytics.ts        — pageview tracking + project stats
      admin.ts            — admin panel (users, projects, reports)
      edit.ts             — visual editor: pages, patches, assets
      forms.ts            — form submissions → Telegram
      telegram.ts         — bot link/unlink
      report.ts           — abuse reports
      pixel.ts            — analytics JS pixel
      site-gate.ts        — password-protected sites (Nginx auth_request)
    services/
      deploy.service.ts   — ZIP validation, build, atomic swap, script injection
      github.service.ts   — git clone + build pipeline
      domain-provision.ts — Nginx config + certbot SSL + www redirect
      analytics.service.ts — pageview aggregation
      email.service.ts    — Nodemailer templates
      telegram.service.ts — bot polling, deep-link /start
      cleanup.ts          — worker 15min: expired subs + expired sites
      logger.ts           — Winston (файлы + stdout)
    utils/
      zip.ts              — validateZip (bombs, forbidden ext) + extractZip
      slug.ts             — validateSlug (reserved + regex)
      limits.ts           — getPlanLimits(plan)
      shell.ts            — setNginxPermissions
    types/global.d.ts     — custom type declarations (exec, promisify, resolve4)
  public/
    vibe-forms.js         — клиентский перехват форм
    vibe-patches.js       — применение visual patches
    vibe-editor-bridge.js — iframe ↔ editor postMessage
  prisma/schema.prisma    — 13 моделей

frontend/
  src/
    app/
      page.tsx                — лендинг (16 секций)
      layout.tsx              — root layout + AuthProvider
      middleware.ts           — route protection (cookie vibe_token)
      (auth)/                 — login, register, forgot/reset password
      (dashboard)/            — projects, billing, domains, settings, projects/[id]/*
      (admin)/                — admin panel
      (legal)/                — terms, privacy, offer
      gallery/                — публичная галерея
      docs/                   — документация
    components/
      landing/               — Hero, Features, Pricing, FAQ, Footer и др. (16 компонентов)
      editor/                — VibeEditor.tsx, StyleEditor.tsx
    lib/
      api.ts                 — ApiClient class + все типы
      auth.tsx               — AuthProvider + useAuth hook
```

## БД — Prisma модели (13)

| Модель | Ключевые поля |
|--------|--------------|
| User | email, passwordHash, plan(FREE/PRO), isAdmin, storageUsed/Limit, aiCredits |
| Project | slug(unique), status, isPublic, tags[], likes, views, passwordHash, expiresAt |
| Deployment | version, status(PENDING→LIVE/FAILED), zipHash |
| Domain | hostname(unique), verified, verifyToken, sslStatus(PENDING→ACTIVE) |
| Subscription | prodamusOrderId, status, priceRub=386, currentPeriodStart/End |
| ProjectLike | unique(projectId, userId) |
| PageView | projectId, path, ip, userAgent, referrer |
| Report | reason enum, reporterIp, status |
| TelegramLink | chatId, linkCode(unique), username |
| FormSubmission | projectId, formName, data(Json), sentToTg |
| EditorPage | projectId, path, gjsData(Json) |
| PasswordReset | token(unique), expiresAt(1hr) |
| VisualPatch | selector, type(text/image/hide/style), content, enabled |

## API — карта эндпоинтов

Все с префиксом `/api`. Полная карта в коде `backend/src/index.ts`.

**Публичные (без auth):** /health, /slugs/check, /track, /forms/:slug, /patches/:slug, /report, /gallery/*, /site-auth, /site-gate/:slug, /billing/webhook, vibe-*.js скрипты

**Auth:** POST /auth/register, /auth/login, GET /auth/me, POST forgot/reset/change password, PUT /auth/profile, DELETE /auth/account

**Projects:** CRUD /projects, /projects/:id/export, /projects/:id/files

**Deploy:** POST /projects/:id/deploy (ZIP), /deploy-github (URL), /rollback

**Editor:** GET/POST/PUT/DELETE /projects/:id/edit/patches, /edit/pages, /edit/assets, /edit/preview

**Domains:** GET/POST /domains, POST /domains/:id/verify, DELETE /domains/:id

**Billing:** GET /billing/status, POST /create-payment, /create-ai-pack, /cancel

**Admin:** GET /admin/stats, /admin/users, /admin/projects, PATCH suspend, /admin/reports

## Важно: порядок middleware в index.ts

1. Public routes (site-gate, vibe-*.js, gallery, track, forms, patches, report, webhook)
2. Auth routes (/auth/*)
3. Preview route (/projects/:id/edit/preview — с token в query)
4. **authMiddleware** — блокирует всё ниже без Bearer token
5. Protected routes (projects, deploy, domains, billing, editor, telegram, admin)
