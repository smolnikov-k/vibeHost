# Аудит фич VibeHosting — Детальное исследование

**Дата:** 2026-03-21
**Путь:** `/root/vibecode/vibe-hosting/`

Это comprehensive audit каждой фичи продукта: архитектура, flow, ограничения, баги и рекомендации.

---

## 1. Деплой ZIP-архивов

### Файлы
- **Backend:** `backend/src/routes/deploy.ts`, `backend/src/services/deploy.service.ts`
- **Frontend:** `frontend/src/app/(dashboard)/projects/[id]/deploy/`

### Архитектура

#### Backend flow (deploy.ts)
1. **Upload endpoint:** `POST /:id/deploy` (auth required, rate-limited)
   - Multer middleware захватывает ZIP/TAR.GZ файл в `/tmp`
   - Проверка размера против плана (FREE: 50MB, PRO: 500MB)
   - Расчет SHA256 хэша стрима (без загрузки файла в RAM)
   - Создание записи Deployment с версией
   - Файл переименовывается в `/uploads/{deploymentId}.zip`
   - **Возвращает:** deploymentId для SSE-подписки

2. **Background processing (deploy.service.ts → processDeploy)**
   - **Статусы:** PENDING → EXTRACTING → BUILDING → LIVE
   - **Валидация ZIP:**
     - Распаковка в `/tmp/vibe-extract-{deploymentId}`
     - Проверка максимальное количество файлов (10000)
     - Валидация расширений файлов (запрещены: .exe, .bat, .sh и т.д.)
     - Удаление symlinks для предотвращения path traversal
     - Автоопределение root-префикса (если файлы в подпапке)

3. **Автобилд (если package.json с build script)**
   - Обнаружение: `detectBuildProject()` ищет `package.json`
   - Очистка опасных lifecycle-hooks (preinstall, postinstall, prepare)
   - `npm ci --ignore-scripts` + `npm run build` (3-min timeout)
   - Safe env: только PATH, HOME, LANG, NODE_ENV (НЕ DATABASE_URL, JWT_SECRET)
   - Поиск output: `dist/` > `build/` > `out/` > `.output/public/`
   - **Требование:** должен быть `index.html` в output

4. **Auto-inject скрипты**
   - `vibe-forms.js` — перехват форм → Telegram
   - `vibe-patches.js` — применение визуальных патчей runtime
   - `vibe-analytics.js` — встроенная аналитика
   - `Yandex.Metrika` (если metrikaId установлен)

5. **Atomic swap + backup**
   - Старая версия: `{siteDir}` → `/backups/{slug}/v{currentVersion}`
   - Новая версия: `/tmp/vibe-extract-...` → `{siteDir}`
   - Расчет финального размера и количества файлов
   - **Transaction:** обновляет Deployment, Project, User.storageUsed + архивирует старый backup

6. **Cleanup old backups**
   - FREE план: хранит последнюю версию (~1 версия)
   - PRO план: последние 5 версий
   - Версии старше лимита удаляются автоматически

#### SSE потоком
- `GET /:id/deployments/:deployId/stream` (Server-Sent Events)
- Polling БД каждые 1.5 сек
- Терминальные статусы: `LIVE`, `FAILED`, `SUPERSEDED`
- `X-Accel-Buffering: no` для Nginx

### Тарифные ограничения
```
FREE:  maxSiteSize=50MB,  maxVersions=1
PRO:   maxSiteSize=500MB, maxVersions=5
```

### Потенциальные проблемы

1. **Опасность сборки (BUILD):** Код `npm run build` работает в хосте без изоляции
   - ⚠️ **Риск:** вредоносный скрипт может читать файлы других пользователей из `/sites/`
   - **Текущие щиты:** safe env, 3-min timeout, --ignore-scripts
   - **Gap:** нет cgroup/chroot/container-per-build

2. **Symlink removal:** Рекурсивный обход может быть медленным на больших деревьях

3. **Race condition на rollback:**
   - Если два rollback одновременно → может быть потеря данных
   - **Текущее решение:** project-operation-lock

4. **Деллой при fail:** Если backup создался, но деплой упал → оставляет stale файлы в `/tmp`

### Улучшения
- Добавить container-per-build (Docker, systemd-run)
- Добавить Web UI для rollback версий
- Кэширование npm dependencies между бильдами
- Более детальные логи сборки в UI

---

## 2. Визуальный редактор (Patches)

### Файлы
- **Backend:** `backend/src/routes/edit.ts`
- **Frontend:** `frontend/src/components/editor/VibeEditor.tsx`, `StyleEditor.tsx`
- **Инъекция:** `backend/src/app/api/vibe-editor-bridge.js`
- **Runtime:** `frontend/public/api/vibe-patches.js`

### Архитектура

