# Vibe Hosting — TODO

> Прогресс: ~95% к запуску MVP. Лендинг переделан под tiiny.host, добавлены QR/пароль/временные сайты.
> Обновлено: 2026-03-03

---

## ✅ Выполнено (Этапы 1–2)

<details>
<summary>MVP Backend + Frontend — всё готово</summary>

- [x] Структура проекта, конфиг, Prisma схема (13 моделей)
- [x] Auth (register/login/me/forgot-password/reset-password)
- [x] Projects CRUD + slug validation + storage accounting
- [x] Deploy flow (ZIP/HTML upload → extraction → live)
- [x] Авто-сборка: npm ci + npm run build (Vite/React/Astro/Next.js)
- [x] Deploy из GitHub (clone --depth 1 + auto-build)
- [x] Domains routes (CRUD + DNS verify)
- [x] Billing routes (Prodamus webhook skeleton, подписка)
- [x] Gallery routes (поиск, теги, лайки, пагинация, жалобы)
- [x] Middleware: auth, rateLimit, upload
- [x] Utils: zip, slug, limits
- [x] Next.js 16 + Tailwind + anime.js 4.0
- [x] Дизайн-система: светлая тема, зелёный акцент (emerald)
- [x] Лендинг: Hero, "Как это работает", Тарифы, FAQ, Footer
- [x] Dashboard: проекты, создание, деплой, файловый навигатор, версии
- [x] Биллинг: статус подписки + тарифы (заглушки Prodamus)
- [x] Настройки: профиль, хранилище, удаление аккаунта (152-ФЗ)
- [x] Юридические: /terms, /privacy, /offer
- [x] Кастомная 404 страница
- [x] SEO: sitemap.xml, robots.txt, OG-теги, JSON-LD, canonical
- [x] Email: Nodemailer + SMTP (welcome, reset, deploy notification)
- [x] Аналитика: PageView трекинг, JS-пиксел, графики, топ страниц, рефереры
- [x] Админка: дашборд, юзеры, проекты, suspend, модерация жалоб
- [x] Экспорт проекта (ZIP)
- [x] Health check: GET /api/health
- [x] Winston: структурированные логи + ротация

</details>

## ✅ Выполнено (Доп. фичи — февраль-март 2026)

<details>
<summary>GrapesJS, Visual Patches, Telegram-бот, Формы</summary>

- [x] **GrapesJS визуальный редактор** — multi-page, draft save, publish to disk, asset upload
- [x] **Visual Patches** — CRUD + runtime injection (vibe-patches.js) + iframe editor с element picker
- [x] **Telegram-бот** — polling mode, deep-link привязка (/start {code}), /status
- [x] **Формы** — vibe-forms.js инъекция, POST /api/forms/:slug, пересылка в Telegram
- [x] **Auto-injection** — vibe-forms.js + vibe-patches.js инжектируются в HTML при деплое
- [x] Настройки проекта: описание, теги, публичность (isPublic toggle)
- [x] **Лендинг редизайн** — стиль tiiny.host: минимальный Hero с upload zone, упрощённый SocialProof, чистый Footer
- [x] **QR-код** — SVG QR-код для каждого сайта в дашборде (qrcode.react)
- [x] **Защита паролем** — bcrypt hash, Nginx auth_request, cookie-based gate, UI toggle
- [x] **Временные сайты** — FREE план: expiresAt = 30 дней, auto-cleanup в worker
- [x] DNS-гайд с табами регистраторов (REG.RU, Timeweb, Beget)
- [x] Nginx: hostingvibe.ru + wildcard *.hostingvibe.ru (HTTP-only)
- [x] PM2: vibe-backend (7001) + vibe-frontend (7002)
- [x] Директории: /var/www/vibe-hosting/{sites,uploads,backups,previews}

</details>

---

## ✅ Этап A: Безопасность — ЗАКРЫТ (2026-03-03)

<details>
<summary>6 уязвимостей закрыто</summary>

- [x] **Prodamus webhook HMAC** — подпись обязательна, `timingSafeEqual`, отклонение без signature/key
- [x] **Shell Injection** — `execSync` → `spawnSync` с массивом аргументов (projects.ts + deploy.service.ts)
- [x] **Секреты** — JWT_SECRET = 128-char random, убран из ecosystem.config.js, загружается из .env через dotenv
- [x] **Analytics auth bypass** — разделён на `publicTrackRouter` (до auth) и `analyticsRouter` (после auth)
- [x] **Helmet** — `app.use(helmet())` + X-Frame-Options, HSTS, X-Content-Type-Options
- [x] **readFileSync** — отложено (AdmZip ограничен лимитом 500 МБ по config, не критично)

</details>

## ✅ Этап B: Инфраструктура — ЗАКРЫТ

