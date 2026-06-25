# VibeHosting Backend — Полный аудит

**Дата аудита:** 21 марта 2026 г.
**Статус:** Research-only
**Версия Backend:** 1.0.0 (Express.js 4.21.2, TypeScript 5.7.0, Prisma 6.5.0)

---

## 1. Структура проекта

### Главные директории
```
backend/
├── src/
│   ├── app/              # Инициализация Express, безопасность, маршруты
│   ├── middleware/       # Auth, rate limiting, file upload
│   ├── routes/           # API эндпоинты
│   ├── services/         # Бизнес-логика (deploy, email, Telegram, DNS)
│   ├── utils/            # Хелперы (ZIP validation, limits, slug)
│   ├── lib/              # Подключение к БД (Prisma) и Redis
│   ├── types/            # Type definitions
│   └── index.ts          # Точка входа
├── prisma/
│   └── schema.prisma     # ORM схема с 13 моделями
├── public/
│   ├── vibe-analytics.js # JS пиксель для аналитики на сайтах
│   ├── vibe-editor-bridge.js
│   └── vibe-forms.js
└── package.json
```

### Ключевые зависимости
- **Express**: HTTP сервер
- **Prisma**: ORM (PostgreSQL)
- **Redis**: Rate limiting, сессии
- **JWT (jsonwebtoken)**: Аутентификация
- **Bcrypt**: Хеширование паролей
- **Multer**: Загрузка файлов
- **Helmet**: HTTP headers безопасность
- **CORS**: Cross-origin запросы
- **Telegram Bot API**: Интеграция с ботом
- **Nodemailer**: Отправка email
- **Winston**: Логирование
- **BullMQ**: Job queue (есть в зависимостях)
- **AdmZip**: Распаковка архивов

---

## 2. Базы данных (Prisma Schema)

### Модели (13 штук)

#### 2.1 User
- **Поля**: id, email, passwordHash, displayName, phone, plan, isAdmin, storageUsed, storageLimit, aiCredits, lastActiveAt, tokenVersion, emailOptOut, createdAt, updatedAt
- **Связи**: projects, domains, subscription, passwordResets, projectLikes, telegramLink, emailEvents
- **Индексы**: email
- **Особенности**:
  - `plan`: ENUM (FREE | PRO)
  - `storageUsed`: BigInt (отслеживание использованного места)
  - `tokenVersion`: для инвалидации JWT токенов (при смене пароля)
  - `emailOptOut`: opt-out от рассылок (152-ФЗ compliance)

#### 2.2 Project
- **Поля**: id, userId, slug, title, description, sizeBytes, fileCount, status, isPublic, tags, likes, views, currentVersion, passwordHash, passwordEnabled, metrikaId, expiresAt, createdAt, updatedAt, publishedAt
- **Связи**: deployments, domains, projectLikes, pageViews, reports, formSubmissions, editorPages, visualPatches
- **Индексы**: userId, slug, status, (isPublic, likes), (isPublic, createdAt), (isPublic, publishedAt), expiresAt
- **Особенности**:
  - `status`: ENUM (UPLOADING | PROCESSING | LIVE | ERROR | SUSPENDED)
  - `passwordEnabled` + `passwordHash`: защита паролем сайта
  - `metrikaId`: Яндекс.Метрика ID для аналитики
  - `expiresAt`: для временных проектов (FREE план?)

#### 2.3 Deployment
- **Поля**: id, projectId, version, sizeBytes, fileCount, status, errorMessage, zipHash, createdAt
- **Связи**: project
- **Индексы**: projectId, (projectId, version), status
- **Особенности**:
  - `status`: ENUM (PENDING | EXTRACTING | BUILDING | LIVE | FAILED | SUPERSEDED)
  - `zipHash`: SHA256 хеш архива (для дедупликации и отслеживания)

#### 2.4 Domain
- **Поля**: id, projectId, userId, hostname, verified, verifyToken, verifiedAt, sslStatus, sslExpiresAt, createdAt, updatedAt
- **Связи**: project, user
- **Индексы**: hostname, projectId, userId
- **Особенности**:
  - `verified`: проверка DNS A-record / CNAME / TXT
  - `sslStatus`: ENUM (PENDING | PROVISIONING | ACTIVE | FAILED | EXPIRED)
  - `verifyToken`: UUID для TXT-record проверки
  - Только для PRO пользователей

#### 2.5 Subscription
- **Поля**: id, userId, prodamusOrderId, prodamusSubscriptionId, status, priceRub, currentPeriodStart, currentPeriodEnd, cancelledAt, createdAt, updatedAt
- **Связи**: user
- **Особенности**:
  - `status`: ENUM (INACTIVE | ACTIVE | PAST_DUE | CANCELLED)
  - `priceRub`: 386 рублей за месяц
  - Интеграция с Prodamus (платежная система)

#### 2.6 ProjectLike
- **Поля**: id, projectId, userId, createdAt
- **Связи**: project, user
- **Индексы**: projectId, userId, (projectId, userId) UNIQUE
- **Особенности**: Like/unlike для публичных проектов