#### Система патчей (patches)
Визуальные правки сохраняются как JSON-структуры:
```typescript
interface VisualPatch {
  id: string
  projectId: string
  selector: string        // CSS selector (.class, #id, tag, etc)
  type: 'text'|'image'|'hide'|'style'
  content: string | null  // зависит от type
  enabled: boolean
  order: number           // для применения в порядке
}
```

#### Backend endpoints (edit.ts)

**Pages:** `GET /:id/edit/pages`
- Сканирует `/sites/{slug}` рекурсивно
- Пропускает папки: node_modules, .git, img, assets
- Возвращает список .html файлов с размером и временем изменения

**Preview:** `GET /:id/edit/preview?path=index.html`
- Инъектирует bridge script перед `</body>`
- Добавляет `<base href=...>` для asset resolution
- Позволяет iframe загружать сайт пользователя с токеном в query (token=JWT)

**Patches CRUD:**
- `GET /:id/edit/patches` — список патчей для проекта
- `POST /:id/edit/patches` — создать новый патч
  - Валидация selector (max 500 chars, без `<>{}`, `javascript:`, `expression`)
  - Лимит 200 патчей на проект
  - Для style-типов: парсит JSON, проверяет только разрешённые CSS-свойства
  - **ALLOWED_STYLE_PROPS:** color, fontSize, fontWeight, textAlign, padding, margin, backgroundColor, borderRadius, opacity, boxShadow и т.д.
- `PUT /:id/edit/patches/:patchId` — обновить
- `DELETE /:id/edit/patches/:patchId` — удалить

**Assets:** `POST/GET /:id/edit/assets`
- Upload: максимум 10MB, типы: img/jpeg, img/png, img/gif, img/webp, img/avif, font/woff, font/woff2, video/mp4, video/webm
- Сохраняется в `/sites/{slug}/img/{filename}`
- Возвращает HTTPS URL

#### Frontend editor (VibeEditor.tsx)

**Bridge система (postMessage):**
1. Iframe (содержит пользовательский сайт) ↔ Panel (редактор)
2. Messages:
   - `vibe-bridge:init` — инициализировать bridge
   - `vibe-bridge:ready` — iframe готов
   - `vibe-bridge:select` — клик на элемент → передать selector, tag, text, src, styles
   - `vibe-bridge:preview` — live preview изменений
   - `vibe-bridge:reset` — отменить превью
   - `vibe-bridge:deselect` — отменить выделение

**UI компоненты:**
- Список страниц (dropdown)
- Pages list и Preview (split view)
- Боковая панель:
  - Tabs: Text, Image, Hide, Style
  - Text tab: textarea для редактирования текста + preview
  - Image tab: upload/выбор из assets + preview
  - Hide tab: просто чекбокс
  - Style tab: StyleEditor компонент (JSON редактор CSS-свойств)
- Список сохранённых патчей с toggle enable/disable и delete

**Limitations:**
- Только CSS-селектор-based (не может редактировать структуру HTML)
- Не может создавать новые элементы
- Не поддерживает drag-and-drop
- Нет undo/redo (можно удалить и пересоздать)
- Preview обновляется за ~500ms (не real-time)

#### Runtime injection (vibe-patches.js)

На каждом развёрнутом сайте автоматически инъектируется скрипт:
```html
<script src="https://hostingvibe.ru/api/vibe-patches.js" data-slug="mysite" defer></script>
```

Скрипт:
1. Загружает список патчей с API: `GET /api/vibe-patches/{slug}` (cached 60sec)
2. Применяет в порядке (по order):
   - **text:** `querySelector(selector).textContent = content`
   - **image:** `querySelector(selector).src = content`
   - **hide:** `querySelector(selector).style.display = 'none'`
   - **style:** `Object.assign(querySelector(selector).style, JSON.parse(content))`

### Потенциальные проблемы

1. **XSS при text-патчах:**
   - ⚠️ Использует `.textContent` (safe), не `.innerHTML`
   - **Current:** OK, но нужна валидация на бэкенде

2. **Selector injection:**
   - ⚠️ Regex валидация селектора может быть обойдена сложными селекторами
   - **Пример:** `:not(.safe)` не заблокирован явно
   - **Risk:** низкий, так как селектор просто не найдёт элемент

3. **CSS injection через style-патчи:**
   - ⚠️ Проверяется only property names, не values
   - **Пример:** `{ color: 'red; border: 1px solid url(javascript:alert(1))' }`
   - **Risk:** CSS expressions в старом IE, но современные браузеры safe

4. **Race condition на патчах:**
   - Два simultaneous PUT/DELETE → conflict
   - **Current:** нет оптимистичных lock, relies на БД constraints

5. **Нет версионирования патчей:**
   - Если пользователь случайно удалит патч → нельзя восстановить
   - Backup версий сайта содержит старые патчи (в БД), не в файлах

