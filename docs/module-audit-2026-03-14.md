# Module Audit — 2026-03-14

## Контекст

Этот аудит синхронизирован с текущим деревом `frontend/src/*` и `backend/src/*` в репозитории на `2026-03-14`. Цель документа — быстро показать, какие модули сейчас являются опорными, а какие остаются зонами повышенной сложности.

## Backend

### App bootstrap

| Module | Responsibility | Status |
|---|---|---|
| `backend/src/index.ts` | старт HTTP-сервера, workers, Telegram bot, shutdown | `ok` |
| `backend/src/app/create-app.ts` | сборка Express app и корректный порядок middleware | `ok` |
| `backend/src/app/security.ts` | `helmet`, CORS, базовые security headers | `ok` |
| `backend/src/app/public-routes.ts` | регистрация публичных маршрутов | `ok` |
| `backend/src/app/protected-routes.ts` | регистрация auth/admin маршрутов | `ok` |
| `backend/src/app/error-handler.ts` | централизованный error serialization | `ok` |

### Route surface

| Module | Responsibility | Status |
|---|---|---|
| `backend/src/routes/auth.ts` | auth, password reset, profile, account deletion | `watch`: модуль остаётся крупным |
| `backend/src/routes/projects.ts` | CRUD проекта, publish metadata, export | `ok` |
| `backend/src/routes/deploy.ts` | архивный деплой, GitHub deploy, SSE статусы, rollback, file browser | `watch`: высокая плотность логики |
| `backend/src/routes/edit.ts` | editor pages, visual patches, assets | `watch`: смешаны несколько поддоменов editor/runtime |
| `backend/src/routes/billing.ts` | subscription status, payment links, webhook, cancel | `watch`: платёжная логика и идемпотентность чувствительны |
| `backend/src/routes/domains.ts` | кастомные домены, DNS verify, SSL-provisioning | `watch`: сильная зависимость от infra |
| `backend/src/routes/analytics.ts` | public tracking + private analytics summary | `ok` |
| `backend/src/routes/forms.ts` | приём форм и Telegram forwarding | `ok` |
| `backend/src/routes/gallery.ts` | публичный каталог и лайки | `ok` |
| `backend/src/routes/admin.ts` | статистика, пользователи, модерация, репорты | `ok` |
| `backend/src/routes/site-gate.ts` | password-protected hosted sites | `ok` |
| `backend/src/routes/health.ts` | DB/storage/SMTP health | `ok` |

### Services and infra logic

| Module | Responsibility | Status |
|---|---|---|
| `backend/src/services/deploy.service.ts` | validate/extract/build/publish/inject scripts | `watch`: самый тяжёлый backend-модуль |
| `backend/src/services/github.service.ts` | deploy из публичного GitHub repo | `ok` |
| `backend/src/services/domain-provision.ts` | Nginx + certbot orchestration | `watch` |
| `backend/src/services/email.service.ts` | SMTP и email templates | `watch`: большой шаблонный модуль |
| `backend/src/services/email-events.service.ts` | идемпотентная отправка email | `ok` |
| `backend/src/services/analytics.service.ts` | агрегация просмотров | `ok` |
| `backend/src/services/cleanup.ts` | lifecycle cleanup и subscription housekeeping | `ok` |
| `backend/src/services/engagement-worker.ts` | фоновые engagement-задачи | `ok` |
| `backend/src/services/telegram.service.ts` | bot init и доставка в Telegram | `watch`: transport и domain logic связаны |
| `backend/src/services/project-operation-lock.ts` | защита от конкурентных операций по проекту | `ok` |

### Utility layer

| Module | Responsibility | Status |
|---|---|---|
| `backend/src/middleware/auth.ts` | cookie/bearer/query auth, admin gate | `ok` |
| `backend/src/middleware/rateLimit.ts` | Redis/in-memory rate limiting | `watch`: поведение зависит от состояния Redis |
| `backend/src/middleware/upload.ts` | приём архивов `.zip` / `.tar.gz` / `.tgz` | `ok` |
| `backend/src/utils/zip.ts` | архивная валидация и extraction safety | `ok` |
| `backend/src/utils/slug.ts` | slug policy и reserved words | `ok` |
| `backend/src/utils/shell.ts` | shell wrappers для infra ops | `watch` |

## Frontend

### Core app surface

| Module | Responsibility | Status |
|---|---|---|
| `frontend/src/app/page.tsx` | лендинг и entrypoint продукта | `ok` |
| `frontend/src/app/(dashboard)/projects/page.tsx` | список проектов | `ok` |
| `frontend/src/app/(dashboard)/projects/[id]/page.tsx` | основной workspace проекта | `watch`: самый тяжёлый пользовательский экран |
| `frontend/src/app/(dashboard)/projects/[id]/analytics/page.tsx` | аналитика проекта | `ok` |
| `frontend/src/app/(dashboard)/projects/[id]/edit/page.tsx` | editor host | `ok` |
| `frontend/src/app/(dashboard)/domains/page.tsx` | домены и verify UX | `watch` |
| `frontend/src/app/(dashboard)/billing/page.tsx` | billing UI и переход к оплате | `ok` |
| `frontend/src/app/(dashboard)/settings/page.tsx` | профиль, пароль, Telegram, account settings | `watch` |
| `frontend/src/app/(admin)/admin/*` | admin UI | `ok` |
| `frontend/src/app/docs/page.tsx` | публичная deploy-документация | `ok` |
| `frontend/src/app/ai/*` | AI prompt surface | `ok` |
| `frontend/src/app/gallery/page.tsx` | публичная галерея | `ok` |

### Shared frontend logic

| Module | Responsibility | Status |
|---|---|---|
| `frontend/src/lib/api.ts` | transport layer и типизированные вызовы API | `watch`: всё ещё монолитный клиент |
| `frontend/src/lib/auth.tsx` | auth context и session bootstrap | `ok` |
| `frontend/src/middleware.ts` | route guard по cookie `vibe_token` | `watch`: naming legacy для Next 16 |
| `frontend/src/components/editor/VibeEditor.tsx` | runtime editor shell | `watch` |
| `frontend/src/components/editor/StyleEditor.tsx` | style controls редактора | `ok` |
| `frontend/src/components/landing/*` | маркетинговые блоки лендинга | `ok` |
| `frontend/src/components/cookies/*` | consent banner | `ok` |
| `frontend/src/components/analytics/YandexMetrika.tsx` | метрика в frontend shell | `ok` |

## Основные риски после актуализации

1. `backend/src/services/deploy.service.ts` и `frontend/src/lib/api.ts` остаются основными кандидатами на дальнейшее разбиение.
2. `backend/src/routes/deploy.ts`, `backend/src/routes/edit.ts`, `backend/src/routes/billing.ts` содержат много поведения в одном модуле и требуют аккуратности при изменениях.
3. Инфраструктурно-зависимые зоны `domains`, `domain-provision`, `shell` и PM2/Nginx связки нужно проверять на реальном окружении после каждого существенного релиза.
4. Для dashboard-маршрутов главным сложным экраном остаётся `/projects/[id]`, где сходятся деплой, настройки, файловая навигация и история версий.

## Источники правды

- Фронтенд-маршруты: `frontend/src/app/*`
- API surface: `backend/src/routes/*`
- Лимиты и env defaults: `backend/src/config.ts`
- Prisma-модель: `backend/prisma/schema.prisma`