#### 2.7 PageView
- **Поля**: id, projectId, path, ip, userAgent, referrer, country, createdAt
- **Связи**: project
- **Индексы**: (projectId, createdAt), (projectId, path), createdAt
- **Особенности**: IP хешируется (SHA256), user-agent обрезается до 512 символов

#### 2.8 Report
- **Поля**: id, projectId, reason, message, reporterIp, status, createdAt
- **Связи**: project
- **Индексы**: projectId, status
- **Особенности**:
  - `reason`: ENUM (SPAM | MALWARE | PHISHING | ILLEGAL | COPYRIGHT | OTHER)
  - `status`: ENUM (PENDING | REVIEWED | RESOLVED | DISMISSED)
  - IP хешируется (SHA256), макс 3 жалобы на IP в день

#### 2.9 TelegramLink
- **Поля**: id, userId, chatId, username, linkCode, linkedAt
- **Связи**: user
- **Особенности**:
  - `linkCode`: unique code для deep linking с бота
  - `chatId`: может быть `pending:${userId}` во время линкирования

#### 2.10 FormSubmission
- **Поля**: id, projectId, formName, data, ip, sentToTg, createdAt
- **Связи**: project
- **Индексы**: (projectId, createdAt)
- **Особенности**:
  - `data`: JSON с формой (max 20 полей, 2048 чар каждое)
  - `ip`: хешируется (SHA256)
  - `sentToTg`: флаг отправки в Telegram

#### 2.11 EditorPage
- **Поля**: id, projectId, path, gjsData, updatedAt
- **Связи**: project
- **Индексы**: projectId, (projectId, path) UNIQUE
- **Особенности**:
  - `gjsData`: JSON для GrapeJS визуального редактора
  - `path`: "index.html", "about.html" и т.д.

#### 2.12 PasswordReset
- **Поля**: id, userId, token, expiresAt, usedAt, createdAt
- **Связи**: user
- **Индексы**: token, userId
- **Особенности**:
  - `token`: SHA256 хеш (хранится хеш, не сам токен)
  - `expiresAt`: 1 час от создания

#### 2.13 EmailEvent
- **Поля**: id, dedupeKey, eventType, recipientEmail, category, userId, status, attempts, payloadHash, lastError, sentAt, createdAt, updatedAt
- **Связи**: user
- **Индексы**: (userId, createdAt), (eventType, createdAt), (status, createdAt)
- **Особенности**:
  - `status`: ENUM (PENDING | SENT | SKIPPED | FAILED)
  - `dedupeKey`: unique для идемпотентности (prevent duplicates)
  - `payloadHash`: SHA256 хеш payload для дедупликации

#### Дополнительные модели
- **PaymentEvent**: Для отслеживания Prodamus webhook событий (PROCESSING | PROCESSED | FAILED)
- **VisualPatch**: Для визуального редактора (type: text | image | hide, CSS selector для патча)

---

## 3. Authentication (Auth)

### JWT токены
- **Алгоритм**: HS256 (HMAC)
- **Payload**: `{ userId, email, tokenVersion }`
- **Expiration**: 7 дней
- **Хранение**: httpOnly cookie `vibe_token` + опционально Bearer header
- **Секрет**: `JWT_SECRET` из .env

### Middleware auth.ts (4 функции)
1. **`readCookie()`**: Читает `vibe_token` из cookies или заголовка Authorization
2. **`readBearerToken()`**: Парсит `Authorization: Bearer <token>`
3. **`readLegacyQueryToken()`**: Читает `?token=xxx` (deprecated,退出план)
4. **`optionalAuth()`**: Устанавливает userId если токен валиден, продолжает как анонимус если нет
5. **`authMiddleware()`**: Требует авторизации, проверяет Origin для cookie-based auth
6. **`adminMiddleware()`**: Проверяет `isAdmin` флаг

### Token Invalidation (tokenVersion)
- При смене пароля / reset password: `tokenVersion` инкрементируется
- При верификации JWT: проверяется tokenVersion в DB (отверг все старые токены)
- Используется для logout без DB deletion

### CSRF/XSRF Protection
- Для cookie auth: проверяется Origin header (whitelist: config.corsOrigins + config.frontendUrl)
- Для Bearer: Origin проверка skip-нута (API clients могут быть без Origin)
- Отказ с 403 если Origin не trusted для mutating methods (POST/PUT/PATCH/DELETE)

### Password Policy
- Минимум 8 символов
- Требуется хотя бы одна буква (лат или кириллица) + одна цифра
- Хеширование: bcrypt с 10 rounds

---

## 4. API Endpoints