### Улучшения
- Добавить undo/redo (localStorage queue)
- Drag-and-drop для переупорядочивания патчей
- Более гибкие селекторы (класс + индекс, nth-child)
- Preview in real-time (WebSocket или частые polling)
- Batch update патчей (POST /patches/batch)
- История изменений патчей (created_by, created_at)

---

## 3. Формы → Telegram

### Файлы
- **Backend:** `backend/src/routes/forms.ts`, `backend/src/services/telegram.service.ts`
- **Инъекция:** `backend/src/app/api/vibe-forms.js`

### Архитектура

#### Frontend (vibe-forms.js injection)
Инъектируется автоматически в каждый сайт:
```html
<script src="https://hostingvibe.ru/api/vibe-forms.js" data-slug="mysite" defer></script>
```

Скрипт перехватывает все `<form>` элементы:
1. Слушает `submit` event
2. Собирает form data (FormData API)
3. Adds internal fields:
   - `_vibe_form_name` — опциональное имя формы (из `data-form-name` или `id`)
   - `_vibe_redirect` — опциональный redirect URL после submit
4. Отправляет POST на `https://hostingvibe.ru/api/forms/{slug}`
5. Обрабатывает ответ (JSON)

#### Backend flow (forms.ts)

**POST /api/forms/:slug**
1. **Lookup project** по slug и проверка статуса (должен быть LIVE)
2. **CORS middleware:** разрешены only *.hostingvibe.ru и verified custom domains
3. **Data extraction:**
   - Максимум 20 полей
   - Максимум 2048 символов на поле
   - Фильтрует поля, начинающиеся на `_vibe_`
   - IP hashing (SHA256 дневного IP хэша для приватности)

4. **Deduplication:**
   - Ключ = hash(slug + hashedIp + formData)
   - Window = 30 сек
   - В памяти хранится max 5000 записей (периодически очищается)
   - Защита от double-submit и replay-attack

5. **Telegram sending:**
   - Lookup user's telegramLink.chatId
   - Форматирует красивое сообщение:
     ```
     📩 Новая заявка
     🌐 Сайт: mysite.hostingvibe.ru
     📋 Форма: Contact Form

     Name: John Doe
     Email: john@example.com
     Message: Hello!
     ```
   - Отправляет через Telegram Bot API

6. **Database save:**
   - Сохраняет в FormSubmission с encrypted/hashed IP
   - Отмечает, отправлена ли в Telegram (sentToTg flag)

7. **Response:**
   - JSON: `{ success: true, sentToTelegram: true }`
   - Если был redirect — вместо JSON делает `res.redirect(url)`

#### Telegram Bot (telegram.service.ts)
- `initTelegramBot()` — стартует polling
- `/start {linkCode}` — привязать Telegram чат к аккаунту
  - Проверяет код из БД (linkCode)
  - Связывает chatId с пользователем
  - Отправляет подтверждение
- `/status` — показать привязанные сайты
- Сообщения отправляются с HTML парсингом (escapeHtml)

### Потенциальные проблемы

1. **IP hashing:**
   - ⚠️ Хэш пересчитывается каждый день (от IP + сегодняшняя дата)
   - **Risk:** за 30 сек от одного IP можно отправить ~60 форм (если разные данные)
   - **Mitigation:** разумно, но не идеально для DDoS

2. **CORS validation:**
   - ⚠️ Проверяет `origin` header, но может быть spoofed в старых браузерах
   - **Current:** используется `URL()` парсер, safe от null bytes

3. **Form data limits:**
   - 20 fields, 2048 chars each — может быть обойдено multipart
   - **Current:** нет явной проверки Content-Length

4. **Telegram link exposure:**
   - ⚠️ Если chatId скомпрометирован → все формы пойдут в чужой чат
   - **Mitigation:** пользователь может отвязать через UI

5. **No rate-limit на формы:**
   - Спамер может заполнить дедуп-кэш и потом отправить 5000 форм подряд
   - **Текущее решение:** relies на клиентском rate-limit и CORS

### Улучшения
- Добавить backend rate-limit (x-rate-limit headers)
-더블-проверка Telegram link перед отправкой
- Форма с сохранением в UI + просмотр submissions в дашборде
- Webhook support (не только Telegram)
- Custom form builder (не только auto-capture)

---

## 4. QR-коды

### Файлы
- **Backend:** `backend/src/routes/projects.ts` (GET /:id)
- **Frontend:** компонент в дашборде

### Архитектура

QR-код **не реализован как отдельная фича**.

В коде нет:
- Генерации QR-кодов (нет `qrcode` пакета)
- Эндпоинта для QR
- Frontend компонента

**Вероятное назначение:** Было бы для sharing сайта (URL → QR).

