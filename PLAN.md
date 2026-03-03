# Vibe Hosting — Архитектура и план реализации

## Контекст

Создаём сервис **Vibe Hosting** (`hostingvibe.ru`) — хостинг для статических сайтов с AI-редактированием, ориентированный на вайб-кодеров (людей, которые кодят с помощью AI). Пользователь загружает ZIP-архив / HTML-файл / ссылку на GitHub-репо, получает мгновенную ссылку `slug.hostingvibe.ru`. Конкуренты (Tiiny.host, Static.app, dplooy) дороги, не работают на RU-рынке и не имеют AI-редактирования.

**Способы деплоя:**
- ZIP-архив (drag & drop)
- Одиночный HTML-файл
- Ссылка на GitHub-репозиторий (клонирование, поиск index.html)

**Тарифы (общий лимит хранилища — юзер сам распределяет между сайтами):**
- **FREE:** 1 сайт, 50 МБ общее хранилище, субдомен `slug.hostingvibe.ru`, 10 AI-запросов, 10 ГБ трафик/мес
- **PRO (386 руб/мес):** 3 сайта, 200 МБ общее хранилище, кастомные домены, аналитика, откат версий, 20 AI-запросов/мес, безлимит трафик
- **AI-запросы:** докупаются пакетами (10 шт = 99 ₽, 50 шт = 399 ₽)

---