### 4.1 Auth (/api/auth)
| Метод | Endpoint | Auth | Rate Limit | Описание |
|-------|----------|------|-----------|----------|
| POST | /register | ❌ | 5/15min | Регистрация (displayName опционален, XSS-защита) |
| POST | /login | ❌ | 10/15min | Вход (инкрементирует lastActiveAt) |
| GET | /me | ✅ | - | Данные текущего пользователя + count проектов |
| POST | /forgot-password | ❌ | 3/15min | Генерирует reset token (всегда 200 для privacy) |
| POST | /reset-password | ❌ | 5/15min | Сброс пароля по token (invalidates token, инкр tokenVersion) |
| POST | /change-password | ✅ | - | Смена пароля (требует старый пароль, инкр tokenVersion) |
| PUT | /profile | ✅ | - | Обновить displayName + phone (phone валидируется 10-15 цифр) |
| POST | /logout | - | - | Clear httpOnly cookie |
| DELETE | /account | ✅ | - | Удалить аккаунт (требует пароль) + все проекты и файлы |

**Files**: `/backend/src/routes/auth.ts` (452 строки)

#### Проблемы в Auth:
- ❌ **XSS в displayName**: `displayName.replace(/<[^>]*>/g, '')` — simple regex, не полная HTML sanitization
- ❌ **Email enumeration**: /forgot-password всегда возвращает 200 (хорошо для privacy), но /reset-password не проверяет rate limit на уровне пользователя
- ✅ **Password reset security**: SHA256 хеш токена в DB, raw токен в email, 1-часовой TTL
- ✅ **Token invalidation**: tokenVersion механизм работает

---

### 4.2 Projects (/api/projects)
| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | / | ✅ | Список проектов пользователя (без passwordHash) |
| POST | / | ✅ | Создать проект (slug валидация, проверка лимита FREE/PRO) |
| GET | /:id | ✅ | Детали проекта (SPA detection via index.html parsing) |
| PUT | /:id | ✅ | Обновить title/description/tags/password/metrikaId |
| DELETE | /:id | ✅ | Удалить проект + все файлы с диска (async) |
| GET | /:id/versions | ✅ | Историю версий |

**Files**: `/backend/src/routes/projects.ts` (300+ строк)

#### Особенности:
- **Slug валидация**: `validateSlug()` — reserved slugs (www, api, admin, api, app, etc.)
- **SPA Detection**: Проверяет есть ли только пустой `<div id="root">` в body (Next.js/React/Vue)
- **Пароль защита**: bcrypt хеш (10 rounds)
- **Метрика**: Яндекс.Метрика ID для счетчика
- **Лимиты FREE**: 1 проект, 50MB, 3 версии
- **Лимиты PRO**: 3 проекта, 500MB, 15 версий

---

### 4.3 Deploy (/api/projects/:id/deploy)
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | /:id/deploy | Загрузить ZIP и запустить deploy (async) |
| GET | /:id/deployments | Список последних 20 deплоев |
| GET | /:id/deployments/:deployId/status | Статус одного деплоя |
| GET | /:id/deployments/:deployId/stream | SSE stream статуса до terminal state |

**Files**: `/backend/src/routes/deploy.ts` (250+ строк)

#### Процесс Deploy:
1. **Upload**: ZIP с rate limitом (5/hour)
2. **Validation**:
   - Размер против плана (50MB free, 500MB pro)
   - ZIP валидация: forbidden extensions (.php, .sh, .py, .cgi, .htaccess, .bat, .cmd, .pl, .jsp, .asp, .aspx, .rb)
   - Compression ratio check (ZIP bomb protection, макс 100:1)
   - Max 5000 файлов
   - SHA256 хеш для дедупликации
3. **Background Processing**:
   - EXTRACTING: распаковка ZIP
   - BUILDING: npm install + npm run build (если есть package.json)
   - LIVE: перемещение в `/var/www/vibe-hosting/sites/{slug}/`
4. **Error Handling**: FAILED статус + errorMessage
5. **Backup**: Старые версии в `/var/www/vibe-hosting/backups/{slug}/v{n}/`
6. **Cleanup**: Удаление symlinks, старых бэкапов по лимиту версий

#### Deploy Service (deploy.service.ts):
- **ZIP Validation**: path traversal check, forbidden extensions, compression ratio
- **Build Detection**: Проверяет package.json → npm ci/install → npm run build (3 мин timeout)
- **Build Safety**:
  - Strips dangerous lifecycle hooks (preinstall, postinstall, prepare, etc.)
  - Safe env (только PATH, HOME, LANG, TERM — без secrets)
  - No cgroup/chroot isolation ⚠️ (может читать другие site files)
- **TAR.GZ Support**: Также поддерживает tar.gz архивы

---

### 4.4 Domains (/api/domains)
| Метод | Endpoint | Auth | Требование | Описание |
|-------|----------|------|-----------|----------|
| GET | / | ✅ | - | Список всех кастомных доменов |
| POST | / | ✅ | PRO | Добавить новый домен |
| POST | /:id/verify | ✅ | - | Проверить DNS + выпустить SSL |
| DELETE | /:id | ✅ | - | Удалить домен + очистить Nginx/SSL |
| GET | /:id/retry-ssl | ✅ | - | Повторить выпуск SSL сертификата |

**Files**: `/backend/src/routes/domains.ts` (300+ строк)