### Статус: Не реализовано

---

## 5. Кастомные домены

### Файлы
- **Backend:** `backend/src/routes/domains.ts`, `backend/src/services/domain-provision.ts`
- **Frontend:** `frontend/src/app/(dashboard)/projects/[id]/domains/`

### Архитектура

#### Backend flow (domains.ts)

**GET /api/domains** — список доменов пользователя
- Список с проектом и DNS информацией

**POST /api/domains** — добавить новый домен
- Проверка: план PRO required
- Валидация формата домена (regex)
- Проверка: домен не зарегистрирован другим пользователем
- Генерирует `verifyToken` (UUID)
- Возвращает DNS инструкции:
  ```json
  {
    "a": { "type": "A", "name": "@", "value": "203.0.113.10" },
    "txt": { "type": "TXT", "name": "_vibe-verify.example.com", "value": "uuid..." }
  }
  ```

**POST /api/domains/:id/verify** — проверить DNS и автоматически провизионить SSL
1. **DNS проверка:** 3 варианта
   - A запись на сервер IP (203.0.113.10)
   - CNAME на *.hostingvibe.ru
   - TXT запись с verifyToken на `_vibe-verify.example.com`

2. **SSL provisioning:**
   - Если DNS проверена, запускает `provisionDomain()` (domain-provision.ts)
   - Использует Let's Encrypt + Certbot webhook
   - Сохраняет сертификат в `/etc/letsencrypt/live/example.com/`

3. **Nginx reload:**
   - После успеха, регенерирует Nginx конфиг
   - Reload Nginx (безопасный способ)

#### Domain provisioning (domain-provision.ts)

```typescript
export async function provisionDomain(hostname: string): Promise<void>
```

1. **Pre-checks:**
   - DNS resolve для A record
   - Проверка connectivity к серверу

2. **Certbot flow:**
   ```bash
   certbot certonly --webroot -w /root/vibecode/vibe-hosting/public \
     -d example.com --non-interactive --agree-tos
   ```
   - Использует DNS hook + TXT record для validation
   - Автоматическое обновление (--auto-renew)

3. **Nginx config generation:**
   - Для каждого verified домена создаёт separate server block
   - Проксирует на локальный сайт: `proxy_pass http://localhost:7001/sites/slug/...`

#### Site-gate (site-gate.ts)

Обработка доступа по custom домену:
- Nginx auth_request к `/api/site-auth` проверяет password
- CORS для cross-origin scripts на custom domain

### Потенциальные проблемы

1. **DNS validation timing:**
   - ⚠️ Может быть race condition если DNS не распространилась
   - **Current:** simple resolve4, no retry logic
   - **Improvement:** exponential backoff, multiple retries

2. **SSL certificate lifecycle:**
   - ⚠️ Let's Encrypt имеет rate-limits (50 cert/week per domain)
   - **Risk:** если много пользователей создадут домены на одной основе

3. **Nginx reload safety:**
   - ⚠️ Неправильный конфиг → all sites down
   - **Current:** relies на validation перед reload
   - **Improvement:** test конфиг перед reload (`nginx -t`)

4. **Domain ownership validation:**
   - ⚠️ Только DNS-based, no email-based verification
   - **Risk:** пользователь может заклеймить чужой домен (если DNS простой)
   - **Mitigation:** TXT record уникален для каждой попытки

### Улучшения
- Добавить email-based verification
- Retry logic на DNS resolution
- Web UI для управления certificates
- Auto-renewal notifications
- Поддержка wildcard доменов

---

## 6. Яндекс.Метрика

### Файлы
- **Backend:** `backend/src/services/deploy.service.ts` (injectYandexMetrika)
- **Database:** Project.metrikaId field

### Архитектура

#### Setup
1. Пользователь вводит свой **Яндекс.Метрика ID** (счётчик ID)
2. Сохраняется в `Project.metrikaId`

#### Injection
На деплое, скрипт автоматически инъектируется в `</head>` каждого HTML файла:
```html
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){...})
   ym(12345, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true });
</script>
<noscript><img src="https://mc.yandex.ru/watch/12345" /></noscript>
<!-- /Yandex.Metrika counter -->
```

#### Limitation
- Только счётчик ID, никаких custom events
- Метрика работает через внешний сервис (yandex.ru)
- Нет встроенного дашборда в VibeHosting

### Потенциальные проблемы

1. **ID Sanitization:**
   - ⚠️ Удаляет все non-digits из ID
   - **Risk:** низкий, но может быть typo

2. **Duplicate injection:**
   - ⚠️ Если пользователь уже имеет скрипт → duplicate
   - **Current:** проверка `if (html.includes('mc.yandex.ru/metrika'))` пропускает файл
   - **Status:** OK