## Стек

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| **Backend** | Express.js + TypeScript | Файловые операции, shell-команды (unzip, certbot, nginx reload), фоновые задачи |
| **Frontend** | Next.js 16 (App Router) + Tailwind + anime.js 4.0 | Проверенный паттерн + мощные анимации |
| **Дизайн** | Светлая тема, зелёный акцент (#22c55e / emerald) | Предпочтение владельца |
| **БД** | PostgreSQL 16 + Prisma | Есть на сервере, Prisma используется в mini-crm |
| **Очередь** | BullMQ + Redis (db 4) | Деплой ZIP, генерация SSL — фоновые задачи. Redis уже есть |
| **AI** | GigaChat API (Сбер) | RU-модель, рублёвая оплата, работа без VPN |
| **Платежи** | Prodamus | RU-рынок, подписки, рекурренты, SBP |
| **Порты** | Backend: 7001, Frontend: 7002 | Свободный диапазон 7000-7999 |
| **PM2** | `vibe-backend` + `vibe-frontend` | ~120 МБ RAM суммарно |

---

## Схема БД (Prisma)

```
User            — id, email, passwordHash?, displayName, plan(FREE/PRO), role(USER/ADMIN), storageUsed, storageLimit, telegramChatId?, emailVerified(bool), oauthProvider?(YANDEX/VK), oauthId?(string), deletedAt?
Project         — id, userId, slug(unique), title, description, sizeBytes, fileCount, status(UPLOADING/PROCESSING/LIVE/ERROR/SUSPENDED), isPublic, tags[], likes, views, currentVersion, metrikaId(string?)
Deployment      — id, projectId, version, sizeBytes, fileCount, status(PENDING/EXTRACTING/LIVE/FAILED/SUPERSEDED), zipHash
Domain          — id, projectId, userId, hostname(unique), verified, verifyToken, sslStatus(PENDING/PROVISIONING/ACTIVE/FAILED)
Subscription    — id, userId(unique), prodamusOrderId, status(INACTIVE/ACTIVE/PAST_DUE/CANCELLED), priceRub(386), currentPeriodStart, currentPeriodEnd
AiTokenBalance  — id, userId(unique), balance(int), freeGranted(int), totalPurchased(int), totalUsed(int)
AiTokenPurchase — id, userId, amount(int), priceRub(int), prodamusOrderId, createdAt
AiEditLog       — id, projectId, userId, elementSelector(string), filePath(string), prompt(string), oldHtml(text), newHtml(text), tokensUsed(int), status(SUCCESS/FAILED/REVERTED), createdAt
PageView        — id, projectId, path(string), ip(string), referer(string?), userAgent(string?), country(string?), city(string?), device(DESKTOP/MOBILE/TABLET), createdAt
EmailVerification — id, userId, token(string), expiresAt, usedAt?
PasswordReset   — id, userId, token(string), expiresAt, usedAt?
Report          — id, slug(string), reason(PHISHING/MALWARE/PORN/SPAM/COPYRIGHT), reporterEmail?, adminNote?, status(PENDING/REVIEWED/ACTED), createdAt
TrafficUsage    — id, projectId, month(string "2026-03"), bytesServed(bigint)
```

---

## Хранение файлов

```
/var/www/vibe-hosting/
  sites/{slug}/          ← Извлечённые сайты (Nginx отдаёт напрямую)
  uploads/{userId}/      ← Временные ZIP (удаляются после извлечения)
  backups/{slug}/v{N}/   ← Предыдущие версии (только PRO)
```

- Slug глобально уникален → плоская структура `sites/{slug}/`
- Nginx читает директорию напрямую, zero config changes при деплое

---

## Nginx архитектура

### 1. Главный сайт `hostingvibe.ru` → Next.js (7002) + API (7001)

```
hostingvibe.ru       → proxy_pass 127.0.0.1:7002 (фронтенд)
hostingvibe.ru/api/  → proxy_pass 127.0.0.1:7001 (бэкенд, client_max_body_size 55M)
```

### 2. Wildcard `*.hostingvibe.ru` → статика

```nginx
server {
    server_name *.hostingvibe.ru;
    # Извлекаем slug из субдомена
    set $slug "";
    if ($host ~* ^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru$) { set $slug $1; }
    root /var/www/vibe-hosting/sites/$slug;
    try_files $uri $uri/ /index.html;
}
```

- **Wildcard SSL:** Certbot DNS-01 challenge (через Cloudflare или ручной DNS TXT)
- **Ноль изменений конфига при деплое** — просто создаём папку `sites/{slug}/`
- **HTTPS-редирект:** принудительный http → https (301)
- **Gzip/Brotli:** сжатие HTML, CSS, JS, SVG, JSON (gzip_types + brotli_types)
- **Cache headers:** статика (jpg, png, css, js, woff2) → Cache-Control: max-age=31536000, immutable
- **HTML:** Cache-Control: no-cache (всегда свежий)
- **Security headers:** X-Frame-Options, X-Content-Type-Options, Referrer-Policy

### 3. Кастомные домены → отдельный конфиг на каждый

Генерируем `/etc/nginx/sites-available/vibe-custom-{domainId}.conf` программно + certbot для SSL.

---

## Флоу загрузки (Upload → Deploy)

```
1. POST /api/projects/{id}/deploy (multipart ZIP)
2. Валидация: размер, лимит сайтов, план
3. Сохранение в uploads/, создание Deployment(PENDING)
4. BullMQ job "deploy":
   a) Проверка ZIP: бомба? traversal? запрещённые файлы (.php/.exe)?
   b) Извлечение во /tmp/vibe-extract-{id}/
   c) Проверка: есть index.html?
   d) Atomic swap: старую версию → backups/, новую → sites/{slug}/
   e) chown www-data, обновление БД
5. Сайт live на slug.hostingvibe.ru (Nginx подхватывает автоматом)
```

---

## AI-редактирование сайта (GigaChat)

### Концепция

Пользователь открывает свой опубликованный сайт в режиме редактирования через дашборд. На сайт инжектится скрипт-оверлей, который позволяет кликнуть на **любой элемент** страницы. После клика появляется поле ввода: «Что изменить?». Пользователь пишет запрос на естественном языке (например: «Сделай этот заголовок красным», «Перепиши текст более продающим», «Добавь тень к этому блоку», «Замени картинку на котика»). GigaChat получает HTML элемента + контекст страницы + промпт пользователя и возвращает изменённый HTML/CSS.

### Флоу AI-редактирования

```
1. Пользователь открывает проект в дашборде → кнопка "AI-редактор"
2. Сайт загружается в iframe с инжектированным скриптом vibe-editor.js
3. Скрипт включает режим выделения: hover подсветка, клик = выбор элемента
4. Выбранный элемент:
   a) Подсвечивается рамкой
   b) Появляется попап с полем ввода промпта
   c) Показывается CSS-селектор и текущий HTML (сокращённо)
5. POST /api/ai/edit {projectId, filePath, selector, prompt, elementHtml, pageContext}
6. Backend:
   a) Проверка баланса AI-токенов
   b) Списание токена (1 запрос = 1 токен)
   c) Формирование промпта для GigaChat:
      - Системный промпт: "Ты — веб-редактор. Изменяй только запрошенный элемент..."
      - HTML элемента + окружающий контекст
      - Запрос пользователя
   d) Запрос к GigaChat API → получение изменённого HTML
   e) Валидация ответа (санитизация, проверка что HTML корректен)
   f) Применение изменений к файлу на диске (sites/{slug}/...)
   g) Сохранение в AiEditLog (old/new HTML, для отката)
7. Фронтенд обновляет iframe → пользователь видит результат
8. Кнопки: "Принять" / "Откатить" / "Попробовать другой вариант"
```

### Типы AI-операций

| Операция | Описание | Запросы |
|----------|----------|--------|
| **Изменение текста** | Переписать, перевести, сократить контент | 1 |
| **Изменение стиля** | Цвет, шрифт, размер, тень, отступы | 1 |
| **Изменение структуры** | Добавить/удалить блок, переставить элементы | 1 |
| **Генерация контента** | Написать секцию с нуля, FAQ, отзывы | 1 |
| **Любая AI-правка** | 1 клик = 1 запрос, без разделения по сложности | 1 |

### Мультистраничные сайты в AI-редакторе

```
- Сайт может содержать несколько HTML-файлов (index.html, about.html, contacts.html и т.д.)
- В AI-редакторе слева — файловый навигатор: дерево HTML-файлов проекта
- Пользователь выбирает файл → он загружается в iframe
- AI-правки применяются к конкретному файлу (filePath передаётся в запросе)
- GET /api/projects/:id/files — список файлов проекта (html, css, js, images)
- GET /api/projects/:id/files/:path — содержимое файла для превью
```

### История правок и откат версий

```
AI-редактор работает как чат:
- Справа — панель чата: каждое AI-изменение = сообщение с превью (было → стало)
- Возле каждого сообщения кнопка "↩ Откатить до этого момента"
  - Откат = восстановление файла до состояния на момент ЭТОЙ правки
  - Все последующие правки помечаются REVERTED в AiEditLog
  - Файл на диске перезаписывается из oldHtml соответствующей записи

Панель сохранённых версий (отдельно от AI-правок):
- Каждый деплой = версия (v1, v2, v3...)
- FREE: хранится 3 последние версии
- PRO: хранится 15 последних версий
- Кнопка "Откатить к версии N" → atomic swap из backups/{slug}/v{N}/
- POST /api/projects/:id/rollback {version: N}
- Старые версии за лимитом автоматически удаляются при новом деплое
```

### Скрипт vibe-editor.js (инжекция в iframe)

```
- Подсветка элементов при hover (outline + overlay)
- Клик → определение CSS-селектора (уникального)
- Попап-редактор с полем промпта
- WebSocket/SSE для стриминга ответа AI
- Превью изменений (diff: было/стало)
- Undo/Redo стек (на основе AiEditLog)
```

### AI-запросы (тарификация)

```
- FREE: 10 запросов при регистрации (одноразово, не обновляются)
- PRO: 20 запросов/мес (обновляются с каждым периодом подписки)
- Докупка: POST /api/billing/buy-tokens {package: 10|50}
  - 10 запросов = 99 ₽
  - 50 запросов = 399 ₽
- Баланс отображается в хедере дашборда
- При balance=0 → AI-кнопки disabled, предложение докупить
- 1 запрос = 1 AI-правка (независимо от сложности)
```

### GigaChat интеграция

```
- API: https://gigachat.devices.sberbank.ru/api/v1/chat/completions
- Авторизация: OAuth2 (client_id + client_secret → access_token)
- Модель: GigaChat-Pro (для качества) или GigaChat (для экономии)
- Токены обновляются каждые 30 минут (кэш в Redis)
- Системный промпт хранится в config, тюнится отдельно
- Fallback: если GigaChat недоступен → сообщение "Сервис временно недоступен"
```

---

## Деплой с GitHub

```
1. POST /api/projects/{id}/deploy-github {repoUrl}
2. Валидация URL (github.com/user/repo)
3. git clone --depth 1 repoUrl /tmp/vibe-github-{id}/
4. Поиск index.html: корень → dist/ → build/ → public/ → docs/
5. Если найден → копирование в sites/{slug}/ (как обычный деплой)
6. Если не найден → ошибка "index.html не найден"
7. Очистка /tmp/vibe-github-{id}/
```

---

## Флоу кастомного домена

```
1. POST /api/domains {hostname, projectId} → verifyToken
2. Пользователь добавляет CNAME → hostingvibe.ru в DNS
3. POST /api/domains/{id}/verify → проверка DNS (dns.promises)
4. BullMQ job "provision-ssl":
   a) Генерация Nginx конфига (HTTP-only)
   b) nginx -t && nginx -s reload
   c) certbot --webroot -d hostname
   d) Обновление конфига с SSL
   e) nginx -s reload
```

---

## Платежи (Prodamus)

```
1. POST /api/billing/create-payment
   → GET/POST на {domain}.payform.ru с параметрами:
     do=link, products[0][name]="Vibe Hosting PRO", products[0][price]=386,
     subscription={id}, urlNotification=/api/billing/webhook,
     urlSuccess=/billing/success
   → Возвращаем ссылку на оплату

2. Webhook POST /api/billing/webhook
   → Проверка подписи (HMAC с секретным ключом)
   → Активация подписки, обновление User.plan = PRO

3. Рекуррент через subscription_* параметры Prodamus
```

---

## API эндпоинты

| Группа | Метод | Путь | Описание |
|--------|-------|------|----------|
| Auth | POST | `/api/auth/register` | Регистрация + email верификация |
| Auth | POST | `/api/auth/login` | Вход → JWT |
| Auth | GET | `/api/auth/me` | Текущий пользователь |
| Auth | POST | `/api/auth/verify-email` | Подтвердить email по токену |
| Auth | POST | `/api/auth/forgot-password` | Запросить сброс пароля |
| Auth | POST | `/api/auth/reset-password` | Сбросить пароль по токену |
| Auth | GET | `/api/auth/yandex` | Редирект на Яндекс OAuth |
| Auth | GET | `/api/auth/yandex/callback` | Callback от Яндекс ID |
| Auth | GET | `/api/auth/vk` | Редирект на VK OAuth |
| Auth | GET | `/api/auth/vk/callback` | Callback от VK ID |
| Projects | GET | `/api/projects` | Список проектов |
| Projects | POST | `/api/projects` | Создать проект (title, slug) |
| Projects | GET | `/api/projects/:id` | Детали проекта |
| Projects | PUT | `/api/projects/:id` | Обновить метаданные (title, tags, metrikaId...) |
| Projects | DELETE | `/api/projects/:id` | Удалить проект + файлы |
| Deploy | POST | `/api/projects/:id/rollback` | Откатить к версии N |
| Deploy | POST | `/api/projects/:id/deploy` | Загрузить ZIP или HTML-файл |
| Deploy | POST | `/api/projects/:id/deploy-github` | Деплой с GitHub |
| Deploy | GET | `/api/projects/:id/deployments` | Список деплоев |
| AI | POST | `/api/ai/edit` | AI-редактирование элемента |
| AI | POST | `/api/ai/revert/:editId` | Откатить AI-правку |
| AI | GET | `/api/ai/history/:projectId` | История AI-правок |
| AI | GET | `/api/ai/balance` | Баланс AI-токенов |
| AI | POST | `/api/billing/buy-tokens` | Докупить AI-токены |
| Domains | GET | `/api/domains` | Список доменов |
| Domains | POST | `/api/domains` | Добавить домен |
| Domains | DELETE | `/api/domains/:id` | Удалить домен |
| Domains | POST | `/api/domains/:id/verify` | Проверить DNS |
| Billing | POST | `/api/billing/create-payment` | Создать оплату |
| Billing | POST | `/api/billing/webhook` | Webhook Prodamus |
| Billing | GET | `/api/billing/status` | Статус подписки |
| Gallery | GET | `/api/gallery` | Публичные проекты |
| Gallery | POST | `/api/gallery/:slug/like` | Лайк |
| Files | GET | `/api/projects/:id/files` | Список файлов проекта |
| Files | GET | `/api/projects/:id/files/*path` | Содержимое файла |
| Analytics | GET | `/api/projects/:id/analytics` | Аналитика (PRO) |
| Analytics | POST | `/api/track` | Трекинг просмотра (от JS-пиксела) |
| Export | GET | `/api/projects/:id/export` | Скачать ZIP текущей версии |
| Report | POST | `/api/report` | Жалоба на сайт |
| Telegram | POST | `/api/telegram/link` | Сгенерировать код привязки |
| Telegram | POST | `/api/telegram/webhook` | Webhook от Telegram-бота |
| Account | DELETE | `/api/auth/delete-account` | Удалить аккаунт |
| Admin | GET | `/api/admin/dashboard` | Общая статистика |
| Admin | GET | `/api/admin/users` | Список пользователей |
| Admin | GET | `/api/admin/projects` | Список проектов |
| Admin | GET | `/api/admin/reports` | Жалобы на модерации |
| Admin | POST | `/api/admin/projects/:id/suspend` | Заморозить проект |
| Admin | POST | `/api/admin/projects/:id/unsuspend` | Разморозить проект |
| Utility | GET | `/api/slugs/check?slug=` | Проверка slug |
| Utility | GET | `/api/health` | Healthcheck |

---

## Структура проекта

```
/root/vibecode/vibe-hosting/
  ecosystem.config.js

  backend/
    package.json
    tsconfig.json
    prisma/
      schema.prisma
    src/
      index.ts                    # Express entry
      config.ts                   # Env vars, constants
      middleware/
        auth.ts                   # JWT verify
        rateLimit.ts
        upload.ts                 # Multer (50MB limit)
      routes/
        auth.ts
        projects.ts
        deploy.ts
        domains.ts
        billing.ts
        gallery.ts
        ai.ts                     # AI-редактирование, баланс, история
        admin.ts                  # Админ-панель: юзеры, проекты, модерация
        report.ts                 # Жалобы на контент
        telegram.ts               # Webhook Telegram-бота
      services/
        deploy.service.ts         # ZIP extraction, validation
        github.service.ts         # GitHub clone + deploy
        nginx.service.ts          # Config generation, reload
        ssl.service.ts            # Certbot
        storage.service.ts        # Disk usage tracking
        billing.service.ts        # Prodamus API
        dns.service.ts            # DNS verification
        gigachat.service.ts       # GigaChat API: OAuth, completions
        ai-edit.service.ts        # HTML parsing, apply edit, sanitize
        email.service.ts          # Nodemailer, шаблоны уведомлений
        analytics.service.ts      # Трекинг просмотров, GeoIP
        screenshot.service.ts     # Puppeteer: скриншоты сайтов
        telegram.service.ts       # Telegram Bot API: уведомления
        export.service.ts         # Формирование ZIP для скачивания
      workers/
        deploy.worker.ts          # BullMQ: deploy jobs
        ssl.worker.ts             # BullMQ: SSL provisioning
        cleanup.worker.ts         # Cron: subscriptions, cleanup
      templates/
        nginx-custom-domain.conf.ts
      utils/
        zip.ts                    # ZIP validation helpers
        slug.ts                   # Slug validation
        limits.ts                 # Лимиты по планам (сайты, хранилище, трафик, AI)

  frontend/
    package.json
    next.config.ts
    src/
      app/
        layout.tsx                # Root (ru locale)
        page.tsx                  # Лендинг
        (auth)/login/page.tsx
        (auth)/register/page.tsx
        (dashboard)/
          layout.tsx              # Dashboard с sidebar
          projects/page.tsx       # Список проектов
          projects/new/page.tsx   # Новый проект
          projects/[id]/page.tsx  # Проект + деплой
          projects/[id]/editor/page.tsx  # AI-редактор (iframe + оверлей)
          domains/page.tsx
          billing/page.tsx
          billing/tokens/page.tsx  # Покупка AI-токенов
          settings/page.tsx        # Настройки + удаление аккаунта + Telegram
        (admin)/
          layout.tsx              # Админ layout (проверка role=ADMIN)
          page.tsx                # Дашборд: статистика, MRR
          users/page.tsx          # Список юзеров
          projects/page.tsx       # Список проектов
          reports/page.tsx        # Жалобы / модерация
        gallery/page.tsx          # Публичная галерея
        gallery/[slug]/page.tsx
        terms/page.tsx            # Пользовательское соглашение
        privacy/page.tsx          # Политика конфиденциальности
        offer/page.tsx            # Публичная оферта
      components/
        ui/                       # Button, Card, Input, Modal
        layout/                   # Header, Sidebar
        projects/                 # ProjectCard, FileUploader
        editor/                   # AiEditor, ElementSelector, PromptPopup, DiffPreview
      lib/
        api.ts                    # Fetch wrapper с JWT
        auth.ts                   # useAuth hook
      public/
        vibe-editor.js            # Скрипт инжекции для AI-редактора (загружается в iframe)
```

---

## Лендинг (главная страница) — WOW-уровень

```
Библиотека анимаций: anime.js 4.0 (npm i animejs, 24 КБ)
Принцип: каждая секция анимируется при скролле (scroll-triggered), плавно и чётко

Секции:
1. Hero:
   - Заголовок "Загрузи сайт за 30 секунд" — появляется посимвольно (anime stagger)
   - Drag & drop зона с пульсирующей рамкой (anime loop)
   - Фоновый градиент медленно анимируется
   - CTA-кнопка "Попробовать бесплатно" — масштаб + glow при hover
   - Счётчик: "Уже 1,234 сайта на VibeHosting" — числа анимируются (anime countup)

2. Как это работает (3 шага):
   - Шаги появляются последовательно при скролле (stagger с задержкой)
   - Иконки шагов: SVG с line-draw анимацией (anime SVG)
   - Линия-коннектор между шагами рисуется по мере скролла
   - 1: Загрузи → 2: Получи ссылку → 3: Редактируй через AI

3. AI-редактор (wow-секция):
   - Интерактивная демо-анимация: имитация клика на элемент → появление промпта → изменение
   - Реализация: предзаписанный сценарий на anime.js timeline
   - "Кликни на элемент — опиши изменение — готово"
   - Фейковый iframe с подсветкой элементов

4. Тарифы:
   - Карточки FREE vs PRO — появляются с 3D-flip эффектом
   - PRO-карточка с градиентной рамкой (shine-эффект анимирован)
   - Пакеты AI-запросов — slide-in снизу

5. Галерея:
   - Карусель/бегущая строка лучших публичных сайтов
   - Скриншоты со скролл-параллаксом
   - Hover → приближение + тень

6. FAQ:
   - Аккордеон с плавным раскрытием (anime height)
   - 6-8 вопросов: форматы, лимиты, домены, AI, безопасность

7. Footer:
   - Контакты, ссылки, юридическое
   - Логотип с hover-анимацией

Дизайн-система:
- Светлая тема (white/gray-50 фоны)
- Акцент: зелёный (Tailwind emerald-500 #10b981 / green-500 #22c55e)
- Кнопки: bg-emerald-500 hover:bg-emerald-600 text-white
- Градиенты: from-emerald-400 to-green-500
- Карточки: bg-white border border-gray-200 rounded-2xl shadow-sm
- PRO-бейдж: градиент emerald → green с shine-анимацией
- Типографика: Inter / system font, тёмный текст (gray-900)

Общие принципы анимаций во всём проекте:
- anime.js для всех анимаций (не CSS transitions)
- Scroll-triggered: элементы появляются при скролле (IntersectionObserver + anime)
- Плавные easing: easeOutExpo, easeOutElastic, spring()
- Стаггер (stagger) для списков и карточек
- Skeleton loading для данных (пульсирующие блоки)
- Микроанимации: кнопки, переключатели, табы, уведомления
- Page transitions: fade/slide между страницами дашборда
- Drag & drop: spring-physics при перетаскивании ZIP
- Дашборд: карточки проектов появляются с stagger, графики рисуются anime-линиями
- AI-редактор: подсветка элемента с пульсом, попап с easeOutElastic
```

---

## Email-уведомления

```
Сервис: Nodemailer + Яндекс SMTP (или Brevo free tier)
Шаблоны:
1. Подтверждение регистрации (верификация email)
2. Восстановление пароля (ссылка с токеном, 1 час)
3. Деплой завершён (успех / ошибка)
4. AI-запросы заканчиваются (осталось ≤ 3)
5. Подписка истекает через 3 дня
6. Подписка отменена / не продлилась
```

---

## Аналитика (PRO)

```
Для каждого проекта (только PRO):
- Просмотры по дням (график за 30 дней)
- Уникальные посетители (по IP/fingerprint)
- География (страна, город — через GeoIP-lite)
- Рефереры (откуда пришли)
- Топ страниц (для мультистраничных сайтов)
- Устройства (desktop/mobile/tablet)

Реализация: лёгкий JS-трекер инжектится в сайт (1x1 pixel или fetch),
данные пишутся в отдельную таблицу PageView (projectId, path, ip, referer, ua, country, createdAt)

Яндекс Метрика (пользовательская):
- В настройках проекта поле "ID Яндекс Метрики" (число)
- Если заполнено → при отдаче сайта Nginx инжектит счётчик Метрики в </body>
- Реализация: Nginx sub_filter или инжекция при деплое (добавляем <script> в HTML)
- Вариант 1 (Nginx): sub_filter "</body>" "<script>...</script></body>"
- Вариант 2 (при деплое): модифицируем HTML-файлы, вставляя счётчик перед </body>
- Вариант 2 надёжнее — работает и для кастомных доменов без доп. конфигов
- Пользователь вводит только ID счётчика, скрипт генерируется автоматически
```

---

## Превью сайтов (скриншоты)

```
- При успешном деплое: генерация скриншота через Puppeteer (headless Chrome)
- Скриншот сохраняется как /var/www/vibe-hosting/previews/{slug}.png
- Используется в карточке проекта (дашборд) и в галерее
- Обновляется при каждом деплое и после AI-правок
- Fallback: дефолтная заглушка если Puppeteer не доступен
```

---

## SEO и мета-теги

```
- Лендинг: title, description, OG-image, structured data (Organization)
- Галерея: уникальные title/description для каждого проекта
- OG-картинки: скриншот сайта для шеринга в соцсетях
- sitemap.xml для галереи (публичные проекты)
- robots.txt: разрешить индексацию лендинга и галереи
```

---

## Юридические страницы

```
- /terms — Пользовательское соглашение
- /privacy — Политика конфиденциальности
- /offer — Публичная оферта (для Prodamus)
- Ссылки в footer лендинга и в форме регистрации
```

---

## 404 и ошибочные страницы

```
Когда slug не существует или сайт suspended:
- Брендированная 404-страница VibeHosting
  - Лого + "Сайт не найден"
  - CTA: "Создай свой сайт на VibeHosting за 30 секунд"
  - Ссылка на лендинг
- Кастомная 404: если юзер положил 404.html в корень сайта — Nginx подхватывает его
- SUSPENDED: "Сайт приостановлен" + ссылка на support
- Nginx: error_page 404 /404.html; + fallback на дефолтную
```

---

## Модерация контента

```
- Жалоба: любой может отправить POST /api/report {slug, reason}
- Причины: фишинг, малварь, порно, спам, нарушение авторских прав
- Админ получает уведомление (email + Telegram)
- Админ может: SUSPEND проект (сайт показывает заглушку), DELETE проект
- Автомодерация (v2): проверка контента на фишинг-паттерны при деплое
- Модель Report: id, slug, reason(enum), reporterEmail?, status(PENDING/REVIEWED/ACTED), createdAt
```

---

## Экспорт / скачивание сайта

```
- Кнопка "Скачать ZIP" на странице проекта в дашборде
- GET /api/projects/:id/export → ZIP-архив текущей версии сайта (включая AI-правки)
- Формируется на лету: архивируем sites/{slug}/ → стрим в ответ
- Полезно: юзер сделал AI-правки и хочет забрать обновлённый код
```

---

## Автодаунгрейд (подписка истекла)

```
- Cron-задача (cleanup.worker.ts): каждый час проверяет подписки
- Если currentPeriodEnd < now() && status != CANCELLED:
  1. User.plan = FREE
  2. User.storageLimit = 50 МБ
  3. Subscription.status = CANCELLED
  4. Если сайтов > 1: самые новые сайты → status = SUSPENDED
  5. Если storageUsed > 50 МБ: уведомление "Удалите файлы или продлите PRO"
  6. Email-уведомление: "Подписка закончилась, ваш план — FREE"
- За 3 дня до окончания: email-напоминание о продлении
```

---

## Лимит трафика

```
- FREE: 10 ГБ/мес
- PRO: безлимит
- Подсчёт: Nginx access log → cron-задача считает байты по slug за текущий месяц
- При превышении FREE лимита: сайт показывает заглушку "Лимит трафика исчерпан"
- Модель TrafficUsage: id, projectId, month(string "2026-03"), bytesServed(bigint)
- Или упрощённый вариант: не считать на MVP, добавить позже
```

---

## Админ-панель

```
Путь: /admin (доступ только для admin-юзеров, проверка по email/role)
Страницы:
1. Дашборд: общая статистика (юзеры, проекты, деплои, доход)
2. Пользователи: список, поиск, план, хранилище, бан
3. Проекты: список, статус, размер, последний деплой
4. Модерация: жалобы (Report), suspend/unsuspend
5. Доходы: подписки, покупки AI-токенов, MRR
6. AI-статистика: запросы/день, топ юзеров, расход на GigaChat

Реализация: отдельная группа роутов /api/admin/* с middleware isAdmin
```

---

## Удаление аккаунта (152-ФЗ)

```
- Кнопка "Удалить аккаунт" в настройках
- Подтверждение паролем
- DELETE /api/auth/delete-account
- Каскадное удаление: юзер → проекты → деплои → домены → файлы с диска
- Email: "Ваш аккаунт удалён"
- Грейс-период: 7 дней (можно восстановить через support)
- После 7 дней: полная очистка данных
```

---

## Telegram-бот (уведомления)

```
- В настройках профиля: кнопка "Подключить Telegram"
- Генерируется уникальный код → юзер отправляет его боту → привязка
- Уведомления через бот:
  1. Деплой завершён (успех/ошибка)
  2. AI-запросы заканчиваются (≤ 3)
  3. Подписка истекает через 3 дня
  4. Жалоба на сайт (для админа)
- Модель: User.telegramChatId (string?)
- Библиотека: telegraf или node-telegram-bot-api
- PM2: отдельный процесс не нужен — webhook mode через Express
```

---

## Авторизация через соцсети (OAuth)

```
Яндекс ID:
- Регистрация приложения: https://oauth.yandex.ru/
- OAuth2 Authorization Code Flow
- Scopes: login:email, login:info
- Callback: /api/auth/yandex/callback
- Получаем: email, displayName, avatarUrl
- Если email уже есть в БД → логиним, иначе → создаём аккаунт

VK ID:
- Регистрация приложения: https://dev.vk.com/
- OAuth2 Authorization Code Flow
- Scopes: email
- Callback: /api/auth/vk/callback
- Получаем: email, first_name, last_name, photo
- Аналогичная логика: есть email → логин, нет → регистрация

Общее:
- User.oauthProvider (YANDEX/VK/null), User.oauthId (string?)
- Если юзер зашёл через соцсеть — пароль не обязателен
- Кнопки на странице входа: "Войти через Яндекс" / "Войти через ВКонтакте"
- Можно привязать соцсеть к существующему аккаунту в настройках
```

---

## Логирование и мониторинг

```
Backend:
- Winston: структурированные логи (JSON), уровни info/warn/error
- Файлы: /var/log/vibe-hosting/app.log + error.log (ротация через winston-daily-rotate)
- Sentry: отлов исключений, performance monitoring, source maps
- Каждый запрос логируется: method, path, userId, statusCode, responseTime
- AI-запросы: отдельный лог с промптом, ответом GigaChat, токенами, latency

Frontend:
- Sentry Browser SDK: ошибки JS, performance
- Web Vitals: LCP, FID, CLS → отправка в Sentry

Health checks:
- GET /api/health → { status, db, redis, disk, uptime }
- PM2 мониторинг: pm2 monit, pm2 plus (опционально)
- Uptime Robot или аналог: пинг каждые 5 минут, алерт в Telegram
```

---

## Безопасность

- **ZIP-бомба:** Проверка ratio > 100:1, max 5000 файлов, max uncompressed size
- **Path traversal:** Отклонение `../` в именах файлов
- **Запрещённые файлы:** .php, .exe, .sh, .py, .cgi, .htaccess
- **Origin isolation:** Каждый сайт на своём субдомене → XSS изолирован
- **Rate limiting:** 5 деплоев/час, 10 auth попыток/15мин
- **JWT:** httpOnly cookie, 30 дней
- **Webhook:** HMAC-верификация подписи Prodamus
- **AI rate limiting:** max 10 AI-запросов/мин на пользователя (защита от спама)
- **AI санитизация:** ответ GigaChat проверяется на XSS/script injection перед записью на диск

---

## Деплой на сервер

```bash
# 1. БД
sudo -u postgres psql -c "CREATE USER vibe_user WITH PASSWORD 'xxx';"
sudo -u postgres psql -c "CREATE DATABASE vibe_hosting OWNER vibe_user;"

# 2. Директории
mkdir -p /var/www/vibe-hosting/{sites,uploads,backups}
chown -R www-data:www-data /var/www/vibe-hosting/sites

# 3. DNS (у регистратора hostingvibe.ru)
A    hostingvibe.ru      → IP сервера
A    *.hostingvibe.ru    → IP сервера

# 4. SSL (wildcard)
certbot certonly --dns-cloudflare -d hostingvibe.ru -d "*.hostingvibe.ru"

# 5. Nginx конфиг → sites-available/hostingvibe.ru
# 6. npm install && npm run build в backend/ и frontend/
# 7. prisma migrate deploy
# 8. pm2 start ecosystem.config.js && pm2 save
```

---

## Зарезервированные slug'и

`www, api, admin, app, mail, ftp, static, cdn, billing, support, help, blog, docs, status, gallery, dashboard`

---

## Порядок реализации (этапы)

### Этап 1: MVP Backend
- Структура проекта, конфиг, Prisma схема
- Auth (register/login/me)
- Projects CRUD + slug validation
- Deploy flow (ZIP upload → extraction → live)

### Этап 2: MVP Frontend
- WOW-лендинг с anime.js (hero, 3 шага, AI-демо, тарифы, галерея, FAQ)
- Анимации по всему проекту: scroll-triggered, stagger, page transitions
- Регистрация/вход (email + Яндекс ID + VK ID) + восстановление пароля
- Dashboard: список проектов, загрузка ZIP / HTML / GitHub
- Страница проекта с деплоем, файловым навигатором, панелью версий (откат)

### Этап 3: Nginx + Инфраструктура
- Wildcard Nginx конфиг
- SSL сертификат
- PM2 ecosystem config
- Тестирование end-to-end

### Этап 4: Платежи + PRO
- Интеграция Prodamus
- Управление подпиской
- Лимиты по плану

### Этап 5: Кастомные домены
- DNS verification
- Nginx config generation
- Certbot automation

### Этап 6: Галерея + Полировка
- Публичная галерея
- Лайки, теги, поиск
- Аналитика просмотров

### Этап 7: AI-редактирование (GigaChat)
- GigaChat сервис (OAuth, кэш токенов в Redis)
- AI-токены: баланс, начисление, списание, докупка
- Скрипт vibe-editor.js (hover, клик, селектор, попап)
- AI-роут: /api/ai/edit, /api/ai/revert, /api/ai/history
- Применение правок к файлам на диске + AiEditLog
- Фронтенд: страница AI-редактора (iframe + оверлей)
- Превью изменений (diff), откат правок

### Этап 8: Деплой с GitHub
- Ввод URL репозитория
- git clone --depth 1
- Автоопределение директории с index.html
- Интеграция в существующий deploy flow

### Этап 9: Email + Аналитика + Скриншоты
- Email-уведомления (регистрация, деплой, подписка, баланс)
- Аналитика для PRO (просмотры, география, рефереры, устройства)
- Яндекс Метрика: инжекция счётчика юзера в HTML при деплое
- Скриншоты сайтов (Puppeteer) для превью в галерее

### Этап 10: Модерация + Админка + Экспорт
- Админ-панель: статистика, юзеры, проекты, модерация, MRR
- Жалобы: POST /api/report + модерация в админке
- Suspend/unsuspend проектов
- Экспорт: скачивание ZIP с текущей версией сайта
- Автодаунгрейд: cron для просроченных подписок
- Лимит трафика (FREE: 10 ГБ/мес)

### Этап 11: Telegram + SEO + Юридическое
- Telegram-бот: привязка, уведомления (деплой, баланс, подписка)
- Брендированная 404-страница + кастомная 404.html
- Удаление аккаунта (152-ФЗ)
- SEO: мета-теги, OG, sitemap.xml
- Юридические страницы (terms, privacy, offer)
- Логирование: Winston + Sentry (backend + frontend)

---

## Рекомендации по порядку работы

### Текущее состояние (аудит)

| Компонент | Статус | Детали |
|-----------|--------|--------|
| **Backend код** | ✅ 90% Этап 1 | 1,249 строк, 6 роутов, 1 сервис |
| **Frontend код** | ❌ 0% | Папки `frontend/` нет вообще |
| **Prisma схема** | ⚠️ 5/14 моделей | Есть: User, Project, Deployment, Domain, Subscription |
| **Миграция** | ✅ Есть | `20260227204725_init` |
| **PM2 конфиг** | ✅ Готов | backend 7001, frontend 7002 |
| **.env** | ✅ Есть | DB, JWT, Redis, Storage paths |
| **.env.example** | ❌ Нет | Нужен шаблон |
| **BullMQ Workers** | ❌ Пусто | Папка `workers/` пустая |
| **Сервисы** | ⚠️ 1/14 | Только `deploy.service.ts` |
| **OAuth** | ❌ Нет | Яндекс/VK не реализованы |
| **Email** | ❌ Нет | Nodemailer не подключён |
| **GigaChat** | ❌ Нет | AI-сервис не начат |
| **Nginx конфиг** | ❌ Нет | Не в репо |
| **Тесты** | ❌ Нет | 0 тестов |

### Недостающие модели Prisma (9 штук)

Текущая схема содержит 5 моделей. Для полной реализации нужно добавить:
1. `AiTokenBalance` — баланс AI-запросов
2. `AiTokenPurchase` — покупки пакетов AI
3. `AiEditLog` — история AI-правок (для отката)
4. `EmailVerification` — подтверждение email
5. `PasswordReset` — восстановление пароля
6. `Report` — жалобы на контент
7. `PageView` — аналитика просмотров
8. `TrafficUsage` — подсчёт трафика

Также в модели `User` не хватает полей: `role`, `emailVerified`, `oauthProvider`, `oauthId`, `telegramChatId`, `deletedAt`.

### Недостающие Backend сервисы (13 штук)

Реализован только `deploy.service.ts`. Нужны:
- `github.service.ts` — клонирование репозитория
- `nginx.service.ts` — генерация конфигов, reload
- `ssl.service.ts` — certbot автоматизация
- `storage.service.ts` — отслеживание занятого места
- `billing.service.ts` — Prodamus API
- `dns.service.ts` — верификация DNS
- `gigachat.service.ts` — GigaChat OAuth + completions
- `ai-edit.service.ts` — парсинг HTML, применение правок, санитизация
- `email.service.ts` — Nodemailer + шаблоны
- `analytics.service.ts` — трекинг, GeoIP
- `screenshot.service.ts` — Puppeteer скриншоты
- `telegram.service.ts` — Telegram Bot API
- `export.service.ts` — формирование ZIP для скачивания

### Рекомендуемый подход

**Вариант B (рекомендуется):** Начинать с фронтенда, допиливая бэкенд по мере надобности.

Обоснование:
- Основные API (auth, projects CRUD, deploy, gallery) уже работают
- Можно сразу видеть результат и тестировать UI
- Недостающие модели и сервисы добавляются когда дойдём до соответствующего этапа
- Prisma-миграции легко запускать итеративно

Порядок работы:
1. **Обновить Prisma-схему** — добавить недостающие поля в `User` (role, emailVerified и т.д.)
2. **Создать frontend/** — инициализировать Next.js 16 + Tailwind + anime.js
3. **Лендинг** — WOW-страница с анимациями (визитная карточка проекта)
4. **Auth страницы** — регистрация, вход (email пока, OAuth позже)
5. **Dashboard** — список проектов, загрузка файлов, деплой
6. **Допиливать backend** по мере надобности каждого следующего этапа

### Недостающие пакеты (нужно доустановить)

Backend (при необходимости по этапам):
- `nodemailer` — email
- `axios` — HTTP-запросы (GigaChat, OAuth)
- `winston` + `winston-daily-rotate-file` — логирование
- `@sentry/node` — мониторинг ошибок
- `telegraf` — Telegram бот
- `puppeteer` — скриншоты
- `geoip-lite` — география по IP

Frontend:
- `next` (16+), `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/postcss`
- `animejs` (4.0) — анимации
- `@sentry/nextjs` — мониторинг
- `lucide-react` или `react-icons` — иконки

---

## Верификация

1. Регистрация → логин → получение JWT
2. Создание проекта с уникальным slug
3. Загрузка ZIP → проверить что сайт live на `slug.hostingvibe.ru`
4. Повторный деплой → проверить обновление
5. Лимиты: FREE попытка создать 2-й сайт → отказ
6. Оплата PRO → проверить расширение лимитов
7. Кастомный домен → DNS → SSL → live
8. Галерея: isPublic=true → отображается
9. AI-редактор: клик на элемент → промпт → элемент обновляется
10. Откат AI-правки → элемент возвращается к исходному
11. Баланс токенов: после правки balance уменьшился
12. Докупка токенов → баланс увеличился
13. Деплой с GitHub: ввод URL → сайт live
14. Мультистраничный сайт: AI-правка на about.html → изменился только about.html
15. Email: регистрация → письмо с подтверждением → клик → email verified
16. Восстановление пароля: forgot → email → reset → новый пароль работает
17. Аналитика (PRO): просмотры считаются, география определяется
18. Превью: после деплоя скриншот появляется в карточке проекта
19. Экспорт: скачать ZIP → содержит актуальные файлы с AI-правками
20. Модерация: жалоба → появляется в админке → suspend → сайт показывает заглушку
21. Автодаунгрейд: подписка истекла → план FREE → лишние сайты suspended
22. 404: несуществующий slug → брендированная страница VibeHosting
23. Кастомная 404: юзер загрузил 404.html → он отдаётся вместо дефолтной
24. Telegram: привязка бота → уведомление о деплое приходит в Telegram
25. Удаление аккаунта → все проекты и файлы удалены
26. Лимит трафика FREE: превышение → заглушка "Лимит исчерпан"
27. Яндекс Метрика: ввёл ID счётчика → на сайте появился скрипт Метрики
28. Откат версии: rollback к v2 → сайт показывает содержимое v2
29. AI-чат: кнопка "↩ Откатить до этого момента" → файл возвращается к состоянию
30. Панель версий FREE: видны только 3 последних версии
31. Соцавторизация: "Войти через Яндекс" → аккаунт создан → дашборд
32. Соцавторизация: "Войти через VK" → аккаунт создан → дашборд

**Файлы-референсы для реиспользования паттернов:**
- `/root/vibecode/proto-constructor/backend/src/routes/auth.js` — JWT auth
- `/root/vibecode/proto-constructor/backend/src/index.js` — Express middleware
- `/root/vibecode/mini-crm/prisma/schema.prisma` — Prisma conventions
- `/root/vibecode/proto-constructor/ecosystem.config.js` — PM2 config
- `/etc/nginx/sites-available/proto.smolnikov.su` — Nginx static + API proxy