#### Процесс верификации домена:
1. **DNS проверка** (один из трех):
   - A-record → server IP (config.serverIp = 203.0.113.10)
   - CNAME → hostingvibe.ru
   - TXT _vibe-verify.{domain} → verifyToken
2. **SSL provisioning** (если DNS ok):
   - Создание Nginx конфига (HTTP для certbot challenge)
   - Запуск certbot (Let's Encrypt)
   - Обновление Nginx конфига на HTTPS
   - Update DB: sslStatus = ACTIVE
3. **Custom domain canonicalization**:
   - Все кастомные домены маршрутизируются на их hosting subdomains
   - Sync map: `/etc/nginx/conf.d/vibe-canonical-hosts.map`
   - Для www версии: авторедирект на non-www HTTPS

#### Особенности:
- **PRO only**: Кастомные домены доступны только PRO пользователям
- **SSL auto-renewal**: Certbot должен быть настроен в systemd timer
- **Error messages**: User-friendly ошибки (DNS не обновился, rate limit Let's Encrypt, timeout)
- **Hostname validation**: Regex проверка формата

---

### 4.5 Edit / Visual Editor (/api/projects/:id/edit)
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | /:id/edit/pages | Список HTML файлов в сайте |
| GET | /:id/edit/preview | Serve site с injected editor bridge + token от query |
| POST | /:id/edit/pages/:path/save | Сохранить GrapeJS JSON |
| POST | /:id/edit/assets/upload | Загрузить изображение/видео/шрифт (Multer) |
| POST | /:id/edit/patches | Создать/обновить CSS/text/image patches (visual overrides) |
| DELETE | /:id/edit/patches/:patchId | Удалить патч |

**Files**: `/backend/src/routes/edit.ts` (500+ строк)

#### Visual Editor особенности:
- **GrapeJS data storage**: JSON в EditorPage модель
- **Asset uploads**: 10MB limit, allowed: JPEG/PNG/GIF/WebP/AVIF/WOFF/WOFF2/MP4/WebM
- **Visual Patches** (CSS overrides):
  - Type: text, image, hide, style
  - Selector validation: max 500 chars, no JS/expression injection
  - CSS whitelist: color, fontSize, fontWeight, textAlign, lineHeight, etc.
  - Хранится в VisualPatch модель, автоинжектится при рендере
- **Iframe preview**: Token может передаваться в query params (для loading в iframe)

---

### 4.6 Forms (/api/forms/:slug)
| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | /:slug | ❌ | Submit форма → save + send Telegram |
| OPTIONS | /:slug | ❌ | CORS preflight |

**Files**: `/backend/src/routes/forms.ts` (178 строк)

#### Обработка форм:
1. **CORS**: Разрешены *.hostingvibe.ru + верифицированные кастомные домены
2. **Data extraction**:
   - Max 20 полей (skip `_vibe_*` внутренние)
   - Max 2048 chars per value
   - IP хеширование (SHA256 с датой)
3. **Дедупликация**: In-memory map, 30 сек window, удаляет старые после 5000 entries
4. **Отправка**:
   - Save в DB (FormSubmission)
   - Send Telegram если linked (sendFormToTelegram)
   - Redirect если `_vibe_redirect` (только relative или same domain)
5. **Rate limiting**: Нет явного rate limit, только дедупликация

#### Особенности:
- `_vibe_form_name`: Имя формы (до 100 символов)
- `_vibe_redirect`: URL для redirect после submit (security: check origin)
- **Email submit fallback**: Нет (все заявки идут в Telegram если linked, иначе теряются)

---

### 4.7 Analytics (/api/analytics)
| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| POST | /track | ❌ | Public pixel tracking (от JS на сайте) |
| GET | /:id/analytics | ✅ | Project analytics (views, pages, referrers) |

**Files**: `/backend/src/routes/analytics.ts` (62 строки)

#### Tracking механизм:
1. **Pixel injection**: `vibe-analytics.js` (Pixel router)
   - Автодиагностика slug из hostname ({slug}.hostingvibe.ru)
   - Fallback: `data-slug` атрибут
   - Navigator.sendBeacon (best-effort)
   - IP: x-forwarded-for или socket.remoteAddress
2. **Дедупликация**: 1 час per IP per project (in-memory map)
3. **Analytics**: Агрегирование в DB:
   - Total views, today, week, month
   - Top pages (path groupBy)
   - Top referrers (group by)
   - Views by day (line chart)

---

### 4.8 Billing (/api/billing)
| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | /status | ✅ | Подписка статус + план + credits |
| POST | /create-payment | ✅ | Создать платежную ссылку (Prodamus) |
| POST | /webhook | ❌ | Prodamus webhook (HMAC verified) |
| POST | /cancel | ✅ | Отменить подписку |

**Files**: `/backend/src/routes/billing.ts` (400+ строк)

#### Платежная система (Prodamus):
1. **Payment link creation**:
   - One-time: 386 рублей за месяц
   - Subscription: autoRenew (если config.prodamus.subscriptionId set)
   - Параметры: customer_email, order_id (subscription.id), urlSuccess, urlNotification
2. **Webhook processing**:
   - HMAC signature verify (signatureVerify)
   - Idempotency: PaymentEvent.claimPaymentEvent()
   - State tracking: PROCESSING → PROCESSED / FAILED
   - Stale processing detection: 10 min window
3. **Subscription management**:
   - Status: INACTIVE | ACTIVE | PAST_DUE | CANCELLED
   - currentPeriodStart / currentPeriodEnd
   - На активацию: user.plan = PRO, storageLimit = 1GB
   - На отмену: user.plan = FREE, storageLimit = 50MB

#### Особенности:
- **Price**: 386 РУБ за месяц (с возможностью переопределения)
- **Demo mode**: config.prodamus.demoMode=1 для тестирования
- **Webhook validation**: HMAC-SHA256 на raw body + signature header

---

### 4.9 Telegram Integration (/api/telegram)
| Метод | Endpoint | Auth | Описание |
|-------|----------|------|----------|
| GET | /status | ✅ | Проверить привязку Telegram |
| POST | /generate-link | ✅ | Создать deep link для бота (/start linkCode) |
| DELETE | /unlink | ✅ | Отвязать Telegram |
| GET | /submissions | ✅ | Последние заявки из форм |

**Files**: `/backend/src/routes/telegram.ts` (118 строк)

#### Telegram Bot логика:
1. **Bot polling**: Long polling (не webhooks)
2. **Commands**:
   - `/start VH_xxx`: Линкирование аккаунта
   - `/status`: Проверка привязки + список активных сайтов
   - `/help`: Справка
3. **Linking process**:
   - FE: /generate-link → linkCode + deepLink (`https://t.me/{botUsername}?start={linkCode}`)
   - Bot: `/start {linkCode}` → query DB → update chatId
   - Pending state: chatId = `pending:${userId}` до завершения
4. **Form submissions**:
   - Отправляет в Telegram с HTML parse mode
   - Fields: Project slug, hostname (custom или .hostingvibe.ru), form name, данные
   - Escape HTML для безопасности

---

### 4.10 Admin (/api/admin)
| Метод | Endpoint | Auth | Требование | Описание |
|-------|----------|------|-----------|----------|
| GET | /stats | ✅ | admin | Dashboard stats (users, projects, storage) |
| GET | /users | ✅ | admin | Список пользователей (paginated) |
| GET | /projects | ✅ | admin | Список проектов (paginated) |
| PATCH | /projects/:id/suspend | ✅ | admin | Suspend проект |
| PATCH | /users/:id/plan | ✅ | admin | Изменить план пользователю |

**Files**: `/backend/src/routes/admin.ts` (200+ строк)

#### Admin features:
- **Stats**: Total users, pro users, recent registrations, active projects, total storage
- **User search**: По email или displayName (case-insensitive)
- **Project management**: Search, suspend/unsuspend, view custom domains
- **Admin-only**: Проверка `isAdmin` флаг в DB

---

### 4.11 Public Endpoints
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | /api/report | Пожаловаться на проект (SPAM, MALWARE, PHISHING, ILLEGAL, COPYRIGHT, OTHER) |
| GET | /api/vibe-analytics.js | JS пиксель для аналитики |
| GET | /api/health | Health check (DB, storage, SMTP) |
| GET | /api/slugs/check | Проверить доступность slug |
| GET | /api/site-gate/:slug | Password gate для защищенных сайтов |
| POST | /api/site-auth | Auth check для Nginx auth_request |
| GET | /api/vibe-patches.js | Visual patches JS |
| GET | /api/vibe-editor-bridge.js | Editor bridge JS |

**Files**:
- `/backend/src/routes/report.ts` (68 строк)
- `/backend/src/routes/pixel.ts` (38 строк)
- `/backend/src/routes/health.ts` (39 строк)
- `/backend/src/routes/slug-check.ts` (27 строк)

#### Report система:
- Причины: SPAM, MALWARE, PHISHING, ILLEGAL, COPYRIGHT, OTHER
- Rate limit: 3 жалобы на IP в день
- IP: хешируется (SHA256 с датой)
- Status: PENDING | REVIEWED | RESOLVED | DISMISSED

#### Health check:
- Database: SELECT 1
- Storage: stat на sitesDir
- SMTP: verifySmtpConnection()
- Status: ok / degraded (if any critical failed)

---

## 5. Middleware

### 5.1 Auth Middleware (`middleware/auth.ts`)
- **optionalAuth()**: Sets userId if token valid, continues anonymous if not
- **authMiddleware()**: Requires valid token, checks tokenVersion
- **adminMiddleware()**: Requires admin flag
- Token priority: Bearer header > Cookie > Query param (deprecated)
- **CSRF protection**: Origin validation for cookie-based auth

### 5.2 Rate Limiting (`middleware/rateLimit.ts`)
| Limiter | Window | Max | Used |
|---------|--------|-----|------|
| loginLimiter | 15 min | 10 | /auth/login |
| registerLimiter | 15 min | 5 | /auth/register |
| deployLimiter | 1 hour | 5 | /deploy |
| forgotPasswordLimiter | 15 min | 3 | /auth/forgot-password |
| resetPasswordLimiter | 15 min | 5 | /auth/reset-password |
| siteGateLimiter | 15 min | 10 | /site-gate |
| apiLimiter | 1 min | 100 | Global fallback |

**Storage**: Redis (fallback: in-memory)

### 5.3 Upload Middleware (`middleware/upload.ts`)
- **Multer diskStorage**: `/var/www/vibe-hosting/uploads/`
- **Allowed MIME**: zip, gzip, tar, tgz
- **Size limit**: 500 MB (проверка per plan в route handler)
- **Filename**: `{timestamp}-{random}.{ext}`

---

## 6. Services

### 6.1 Deploy Service (`services/deploy.service.ts`)
**Ответственный за**:
- ZIP/TAR.GZ валидацию (path traversal, compression ratio, forbidden extensions)
- Extraction to temp dir
- Build detection (package.json) и npm build
- Copying to sites dir
- Backup management (keep last N versions)

**Key functions**:
- `validateZip()`: ZIP safety checks
- `extractZip()`: Safe extraction with symlink cleanup
- `validateExtractedDir()`: Same checks for tar.gz
- `detectBuildProject()`: Check for npm scripts
- `runBuild()`: npm ci/install → npm run build (3 min timeout, safe env)
- `processDeploy()`: Main async function
- `deleteProjectFiles()`: Cleanup sites dir

### 6.2 Domain Provision Service (`services/domain-provision.ts`)
**Ответственный за**:
- Nginx конфиг генерацию
- Let's Encrypt (certbot) интеграцию
- SSL сертификаты management
- Custom domain canonicalization

**Key functions**:
- `provisionDomain()`: Main provision flow
- `deprovisionDomain()`: Cleanup на удаление
- `generateNginxConfig()`: Создать server block
- `runCommand()`: Безопасное выполнение shell команд
- `syncCanonicalHostMap()`: Update `/etc/nginx/conf.d/vibe-canonical-hosts.map`

### 6.3 Telegram Service (`services/telegram.service.ts`)
**Ответственный за**:
- Bot polling и обработка команд
- Linking users к Telegram chatId
- Отправка заявок в Telegram

**Key functions**:
- `initTelegramBot()`: Start polling
- `sendFormToTelegram()`: Send form submission message
- `getTelegramBot()`: Get bot instance

### 6.4 Email Service (`services/email.service.ts`)
**Ответственный за**:
- Отправку трансакционных email

**Emails**:
1. Welcome email (при регистрации)
2. Password reset (с токеном)
3. Subscription activated
4. Subscription cancelled
5. Deployment notifications

**HTML templates**: Responsive email layout с Vibe branding

### 6.5 Analytics Service (`services/analytics.service.ts`)
**Ответственный за**:
- Tracking page views
- Aggregating analytics data

**Key functions**:
- `trackPageView()`: Insert view + increment counter
- `getProjectAnalytics()`: Fetch stats (total, today, week, month, top pages, referrers)

### 6.6 Email Events Service (`services/email-events.service.ts`)
**Ответственный за**:
- Idempotent email sending (dedupe via dedupeKey)
- Retry logic при failure

**Особенности**:
- `sendEmailOnce()`: Guarantees at-most-once delivery
- Stores EmailEvent в DB с статусом PENDING → SENT / FAILED
- Prevents duplicate emails via dedupeKey

---

## 7. Защита и валидация

### 7.1 Password Protection (Site-level)
- **Route**: `/api/site-gate/:slug` — Password gate page
- **Auth check**: `/api/site-auth` — Nginx auth_request handler
- **Implementation**: Nginx `auth_request` module + bcrypt
- **Cookie**: Session cookie после успешного ввода пароля

### 7.2 Rate Limiting
- **Redis-backed**: Rate-limit-redis store
- **Fallback**: In-memory (если Redis down)
- **Custom limiters**: Per endpoint с разными окнами/лимитами

### 7.3 Input Validation
- **Emails**: Simple regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Slugs**: `validateSlug()` — lowercase, alphanumeric + hyphens, not reserved
- **Hostnames**: Regex `/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/`
- **Selectors**: No `<>{}`, no `javascript:`, max 500 chars
- **Tags**: Max 10, 30 chars each
- **Form fields**: Max 20, 2048 chars each
- **File extensions**: Blacklist forbidden (php, sh, py, cgi, etc.)
- **Compression ratio**: Max 100:1 (ZIP bomb protection)

### 7.4 CORS / XSRF Protection
- **Helmet**: CSP, HSTS, X-Content-Type-Options, etc.
- **Origin check**: Whitelist config.corsOrigins + frontendUrl
- **Cookie auth**: Origin validation для mutating methods
- **Form CORS**: Allow *.hostingvibe.ru + verified custom domains

### 7.5 SQL Injection Prevention
- **Prisma**: Parameterized queries, type-safe
- **No raw SQL**: Все queries через Prisma client

### 7.6 XSS Prevention
- **displayName**: Basic HTML strip `replace(/<[^>]*>/g, '')`
- **Email templates**: `escapeHtml()` в service
- **Telegram messages**: `escapeHtml()` для HTML parse mode
- **Form data**: Stored as JSON, not interpolated into HTML

### 7.7 Path Traversal Protection
- **ZIP extraction**: `..` check + validateExtractedDir()
- **File paths**: `path.resolve()` sanity check
- **Nginx**: Properly configured try_files

---

## 8. Проблемы и найденные уязвимости

### 🔴 КРИТИЧНЫЕ

1. **Недостаточная sanitization displayName**
   - Использует простой regex `/[^>]*>/g` для удаления HTML тегов
   - Не защищает от HTML entities, event handlers в атрибутах
   - **Файл**: `auth.ts:50`, `projects.ts:351`
   - **Решение**: Использовать DOMPurify или более строгую валидацию

2. **Отсутствие rate limiting на form submissions**
   - Только in-memory дедупликация на 30 сек
   - Нет защиты от spam заявок (многих разных IP)
   - **Файл**: `forms.ts:142`
   - **Решение**: Добавить Redis rate limiter per project/day

3. **Build script execution без sandbox**
   - `npm run build` может читать другие site files, делать outbound requests
   - No cgroup/chroot/container изоляция
   - Комментарий в коде: "Known gap"
   - **Файл**: `deploy.service.ts:104-107`
   - **Решение**: systemd-run + PrivateTmp, или Docker container per build

4. **Insecure ZIP hash algorithm**
   - SHA256 достаточна, но без hmac или signing
   - Может быть exploited для cache poisoning
   - **Файл**: `deploy.ts:89-96`
   - **Решение**: Нет urgent, но monitor

5. **Email credentials in .env**
   - SMTP_PASS stored plaintext в .env
   - Must be gitignored (есть в .gitignore, но backup файл есть)
   - **Файл**: `.env` (не коммитится, но `.env.backup-20260309_161554` exists!)
   - **Решение**: Удалить .env.backup, rotate credentials

6. **Telegram bot polling (не webhooks)**
   - Long polling может быть слоу, не масштабируется
   - Но для 1-2 bot токенов ok
   - **Решение**: Мониторить latency, переходить на webhooks если растет

### 🟠 ВЫСОКИЕ

7. **Открытый доступ к admin endpoints**
   - Проверка `isAdmin` базируется только на DB флаге
   - Нет IP whitelist для admin API
   - **Файл**: `admin.ts:1`
   - **Решение**: Добавить IP whitelist, 2FA, audit logging

8. **Weak password requirements**
   - Только 8 символов, 1 буква + 1 цифра
   - Нет проверки на common passwords
   - **Файл**: `auth.ts:33-40`
   - **Решение**: Добавить zxcvbn или haveibeenpwned check

9. **No HTTPS enforcement**
   - `secure: true` in cookie, но frontend может быть на HTTP в dev
   - Нет HSTS redirect на backend
   - **Файл**: `auth.ts:73`
   - **Решение**: Добавить HSTS middleware

10. **Secrets в Telegram messages**
    - Если форма содержит API ключи, они идут в Telegram
    - Нет filtering или redaction
    - **Файл**: `telegram.service.ts:152-164`
    - **Решение**: Добавить pattern matching для secrets (detect API keys, hide)

### 🟡 СРЕДНИЕ

11. **No CAPTCHA на form submissions**
    - Может быть spam target
    - **Решение**: Добавить hCaptcha или reCAPTCHA v3

12. **Email enumeration via signup**
    - /register возвращает 409 если email exists
    - Могут быть enumerated existing emails
    - **Файл**: `auth.ts:42-46`
    - **Решение**: Всегда return 201, но send "check email" email

13. **No audit logging**
    - Нет логирования admin actions
    - Нет логирования user data deletions
    - **Файл**: `admin.ts`, `auth.ts:443` (delete account)
    - **Решение**: Добавить AuditLog модель + middleware

14. **Outdated dependencies**
    - multer 1.4.5-lts (очень старая версия)
    - cookie-parser 1.4.7 (2022)
    - Некоторые dev deps старые
    - **Файл**: `package.json`
    - **Решение**: npm audit, обновить если нет breaking changes

15. **No API versioning**
    - Все endpoints на /api/ без v1/v2
    - Breaking changes смломают старых клиентов
    - **Решение**: Добавить /api/v1/ prefix

### 🟢 НИЗКИЕ / ИНФОРМАЦИОННЫЕ

16. **Legacy query token auth**
    - ?token=xxx deprecated (Sunset header set), но еще работает
    - **Файл**: `auth.ts:136-144`
    - **Решение**: Set Deprecation header (done), schedule removal

17. **Missing error context**
    - Некоторые endpoints возвращают generic "Ошибка сервера"
    - Не достаточно info для debug'а
    - **Файл**: Multiple routes
    - **Решение**: Добавить requestId в all error responses (done!)

18. **No API documentation**
    - Нет OpenAPI/Swagger
    - **Решение**: Добавить swagger-jsdoc или automatic schema generation

19. **No request logging middleware**
    - Нет логирования всех HTTP requests
    - Winston логгер есть, но не используется глобально
    - **Решение**: Добавить morgan + winston интеграцию

---

## 9. Тарифы и лимиты

### FREE план
- **Проекты**: 1
- **Размер**: 50 MB per project
- **Всего**: 50 MB total
- **Версии**: 3 backup versions
- **Кастомные домены**: ❌ Нет
- **Цена**: Бесплатно, 30 дней expiration (?)

### PRO план
- **Проекты**: 3
- **Размер**: 500 MB per project
- **Всего**: 1 GB (1024 MB) total
- **Версии**: 15 backup versions
- **Кастомные домены**: ✅ Да
- **SSL**: Let's Encrypt (auto)
- **Цена**: 386 РУБ/месяц (Prodamus)
- **Подписка**: Auto-renew (опционально)

**Файл**: `config.ts:32-43`, `limits.ts`

---

## 10. Логирование

### Winston Logger (`services/logger.ts`)
- **Уровни**: error, warn, info, debug, verbose
- **Форматы**: JSON в prod, colored в dev
- **Файлы**: `/var/www/vibe-hosting/logs/` (?)
- **Использование**: Error handling, deploy tracking, auth failures

### RequestId
- Каждый request получает уникальный requestId
- Включается в all error responses
- Помогает для debugging и tracing

---

## 11. Deployment и конфигурация

### Environment Variables (`.env`)
```
PORT=7001
HOST=127.0.0.1
JWT_SECRET=<secret>
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379/4
UPLOAD_DIR=/var/www/vibe-hosting/uploads
SITES_DIR=/var/www/vibe-hosting/sites
BACKUPS_DIR=/var/www/vibe-hosting/backups
CORS_ORIGINS=["https://hostingvibe.ru"]
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=<email>
SMTP_PASS=<password>
SMTP_FROM=VibeHosting <noreply@hostingvibe.ru>
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_BOT_USERNAME=VibeHostingBot
SERVER_IP=203.0.113.10
FRONTEND_URL=https://hostingvibe.ru
BACKEND_URL=https://api.hostingvibe.ru
PRODAMUS_PAYFORM_URL=...
PRODAMUS_SECRET_KEY=...
PRODAMUS_SYSTEM_CODE=...
PRODAMUS_SUBSCRIPTION_ID=...
PRODAMUS_DEMO_MODE=0
NODE_ENV=production
```

### Build & Run
```bash
# Build
npm run build  # tsc

# Dev
npm run dev    # tsx watch src/index.ts

# Production
PM2_HOME=/root/.pm2 pm2 start ecosystem.config.js
```

### ecosystem.config.js (PM2)
- Должен содержать конфиг для backend (порт 7001)
- Auto-restart on crash
- Log files в `/root/.pm2/logs/`

---

## 12. Резюме: Архитектура и Design Patterns

### Архитектура
- **Monolithic Express.js**
- **MVC-like**: routes → middleware → services
- **Database**: Prisma ORM + PostgreSQL
- **Caching**: Redis (rate limiting)
- **File storage**: Filesystem (/var/www/vibe-hosting/)

### Design Patterns
- **Dependency Injection**: Minimal (could be improved)
- **Service Layer**: deploy.service, email.service, etc.
- **Middleware Stack**: Express middleware chaining
- **Error Handling**: Try-catch + logger + response
- **Async Processing**: Background jobs via processDeploy()

### Strengths ✅
- Solid auth (JWT + tokenVersion invalidation)
- Security-conscious (Helmet, CORS validation, CSP)
- Comprehensive rate limiting
- ZIP bomb protection
- Clean separation of concerns (routes/services)
- Idempotent email sending
- HMAC webhook verification

### Weaknesses ❌
- No sandbox for build execution
- Weak input sanitization (HTML strip regex)
- No audit logging
- Legacy query token support still enabled
- Outdated dependencies
- No automated testing visible
- Manual deploy process (no CI/CD visible)
- No observability / APM integration

---

## Итого

**Backend VibeHosting** — это полнофункциональная хостинг-платформа с:
- ✅ Надежной аутентификацией и авторизацией
- ✅ Защитой от распространенных атак (CSRF, XSS, SQL injection, path traversal, ZIP bomb)
- ✅ Масштабируемой архитектурой (Redis rate limiting, async deploy)
- ❌ Но с несколькими критичными гэпами (build sandbox, input sanitization, no audit log)

**Рекомендации для следующего этапа**:
1. Добавить строгую HTML sanitization (DOMPurify)
2. Sandbox для user code execution (systemd-run)
3. Audit logging middleware
4. CAPTCHA на form submissions
5. Обновить dependencies (особенно multer)
6. Добавить API documentation (OpenAPI/Swagger)
7. API rate limiting per user/project (не только IP)
8. Email secret redaction