### Улучшения
- Дашборд с метриками inside VibeHosting
- Поддержка multiple счётчиков
- Custom events API

---

## 7. Защита паролем

### Файлы
- **Backend:** `backend/src/routes/projects.ts` (password endpoints), `backend/src/routes/site-gate.ts`
- **Database:** Project.passwordEnabled, Project.passwordHash

### Архитектура

#### Setup (backend/routes/projects.ts)

**POST /:id/password** — установить пароль
```json
{ "password": "mypassword" }
```
- bcrypt хеширование (salt rounds = 10)
- Сохраняется в Project.passwordHash
- Set `passwordEnabled = true`

**GET /:id/password** — проверить статус (enabled/disabled)

**DELETE /:id/password** — отключить пароль
- Set `passwordEnabled = false`
- Очищает `passwordHash`

#### Access control (site-gate.ts)

На каждый HTTP request к сайту, Nginx делает **auth_request** к `/api/site-auth`:

1. **Определение slug:**
   - Из Host header: `mysite.hostingvibe.ru` → slug = mysite
   - Или из custom домена

2. **Проверка project:**
   - Lookup по slug
   - Если нет passwordEnabled → return 200 OK

3. **Cookie verification:**
   - Cookie name: `vibe_access_{slug}`
   - Token = HMAC-SHA256(slug, passwordHash)
   - timing-safe comparison
   - Max-age = 7 дней

4. **Response:**
   - 200 OK → Nginx пропускает
   - 401 → Nginx показывает password page (custom HTML)

#### Frontend password form
- HTML форма на `/password?slug=...`
- Отправляет POST к `/api/site-password` с паролем
- Проверка + установка cookie
- Redirect на сайт

### Потенциальные проблемы

1. **HMAC token generation:**
   - ⚠️ Token = HMAC(slug, passwordHash)
   - **Risk:** если пользователь меняет пароль → старый token остаётся valid на 7 дней
   - **Mitigation:** приемлемо для use case

2. **Cookie in plain HTTP:**
   - ⚠️ Если custom домен не на HTTPS → cookie уязвим
   - **Current:** force HTTPS в Nginx
   - **Status:** OK

3. **Brute-force атаки:**
   - ⚠️ Нет rate-limit на попытки пароля
   - **Risk:** спамер может перебирать пароли
   - **Improvement:** добавить rate-limit

4. **Password change:**
   - Если пользователь меняет пароль → все старые sessions остаются valid
   - **Improvement:** добавить `passwordVersion` counter

### Улучшения
- Rate-limit на попытки пароля (5 попыток per IP per минуту)
- Password change invalidates all sessions
- Более стильный пароль page
- Support для multiple passwords (для разных users)

---

## 8. Тарифы Free/Pro

### Файлы
- **Backend:** `backend/src/utils/limits.ts`, `backend/src/routes/projects.ts`, `backend/src/routes/billing.ts`
- **Database:** User.plan field

### Лимиты

```typescript
FREE:
  - maxProjects: 1
  - maxSiteSize: 50 * 1024 * 1024 (50 MB)
  - maxVersions: 1
  - maxFileCount: 10000
  - customDomains: false
  - analytics: false

PRO:
  - maxProjects: 3
  - maxSiteSize: 500 * 1024 * 1024 (500 MB)
  - maxVersions: 5
  - maxFileCount: 10000
  - customDomains: true
  - analytics: true
```

### Проверка лимитов

На каждой операции:
```typescript
const limits = getPlanLimits(user.plan);
if (projectCount >= limits.maxProjects) {
  res.status(403).json({ error: 'Лимит проектов' });
}
```

**Где проверяется:**
1. **Создание проекта:** `POST /projects`
2. **Деплой ZIP:** `POST /projects/:id/deploy` (size check)
3. **Добавление домена:** `POST /domains` (plan === 'PRO')
4. **Откат версии:** `POST /projects/:id/rollback` (version count check)

### Billing (billing.ts)

**Payment provider:** Prodamus (Russian payment gateway)

**Flow:**
1. `POST /billing/checkout` — создать платёжную сессию
   - Генерирует order ID (UUID)
   - Отправляет на Prodamus
   - Возвращает payment URL

2. `POST /billing/webhook` — webhook от Prodamus
   - HMAC-SHA256 verification (Prodamus key)
   - Claim event (дедупликация)
   - Update User.plan = 'PRO'
   - Обновляет subscription status

3. `GET /billing/status` — проверить подписку
   - Возвращает текущий план и дату следующего платежа

### Потенциальные проблемы

1. **Upgrade/downgrade logic:**
   - ⚠️ При downgrade PRO → FREE:
     - Если 3 проекта → нельзя сделать что-то до удаления
     - Current: нет автоматического downgrade
   - **Improvement:** warning перед downgrade