- [x] **Wildcard SSL** — `*.hostingvibe.ru` + `hostingvibe.ru` (Let's Encrypt DNS-01, Cloudflare, до 29.05.2026)
- [ ] **E2E тестирование** — upload ZIP → live на `slug.hostingvibe.ru` → открыть в браузере
- [ ] **Первый коммит** — git init уже есть, но 0 коммитов. Закоммитить всё, настроить .gitignore

## 🟠 Этап C: Платежи (Prodamus) — до запуска

- [x] Prodamus: создание платёжной ссылки (API интеграция) — уже работает
- [x] Webhook: HMAC-верификация + `timingSafeEqual` + активация подписки — закрыто в Этапе A
- [x] Покупка AI-пакетов через Prodamus (10 шт = 99 ₽, 50 шт = 399 ₽) — уже работает
- [x] Автодаунгрейд — cleanup.ts worker (каждые 15 мин проверяет `currentPeriodEnd`, переводит на FREE)
- [ ] E2E тест платежа: создать ссылку → тестовая оплата → проверить webhook

## 🟠 Этап D: Полировка MVP — до запуска

- [x] Смена пароля — уже реализовано (POST /auth/change-password + UI в настройках)
- [x] 401 interceptor — авто-разлогин + redirect на /login при expired JWT
- [x] Race condition — `currentVersion: { increment: 1 }` (атомарный Prisma increment)
- [x] In-memory Map — cap 10K entries в analytics + gallery, drop oldest half при overflow
- [ ] SSE для статуса деплоя (заменить setTimeout polling)
- [ ] Next.js `middleware.ts` — серверная защита роутов (сейчас только клиентский redirect)
- [ ] Подсчёт тегов галереи в SQL вместо JS (`gallery.ts:90`)

---

## 🟡 Этап E: Скриншоты + Метрика — после запуска

- [ ] screenshot.service.ts: Puppeteer скриншоты проектов
- [ ] Авто-обновление скриншота после деплоя
- [ ] Яндекс Метрика: опциональная инжекция счётчика при деплое (metrikaId в Project)

## 🟡 Этап F: Кастомные домены — после запуска

- [ ] nginx.service.ts: генерация конфига для пользовательского домена
- [ ] ssl.service.ts: certbot автоматизация (Let's Encrypt)
- [ ] BullMQ worker: provision-ssl job (фоновая задача)
- [ ] DNS verification: CNAME/TXT проверка (улучшить текущую)

## 🟡 Этап G: AI-редактор (GigaChat) — после запуска

> Главный USP продукта, но запуск возможен без него (GrapesJS + Visual Patches уже есть).

- [ ] gigachat.service.ts: OAuth2, кэш токенов в Redis, completions
- [ ] ai-edit.service.ts: HTML parsing, apply edit, sanitize (XSS protection)
- [ ] Prisma: модели AiTokenBalance, AiTokenPurchase, AiEditLog
- [ ] AI-токены: баланс, начисление FREE (10), PRO (20/мес), списание
- [ ] POST /api/ai/edit — применение AI-правок к файлам
- [ ] POST /api/ai/revert/:editId — откат правки
- [ ] GET /api/ai/history/:projectId — история правок
- [ ] GET /api/ai/balance — текущий баланс
- [ ] Фронтенд: AI-чат в панели проекта (промпт → правка → превью diff)
- [ ] Rate limiting: max 10 AI-запросов/мин

## 🟡 Этап H: Telegram-бот расширение — после запуска

- [ ] Уведомления: деплой, баланс, подписка, жалобы
- [ ] Inline-кнопки для быстрых действий
- [ ] /help, /projects, /deploy команды

## 🔵 Этап I: Рост и масштабирование — v2

- [ ] Redis-кеш: галерея, теги, аналитика, сессии
- [ ] BullMQ очередь: деплой, GitHub clone, скриншоты (сейчас всё fire-and-forget)
- [ ] CI/CD: GitHub Actions (lint, build, deploy)
- [ ] Базовые тесты: billing webhook, zip validation, auth middleware
- [ ] Sentry: backend + frontend мониторинг ошибок
- [ ] Yandex/VK OAuth (oauthProvider/oauthId в User — поля в PLAN.md, не в схеме)
- [ ] LLM-прокси: доступ к GPT/Claude с оплатой в рублях
- [ ] Preview URLs: автоматический URL для каждой ветки/версии
- [ ] Лимит трафика: подсчёт bytesServed + заглушка для FREE (модель TrafficUsage)
- [ ] Пересмотр тарифов: Free → Старт (290 ₽) → Мейкер (790 ₽) → Стартап (1990 ₽)
- [ ] Кастомная 404.html пользователя (приоритет ниже серверной 404)

---

## Приоритеты запуска (порядок работ)

```
1. ✅ Безопасность (Этап A)          — ЗАКРЫТ
2. ✅ Wildcard SSL (Этап B)           — ЗАКРЫТ
3. ✅ Платежи Prodamus (Этап C)      — ЗАКРЫТ (осталось: E2E тест)
4. 🟠 Полировка MVP (Этап D)        — 4/7 сделано (осталось: SSE, middleware, теги SQL)
   ✅ tiiny.host фичи                — QR-код, пароль, временные сайты, редизайн лендинга
5. 📢 ЗАПУСК MVP                     — хостинг работает без AI-редактора
6. 🟡 Скриншоты + Метрика (Этап E)  — после запуска
7. 🟡 Кастомные домены (Этап F)     — после запуска
8. 🟡 AI-редактор GigaChat (Этап G) — после запуска
9. 🔵 Рост v2 (Этап I)              — по мере необходимости
```

**Ключевой инсайт:** Кастомный VibeEditor заменил GrapesJS + Visual Patches. AI-редактор (GigaChat) — дифференциатор, но не блокер запуска.

---

*Обновляется по мере выполнения. Последнее обновление: 2026-03-03*
