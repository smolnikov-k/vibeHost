# FULL SERVICE TECH AUDIT — VibeHosting

Дата аудита: **2026-03-08**  
Контур: **frontend + backend + DB + deploy flow + billing + analytics + workers/cron + error handling + observability**

---

## 1) Executive summary

**Итоговый статус: AMBER/RED (работает, но с повышенным операционным и security-риском).**

Сервис функционально целый: деплой, домены/SSL, биллинг, формы, аналитика, health-check, миграции Prisma.  
Но в текущем состоянии есть несколько системных рисков:

1. **Высокий blast radius**: backend/frontend/infra-операции выполняются под `root`, включая деплой пользовательского кода (build).
2. **Неустойчивость рантайма**: повышенные рестарты PM2 (backend 62, frontend 25), noisy ошибки в логах.
3. **Auth/Session модель уязвима для web-атак**: JWT в `localStorage` + cookie без `HttpOnly` и без CSRF-защиты для cookie-auth запросов.
4. **Наблюдаемость недостаточная**: нет централизованных метрик/алертов/трейсинга, только health + PM2 + файлы логов.
5. **Deploy flow и background jobs не изолированы**: тяжелые операции и worker-логика внутри API-процесса.

---

## 2) Что проверено

- Кодовая база: `/root/vibecode/vibe-hosting` (backend/frontend/prisma/scripts/reports).
- Прод: `213.159.209.228`:
  - `pm2 status/describe/logs`
  - `nginx config + nginx -t`
  - `health endpoint`
  - `prisma migrate status`
  - cron (`crontab -l`)
- Выборочные API smoke-checks (`/api/health`, billing webhook auth, forms preflight).

---

## 3) Архитектура (as-is)

- **Frontend**: Next.js 16 (`frontend`), PM2 процесс `vibe-frontend`, reverse proxy через Nginx (7002).
- **Backend**: Express + Prisma (`backend`), PM2 процесс `vibe-backend`, порт 7001.
- **DB**: PostgreSQL + Prisma migrations (статус: up-to-date).
- **Cache/Rate-limit**: Redis + `express-rate-limit`.
- **Static hosting**: `/var/www/vibe-hosting/sites` + wildcard Nginx для `*.hostingvibe.ru`.
- **Billing**: Prodamus webhook + `payment_events` идемпотентность.
- **Workers**: cleanup (15м) + engagement (6ч) через `setInterval` внутри backend.
- **Cron**: ежедневный DB backup script (`0 3 * * * /usr/local/bin/vibe-db-backup.sh`).

---

## 4) Ключевые находки по доменам

## Frontend

### Что хорошо
- Чистая Next-структура, route protection через middleware.
- API client унифицирован.

### Риски
- **[HIGH] JWT хранится в `localStorage` + cookie ставится с JS** (`frontend/src/lib/api.ts`):
  - cookie не `HttpOnly`, значит доступна XSS;
  - с cookie используется backend auth (`cookie -> bearer -> query token`), но **CSRF защиты нет**.
- **[MEDIUM] middleware проверяет только наличие cookie, а не валидность токена** (`frontend/src/middleware.ts`) — UX и поведение при истекшем токене нестабильны.
- **[LOW/MEDIUM] preview token в query string** (`getEditPreviewUrl`) — риск утечек через логи/реферер при ошибочных переходах.

## Backend

### Что хорошо
- Есть `requestId`, глобальный error-handler, health endpoint, базовые лимиты.
- Есть идемпотентность email- и payment-событий (`email_events`, `payment_events`).

### Риски
- **[CRITICAL] Запуск под root + выполнение пользовательского build (`npm run build`)** (`deploy.service.ts`, runtime на root через PM2):
  - build не изолирован контейнером/sandbox;
  - при supply-chain/0day blast radius максимальный.
- **[HIGH] CSRF-уязвимость для cookie-auth маршрутов**:
  - backend принимает auth из cookie (`auth.ts`),
  - state-changing endpoints не проверяют CSRF token / строгий Origin/Referer policy.
- **[HIGH] Rate-limit store reuse warning в прод-логах** (`ERR_ERL_STORE_REUSE`):
  - общий RedisStore используется несколькими limiter-ами (`middleware/rateLimit.ts`),
  - в логах регулярный ValidationError, что ухудшает надежность и сигнализацию.