2. **Billing idempotency:**
   - ⚠️ Webhook может прийти несколько раз
   - **Current:** `claimPaymentEvent()` с unique constraint
   - **Status:** OK

3. **Version limit enforcement:**
   - ⚠️ Если пользователь downgrade PRO → FREE с 5 версиями → остаются старые
   - **Current:** cleanup только при новом деплое
   - **Improvement:** cleanup на downgrade

### Улучшения
- Admin panel для управления планами
- Trial period (14 дней)
- Более granular тарифы
- Usage alerts (90% storage, etc)

---

## 9. Галерея сайтов (Gallery/Showcase)

### Файлы
- **Backend:** `backend/src/routes/gallery.ts`
- **Frontend:** `frontend/src/app/gallery/`

### Архитектура

#### Публичный каталог

**GET /api/gallery** — список опубликованных сайтов
```json
{
  "projects": [
    {
      "id": "...",
      "slug": "mysite",
      "title": "My Awesome Site",
      "description": "A cool landing page",
      "tags": ["design", "portfolio"],
      "likes": 42,
      "views": 123,
      "customDomain": "mysite.com",
      "isLiked": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```

**Query params:**
- `page`, `limit` (default: 20)
- `sort`: newest, popular (по likes), views
- `tag`: фильтр по тегу
- `q`: поиск по title/description (contains, case-insensitive)

**Counting:**
- `views` — deduplicated по IP (1 hour cooldown in-memory)
- `likes` — для auth users в БД, для guests в memory Map

#### Popular tags

**GET /api/gallery/meta/tags** — top 30 тегов
- Aggregate from all public projects
- Кэш не используется (вычисляется каждый раз)

#### Like system

**POST /api/gallery/:slug/like** — toggle like

**For authenticated users:**
- Проверка в БД (table ProjectLike)
- Transaction для atomic increment/decrement likes

**For guests:**
- IP hash (SHA256(ip + 'salt')) хранится в memory Map
- Max 5000 IPs в памяти
- Cleanup every 10 minutes

### Потенциальные проблемы

1. **View counting (dedupe):**
   - ⚠️ In-memory Map со слабым ключом (IP)
   - **Risk:** если сервер перезагрузится → потеря dedupe состояния
   - **Mitigation:** 1 hour window приемлем
   - **Improvement:** Redis для хранения

2. **Like spam:**
   - ⚠️ Для guests нет rate-limit
   - **Risk:** один IP может лайкать много раз
   - **Current:** деду по IP, но нет per-IP cooldown
   - **Improvement:** Redis + rate-limit per IP

3. **Tag aggregation:**
   - ⚠️ Берёт максимум 2000 projects, может быть < реального количества
   - **Current:** comment `quick-fix safeguard`
   - **Improvement:** proper pagination aggregation

4. **Search performance:**
   - ⚠️ LIKE запросы без индекса на (title, description)
   - **Current:** Prisma mode: 'insensitive' может быть slow
   - **Improvement:** fulltext index или Elasticsearch

### Улучшения
- Redis для dedupe + rate-limit
- Sorting по relevance (weighted title + description)
- Featured projects section
- User profiles + follow
- Comments on projects

---

## 10. Автосборка проектов

### Файлы
- **Backend:** `backend/src/services/deploy.service.ts` (detectBuildProject, runBuild)

### Поддерживаемые фреймворки

#### Detection
```typescript
function detectBuildProject(dir: string): string | null {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (pkg.scripts?.build) return 'build';
  return null;
}
```

**Логика:** просто проверяет наличие `npm run build` скрипта.

#### Build output detection
Приоритет:
1. `dist/` (Vite, SvelteKit)
2. `build/` (Create React App, Next.js старый)
3. `out/` (Next.js static export)
4. `.output/public/` (Nuxt)

**Требование:** в output должен быть `index.html`

#### Supported stacks

**Implicitly supported** (any stack с `npm run build`):
- React (Vite)
- Vue (Vite)
- Next.js (static export: `next build`)
- Svelte (SvelteKit: `npm run build`)
- Astro (`npm run build`)
- Hugo (если есть build скрипт)
- Jekyll
- Eleventy
- Gatsby
- etc.

**Not supported:**
- SSR (Next.js с Node требует)
- PHP, Python backend
- Monorepos (пока)

### Build процесс

```bash
# 1. Clean dangerous hooks
rm pkg.scripts.preinstall
rm pkg.scripts.postinstall
rm pkg.scripts.prepare

# 2. Install
npm ci --ignore-scripts    # или npm install

# 3. Build
NODE_ENV=production npm run build

# 4. Find output
ls dist/index.html        # Success!
```

### Потенциальные проблемы

1. **Lifecycle hooks:**
   - ⚠️ Удаляются preinstall, postinstall, prepare, prepublish hooks
   - **Risk:** некоторые легитимные пакеты используют эти hooks
   - **Current:** решение работает для большинства
   - **Improvement:** более granular filtering

2. **Build timeout:**
   - ⚠️ 3 minutes может быть мало для больших проектов
   - **Risk:** Next.js full build может превышать timeout
   - **Mitigation:** разумно для shared hosting

3. **Node modules pollution:**
   - ⚠️ После `npm ci`, `/tmp/vibe-extract-xxx/node_modules` удаляется
   - **Current:** OK, но может быть медленно для больших деревьев

4. **TypeScript ошибки:**
   - ⚠️ Если `npm run build` кончается с `tsc` error → деплой fails
   - **Current:** нет fallback
   - **Improvement:** suggest fixes в UI

### Улучшения
- Support для монорепо (lerna, nx)
- Custom build command configuration
- Build artifact caching (node_modules)
- Increased timeout (но с limits на ресурсы)
- Better error messages

---

## Резюме: Основные находки

### 🟢 Сильные стороны
1. **Безопасность деплоя:** валидация расширений, symlink removal, safe env for builds
2. **Автоматизм:** auto-inject scripts (forms, patches, analytics, Metrika)
3. **Версионирование:** easy rollback с backup системой
4. **Простота:** ZIP + auto-build + auto-publish = 3 клика
5. **Интеграции:** Telegram, Яндекс.Метрика, custom домены

### 🟡 Среднего приоритета
1. **Build isolation:** нет sandbox, потенциально может читать файлы других сайтов
2. **Rate-limit:** недостаточно на формах и likes
3. **Деплой документация:** нет в UI, только через API
4. **Selector validation:** может быть обойдена сложными селекторами
5. **Performance:** dedupe в памяти, без Redis

### 🔴 Требует внимания
1. **Нет QR-кодов:** фича заявлена, не реализована
2. **Password bruteforce:** нет rate-limit
3. **Метрика дашборд:** только инъекция, нет встроенной аналитики
4. **Gallery spam:** лайки могут быть спамлены

### 📈 Top приоритеты
1. Build sandboxing (container-per-build)
2. Rate-limit на forms, password, likes
3. Redis для dedupe, sessions
4. QR-код генерация
5. Gallery: search optimization, featured projects

---

## ДОПОЛНИТЕЛЬНЫЕ НАХОДКИ (Deep Audit 2026-03-21)

### A. GitHub Deploy (как 11-я фича)

**Файлы:** `backend/src/routes/deploy.ts` (POST /:id/deploy-github), `backend/src/services/github.service.ts`

**Архитектура:**
1. **Endpoint:** `POST /:id/deploy-github`
   - Input: `{ repoUrl: "https://github.com/user/repo", subdir?: "client" }`
   - Валидация URL через regex: `/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/`
   - Лимиты тот же что и для ZIP

2. **Clone & Deploy:**
   - `git clone --depth 1 {repoUrl}` (shallow clone)
   - Удаление `.git` папки
   - Поиск `index.html` в root или в subdir
   - Валидация расширений (same forbidden list)
   - Проверка размера + count файлов

3. **Output:**
   - Возвращает deploymentId для SSE-подписки
   - Процесс: create deployment → background clone → validate → optionally build → deploy

**Потенциальные проблемы:**
- ⚠️ **Git clone timeout:** нет явного timeout, может hang на больших repos
- ⚠️ **Субдиректория валидация:** path.resolve() check может быть слаб против symlinks в repo
- ⚠️ **No auth на GitHub:** public repos only, private требует token (не поддерживается)

**Улучшения:**
- Поддержка private repos (GitHub token в settings)
- Timeout на git clone (30 сек)
- Branch/tag selection UI

---

### B. Analytics & Pixel Tracking

**Файлы:** `backend/src/routes/analytics.ts` (GET /analytics.ts), `backend/src/routes/pixel.ts` (GET /vibe-analytics.js)

**Архитектура:**
1. **Analytics Pixel:** `vibe-analytics.js` (100-200 байт minified)
   - Auto-detects slug from hostname или data attribute
   - sendBeacon API для отправки (fallback: XMLHttpRequest)
   - Payload: `{ slug, path, referrer }`
   - Поддерживает cross-domain (custom domains)

2. **Tracking Endpoint:** `POST /api/track`
   - Receives `{ slug, path, referrer }`
   - Собирает IP, User-Agent автоматически
   - Country geo-location (если доступен)
   - Сохраняет в PageView таблицу

3. **Analytics Dashboard:** `GET /:id/analytics?days=30`
   - Aggregate by day, path, referrer
   - Возвращает: total views, top pages, traffic sources, browser stats
   - Лимит: 30-90 дней (default 30)