- **[MEDIUM] Тяжелые FS/child_process операции синхронно** (deploy, domain-provision): риск блокировки event loop под нагрузкой.
- **[MEDIUM] Worker-логика в API процессе** (`cleanup`, `engagement`, Telegram polling) — перезапуски API = сбои/дрейф jobs.

## DB

### Что хорошо
- Prisma schema аккуратная, индексы на основные hot-path таблицы.
- Миграции применены, статус БД актуален.

### Риски
- **[MEDIUM] Нет уникального ограничения на `(project_id, version)`** для deployments (есть index, но не unique).
- **[MEDIUM] Денежные/кредитные операции без ledger-модели**: AI credits увеличиваются инкрементом, нет полноценного журнала транзакций.
- **[LOW→MEDIUM] BigInt -> Number преобразования** по всему API: сейчас ок, но при росте возможны переполнения/неточность.

## Deploy flow

### Что хорошо
- Валидации архивов, ограничения размера/файлов, запрет опасных расширений.
- Бэкапы версий для PRO, rollback есть.

### Риски
- **[HIGH] Отсутствие формального CI/CD конвейера** (в репо нет GH Actions/GitLab CI и т.д.).
- **[HIGH] Runtime drift risk**: прод не связан явно с git-ревизией; возможна рассинхронизация src/dist/PM2-команд.
- **[MEDIUM] Frontend запускается через `npx next start` из bash в PM2** (по describe), что менее детерминированно, чем запуск фиксированного бинаря/script из ecosystem.

## Billing

### Что хорошо
- Подпись webhook проверяется через HMAC + `timingSafeEqual`.
- Есть дедуп событий (`payment_events`), что существенно снижает double-charge/double-credit риски.

### Риски
- **[MEDIUM] Нет replay-window по времени события** (подпись есть, timestamp/nonce-политики нет).
- **[MEDIUM] На ошибках webhook всегда `200 OK`** (анти-шторм ретраев), но нужен DLQ/alerting, иначе silent failure.
- **[LOW/MEDIUM] Нет детального финансового audit trail (ledger) для credit packs**.

## Analytics

### Что хорошо
- Есть встроенный pageview-трекинг, агрегации, dashboard endpoint.

### Риски
- **[MEDIUM] Дедуп in-memory map per-process** (`analytics.service.ts`) — при рестартах/масштабировании искажения.
- **[LOW/MEDIUM] Ограниченная продуктовая аналитика**: нет сквозной event taxonomy, conversion funnel, SLA на качество событий.

## Cron/Workers

### Что хорошо
- Есть nightly DB backup cron.
- Cleanup/engagement полезны и уже работают.

### Риски
- **[MEDIUM] Jobs живут в API процессе**: нет очереди/оркестрации/изоляции.
- **[MEDIUM] Нет явного мониторинга выполнения jobs** (success/fail duration, missed runs, alerts).

## Error handling

### Что хорошо
- Унифицированный `requestId`, типовые JSON ошибки, winston logger.

### Риски
- **[MEDIUM] Логи шумные, но не action-oriented**: есть repeated errors (rate-limit validation, Next server-action mismatch) без алертов и ownership.
- **[LOW/MEDIUM] Часть ошибок проглатывается как non-critical**, но без достаточного telemetry-контекста.

## Observability

### Что хорошо
- `/api/health` включает DB/storage/SMTP checks.
- PM2 runtime метрики доступны.

### Риски
- **[HIGH] Нет централизованного APM/metrics/alerts** (Sentry/Prometheus/Grafana/Alertmanager и пр.).
- **[HIGH] Нет SLO и error-budget мониторинга по API/deploy/billing/jobs.**

---

## 5) Прод-симптомы (подтверждено на сервере)

- PM2 рестарты: `vibe-backend: 62`, `vibe-frontend: 25`.
- В логах backend: `ERR_ERL_STORE_REUSE` (rate-limit store reuse).
- В логах frontend: repeated `Failed to find Server Action`.
- `nginx -t` ок, сервисы активны.
- `/api/health` = `status: ok`.
- Prisma migrations: up-to-date.

---

## 6) Приоритеты (риск-матрица)