**Потенциальные проблемы:**
- ⚠️ **Privacy:** сохраняет IP в plaintext (хотя для analytics нужен)
- ⚠️ **Ad blockers:** sendBeacon может быть заблокирована
- ⚠️ **GeoIP lookup:** нет явного geo-сервиса (relies on IP location)
- ⚠️ **Duplicate tracking:** нет дедупликации по session (только IP + path)

**Улучшения:**
- Add session tracking (localStorage + JWT)
- Anonymous country-only tracking (no IP storage)
- Real-time updates (WebSocket)
- Custom event tracking API

---

### C. Детали Security & Rate-Limiting

#### Rate-Limiting (middleware/rateLimit.ts)
- `deployLimiter` на `/deploy` и `/deploy-github` endpoints
- Default: 5 requests per minute per IP
- Uses Redis или в-памяти fallback
- **Gap:** нет per-user rate-limit (per-IP только)

#### Security Headers (security.ts)
- CSP: `default-src 'self'; script-src 'self' https://...`
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Но **allows iframes for preview** (умышленно для editor)

#### Upload Security (middleware/upload.ts)
- Multer с fileSize limit 500MB
- MIME type validation
- Filename sanitization
- **Gap:** нет scan на malware (would require ClamAV)

---

### D. Database Schema Deep Dive

**Key models для фич:**
1. **VisualPatch** — editor patches
   - `selector`: CSS selector (index не используется, может быть медленно на больших проектах)
   - `xpath`: резерв для future (не используется)
   - Нет версионирования

2. **FormSubmission** — захваченные формы
   - `data` JSON field — не зашифрована
   - Индекс на (projectId, createdAt) — good
   - **Gap:** нет аналитики (count по формам)

3. **Deployment** — версии
   - `zipHash` — SHA256 для dedup (но не используется)
   - `status` enum из 6 states
   - **Gap:** нет куратора deployment logs

4. **Domain** — кастомные домены
   - `verified` boolean, `verifyToken` — one-time use
   - `sslStatus` enum — PENDING/PROVISIONING/ACTIVE/FAILED/EXPIRED
   - **Gap:** нет tracking на renewal dates

**Missing models:**
- Нет `SessionToken` или `APIKey` tables (все через JWT)
- Нет `AuditLog` для compliance
- Нет `WebhookLog` для debugging

---

### E. Performance & Scalability Issues

1. **Gallery tags aggregation:**
   - `findMany` на всех public projects (2000 limit = quick-fix)
   - **Risk:** O(n) memory для tag counting
   - **Fix:** use `groupBy` in Prisma или raw SQL

2. **Patch application at runtime:**
   - vibe-patches.js iterates all patches for a site
   - **Risk:** 100+ patches = slow rendering
   - **Fix:** sort by selector, batch querySelectorAll

3. **Deployment streaming:**
   - SSE polling every 1.5 sec
   - **Risk:** если много users → 100 requests/min to DB
   - **Fix:** implement proper Server-Sent Events или WebSocket

4. **In-memory dedup maps:**
   - `guestLikes`, `recentViews`, `recentSubmissions` все unbounded
   - **Cleanup:** every 10 min, но if exceeds 5000 → drop half
   - **Risk:** memory bloat, no LRU eviction

---

### F. Missing Features Found

1. **QR Code** — declared in spec, not in code
   - Would need: `qrcode` package
   - Endpoint: `GET /api/projects/:id/qr` → PNG/SVG
   - Use case: sharing siteURL via phone

2. **Email notifications** — only Telegram
   - Could add: form notification emails
   - Could add: deployment status emails

3. **Webhooks** — not exposed
   - Could allow: custom integrations
   - Use case: Slack, Discord, custom services

4. **API Key auth** — not implemented
   - Only JWT via login
   - Could allow: CI/CD integration

5. **Cron jobs** — not implemented
   - Could clean old deployments
   - Could renew SSL certs
   - Uses **not PM2-based jobs**, manual cleanup

---

### G. Known Bugs & Quirks

1. **Icon files in projects:**
   - `.ico` extension не в forbiddenExtensions, but safe (browser won't execute)
   - Minor: could add to ignoredFiles

2. **Nginx permission reset:**
   - После deploy, `setNginxPermissions()` runs chmod
   - **Risk:** if Nginx user misconfigured → 404 on files
   - **Mitigation:** проверка в CI

3. **Yandex.Metrika injection:**
   - Добавляет ID в скрипт, но не escapes HTML
   - **Risk:** низкий (ID должен быть numeric), but could be stricter: `/\\d+/`

4. **CORS на forms:**
   - Проверяет `origin` header, but `Host` header от Nginx может быть другой
   - **Mitigation:** используется `X-Original-Host` header

---

**Дата сбора:** 2026-03-21 | **Источник:** Полный code review всех routes и services