### P0 (критично, делать сразу)
1. Убрать root runtime для app-процессов.
2. Ввести CSRF-защиту для cookie-auth state-changing API.
3. Изолировать user build/deploy (sandbox/container + resource limits + no privileged runtime).
4. Починить rate-limit конфигурацию (уникальные RedisStore/prefix per limiter).

### P1 (в ближайшие 1-2 недели)
1. Вынести jobs (cleanup/engagement/telegram heavy ops) в отдельный worker процесс/очередь.
2. Внедрить базовый observability stack (errors + metrics + alerts).
3. Стандартизовать deploy pipeline (build artifact + release flow + rollback runbook).
4. Укрепить billing audit trail (credits ledger + webhook failure queue/alert).

### P2 (после стабилизации)
1. Расширить продуктовую аналитику до event-level funnel.
2. Улучшить DB constraints/consistency (в т.ч. unique на deployments version).
3. Сократить sync I/O в hot-path, перевести критичные участки на async/queue.

---

## 7) Быстрые фиксы за 24 часа

## быстрые фиксы за 24 часа

1. **Rate-limit hotfix**
   - Создать отдельный `RedisStore` для каждого limiter (или уникальные key prefix).
   - Убрать `ERR_ERL_STORE_REUSE` из логов.

2. **CSRF минимальная защита**
   - Для POST/PUT/PATCH/DELETE с cookie-auth: strict `Origin` allowlist + reject missing/foreign Origin.
   - Для критичных endpoint-ов (billing, auth profile/account, domains, deploy) — включить первым этапом.

3. **Session hardening (frontend)**
   - Перестать зеркалить JWT в JS-readable cookie для постоянной сессии.
   - Минимум: `Secure; SameSite=Strict` где возможно; roadmap на HttpOnly refresh/session cookie.

4. **PM2 стабилизация**
   - Зафиксировать запуск frontend через ecosystem script, без `npx` shell-варианта.
   - Проверить `pm2 save`, убрать дрейф команд запуска.

5. **Операционные алерты минимум**
   - Alert на: process restart spike, 5xx rate, webhook failures, cleanup/engagement errors.

6. **Runbook update**
   - Добавить короткий incident playbook: "backend flapping", "billing webhook degraded", "domain provision fail".

---

## 8) План на 14 дней

## план на 14 дней

### Дни 1–3: Стабилизация и безопасность
- Исправить rate-limit конфиг.
- Внедрить Origin-based CSRF guard на все mutating routes.
- Привести PM2 конфиги к одному источнику правды (ecosystem + save).
- Завести минимальные алерты и on-call уведомления.

### Дни 4–7: Изоляция runtime и deploy
- Перевести backend/frontend процессы на non-root service user.
- Выделить deploy/build в отдельный worker процесс.
- Ограничить build-контур: cpu/mem/timeouts/network policy/chroot-or-container.

### Дни 8–10: Observability и billing reliability
- Подключить Sentry (backend + frontend) с release tags.
- Экспорт технических метрик (HTTP latency, error rate, worker lag, deploy duration, webhook status).
- Добавить failure queue + retry policy для billing/webhook processing.

### Дни 11–14: Data/infra hardening
- Ввести `deployment(project_id, version)` unique constraint + миграция.
- Ввести credit ledger таблицу для AI паков (immutable entries).
- Провести тест восстановления из backup (restore drill) с фиксацией RTO/RPO.
- Закрыть цикл: итоговый review с SLO baseline и списком оставшегося tech debt.

---

## 9) Позитивы, которые важно сохранить

- Уже есть хороший фундамент: Prisma, миграции, health endpoint, domain automation, billing dedupe, email dedupe.
- Архитектура понятная, кодовая база компактная и ремонтопригодная.
- Есть готовность к продуктовым фичам (формы, аналитика, галерея, редактор, billing, telegram).

---

## 10) Финальная оценка

**Сервис уже пригоден для работы с текущей нагрузкой, но не готов к безопасному масштабированию без срочных hardening-изменений.**  
Фокус ближайших 14 дней: **security (root/CSRF/build isolation) + reliability (jobs/alerts/deploy discipline)**.  
После этого можно безопасно ускорять рост и маркетинговый трафик.
