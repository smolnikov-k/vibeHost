# WAVE Email Tech Plan — аудит дублей в email-модуле VibeHosting

Дата: 2026-03-08  
Область: `/root/vibecode/vibe-hosting/backend/src`  
Фокус: баги
1) письма приходят по 2 раза;  
2) то же письмо может прийти снова через несколько дней.

---

## TL;DR (главный вывод)

Текущая защита от дублей в VibeHosting в основном **in-memory** (`Map` в воркерах и fallback в billing webhook), а значит:
- не переживает рестарты процесса;
- не работает между инстансами;
- имеет TTL-окна (24h / 48h / 7-30d), после которых событие снова «легально» отправляется.

Это напрямую объясняет оба симптома:
- **дубль сразу/рядом по времени** — гонки/повторные триггеры/повтор webhooks;
- **повтор через дни** — истёк TTL или был рестарт и память обнулилась.

Ключевая стратегия фикса: перейти на **persisted idempotency + outbox + event ledger** (в БД), а не на in-memory cooldown.

---

## 1) Потенциальные источники дублей (root-cause audit)

### A. In-memory дедупликация вместо персистентной

#### A1) Cleanup worker
Файл: `src/services/cleanup.ts`
- `sentEmails = new Map<string, number>()`
- TTL 24 часа (`SENT_TTL`)
- ключи вида `sub-expiring:${sub.userId}`, `proj-expiring:${project.id}`

Риск:
- после рестарта Map пустой → уведомления могут уйти снова;
- при нескольких backend-инстансах каждый шлёт независимо;
- для expiring-логики это фактически допускает ежедневные повторы.

#### A2) Engagement worker
Файл: `src/services/engagement-worker.ts`
- `sentEmails = new Map<string, number>()`
- cooldown: onboarding 7д, tips 14д, winback 30д

Риск:
- те же проблемы: рестарт/мульти-инстанс/повторы после cooldown;
- окно выборки по датам + повторный прогон может дать ретриггер.

#### A3) Billing webhook fallback
Файл: `src/routes/billing.ts`
- Redis idempotency key `webhook:${payment_id}` c TTL 48ч
- fallback `processedPayments = new Map()`

Риск:
- если Redis недоступен, защита volatile;
- даже с Redis, через 48 часов тот же `payment_id` уже не защищён;
- дублирующий webhook спустя дни снова обработается.

---

### B. Неполная идемпотентность webhook-пайплайна

Файл: `src/routes/billing.ts`
- проверка дубля делается до обработки (`isPaymentProcessed`)
- `markPaymentProcessed` вызывается **после** транзакции с обновлением подписки/плана

Риск race/crash:
- если транзакция прошла, а до `markPaymentProcessed` процесс упал/таймаут — повтор webhook обработается повторно;
- письмо PRO может улететь повторно;
- период подписки может «переехать» повторным апдейтом.

---

### C. Fire-and-forget отправки без event ledger

Файлы:
- `src/routes/auth.ts` (welcome/reset)
- `src/routes/billing.ts` (pro-upgrade/cancelled)
- `src/services/deploy.service.ts` (deploy notification)
- `src/services/cleanup.ts`
- `src/services/engagement-worker.ts`

Паттерн: `sendXxxEmail(...).catch(() => {})`

Риск:
- нет централизованного статуса попыток/успехов;
- невозможно надёжно ответить: "уходило ли уже это событие";
- ручные/авто-ретраи без idempotency ключа приводят к дублям.

---

### D. Повторные триггеры и гонки по бизнес-окнам

- `cleanup` идёт каждые 15 минут и выбирает диапазоны (`expires in <= 3 days`), без persisted флага `notification_sent_for_period`.
- `engagement` идёт каждые 6 часов с датовыми окнами (3, 7, 30 день), без persisted event marker.

Риск:
- одна и та же сущность может матчиться снова при каждом прогоне/рестарте.

---

### E. Двойной маршрут webhook (архитектурный smell)

Файлы:
- `src/routes/billing.ts`: `router.post('/webhook', handleWebhook)`
- `src/index.ts`: отдельный public mount `app.use('/api/billing/webhook', billingWebhookRouter)`
- плюс `app.use('/api/billing', billingRoutes)` (внутри есть `/webhook`)

Да, второй путь под auth и обычно недоступен платёжке, но это лишняя точка входа и потенциальная путаница/ошибки конфигурации.

---

## 2) Карта текущих email-триггеров и точек отправки

### 2.1 Транзакционные

| Тип письма | Где триггер | Условие | Точка отправки |
|---|---|---|---|
| Welcome | `routes/auth.ts` register | успешная регистрация | `sendWelcomeEmail` |
| Password reset | `routes/auth.ts` forgot-password | запрос на сброс | `sendPasswordResetEmail` |
| Deploy success | `services/deploy.service.ts` | успешный деплой | `sendDeployNotification` |
| PRO activated | `routes/billing.ts` webhook | `payment_status=success` для подписки | `sendProUpgradeEmail` |
| Subscription cancelled | `routes/billing.ts` cancel | отмена подписки юзером | `sendSubscriptionCancelledEmail` |

### 2.2 Lifecycle (cron-like worker)

Источник: `services/cleanup.ts`, интервал 15 мин

| Тип письма | Выборка |
|---|---|
| Subscription expiring | active sub, `currentPeriodEnd` в горизонте 3 дней |
| Subscription expired | active sub, `currentPeriodEnd < now` |
| Project expiring | project `expiresAt` в горизонте 3 дней |
| Project suspended | project `expiresAt < now` и status != SUSPENDED |

### 2.3 Engagement / marketing

Источник: `services/engagement-worker.ts`, интервал 6 часов

| Тип письма | Выборка |
|---|---|
| Onboarding reminder | user created ~3 дня назад, без LIVE проектов |
| Tips | user created ~7 дней назад, есть LIVE проект |
| Win-back | inactive ~30 дней |

### 2.4 Transport

Все письма идут через `nodemailer` transporter (`services/email.service.ts`) и SMTP из `config.smtp`.

---

## 3) Предложенная антидубль-архитектура (боевой дизайн)

## 3.1 Центральная модель: `email_events` (event ledger + outbox)

Создать таблицу (минимум):

- `id` (uuid)
- `event_type` (welcome, reset, pro_upgrade, sub_expiring, ...)
- `recipient_email`
- `entity_type` (user/subscription/project/payment)
- `entity_id`
- `dedupe_key` (string, unique)
- `payload_hash` (sha256 от шаблонных данных)
- `status` (`PENDING|SENDING|SENT|FAILED|DROPPED`)
- `attempt_count`
- `next_retry_at`
- `last_error`
- `provider_message_id`
- `created_at`, `sent_at`, `updated_at`

Индексы/ограничения:
- `UNIQUE(dedupe_key)` — главный антидубль;
- индекс по `status, next_retry_at` для воркера.

> Опционально отдельно: `payment_events(provider, provider_event_id)` с `UNIQUE(provider, provider_event_id)` для бессрочной идемпотентности webhook.

---

## 3.2 Dedupe key strategy (критично)

Ключ должен отражать бизнес-событие, а не попытку отправки.

Примеры:
- welcome: `welcome:user:{userId}`
- reset: `password_reset:user:{userId}:token:{tokenHash}`
- deploy success: `deploy_live:deployment:{deploymentId}`
- pro upgrade: `pro_upgrade:payment:{paymentId}` (fallback `order_id`)
- sub expiring: `sub_expiring:sub:{subId}:periodEnd:{YYYY-MM-DD}:bucket:{3|2|1}`
- sub expired: `sub_expired:sub:{subId}:periodEnd:{YYYY-MM-DD}`
- project expiring: `proj_expiring:project:{projectId}:expires:{YYYY-MM-DD}:bucket:{3|2|1}`
- project suspended: `proj_suspended:project:{projectId}:expires:{YYYY-MM-DD}`
- onboarding: `eng_onboarding:user:{userId}:cohort:{YYYY-MM-DD}`
- tips: `eng_tips:user:{userId}:cohort:{YYYY-MM-DD}`
- winback: `eng_winback:user:{userId}:window:{YYYY-MM}`

---

## 3.3 Поток отправки

1. Любой trigger создаёт `dedupe_key`.
2. `INSERT INTO email_events ... ON CONFLICT (dedupe_key) DO NOTHING`.
3. Если insert=0 строк → событие уже существует, **не отправлять**.
4. Воркер забирает `PENDING/FAILED` (с `next_retry_at <= now`) и шлёт SMTP.
5. По результату обновляет статус `SENT` или `FAILED` с retry policy.

Плюс:
- можно сохранять `provider_message_id` и SMTP response;
- можно безопасно ретраить без дубля письма для пользователя.

---

## 3.4 Retry policy

- max attempts: 5
- backoff: 1m → 5m → 30m → 2h → 12h (+ jitter 10-20%)
- retry только для transient ошибок (4xx timeout/network)
- для permanent (invalid recipient, policy reject) → `DROPPED`, без бесконечных попыток

---

## 3.5 Webhook idempotency hardening

Для billing webhook:
- хранить `payment_id` персистентно (Postgres), **без TTL**;
- mark-as-processed в той же транзакции, что апдейт подписки;
- email-событие создавать через `dedupe_key=pro_upgrade:payment:{payment_id}`;
- webhook handler становится строго idempotent при повторах хоть через месяц.

---

## 4) План observability (метрики, логи, алерты)

## 4.1 Метрики (Prometheus-стиль)

- `email_events_created_total{event_type}`
- `email_send_attempts_total{event_type, result=success|failed|dropped}`
- `email_dedupe_skips_total{event_type}`
- `email_send_latency_ms{event_type}`
- `email_queue_depth{status}`
- `email_retry_scheduled_total{event_type}`
- `webhook_events_total{provider, status}`
- `webhook_duplicates_total{provider}`

SLO:
- успешная отправка транзакционных писем p95 < 2 мин от события;
- duplicate rate < 0.1%.

---

## 4.2 Логи (структурированные)

Обязательные поля:
- `requestId`, `eventType`, `dedupeKey`, `entityId`, `recipient`, `attempt`, `status`, `providerMessageId`, `errorCode`.

Ключевые лог-события:
- `email_event_created`
- `email_dedupe_hit`
- `email_send_started`
- `email_send_succeeded`
- `email_send_failed`
- `email_retry_scheduled`
- `webhook_duplicate_skipped`

---

## 4.3 Алерты

P0 алерты:
- всплеск `email_dedupe_skips_total` > X/5m (аномалия триггеров)
- `email_send_failed` > 20% за 10 минут
- queue depth `PENDING+FAILED` > N дольше 15 минут

P1 алерты:
- webhook duplicates растут > baseline
- retry attempts p95 > 2

---

## 5) План внедрения на 7 дней (P0/P1/P2 + Done)

## День 1 — Диагностика и freeze рисков (P0)

- Зафиксировать текущую карту триггеров (этот документ + owner на каждую точку).
- Подтвердить в логах 2 типа дублей: immediate и delayed.
- Временно включить расширенные логи по отправкам (без кода-ломки логики).

**Done:** есть baseline: какие шаблоны дублируются, как часто, по каким триггерам.

---

## День 2 — Data model и idempotency contract (P0)

- Согласовать `email_events` схему и `dedupe_key` правила по каждому типу письма.
- Согласовать политику повторов (где допустимы 3/2/1-day reminders, где строго 1 раз).

**Done:** утверждённый контракт dedupe key + SQL schema + state machine статусов.

---

## День 3 — Внедрение ledger/outbox для транзакционных писем (P0)

- Перевести welcome/reset/pro-upgrade/cancel/deploy на `create event -> worker send`.
- Убрать прямой `fire-and-forget` из этих критичных точек.

**Done:** транзакционные письма идут через `email_events`; повторный trigger с тем же dedupe key не шлёт дубль.

---

## День 4 — Webhook hardening (P0)

- Персистентная idempotency по `payment_id` без TTL.
- Atomically: mark processed + business update + event create.
- Проверка replay (повтор одного и того же webhook N раз) => 1 бизнес-эффект, 1 email-event.

**Done:** replay test passes; повторы webhook больше не создают дублей.

---

## День 5 — Cleanup/Engagement миграция (P1)

- Убрать зависимость от in-memory Map для дедупа.
- Все lifecycle/marketing триггеры переводим на dedupe keys в БД.
- Явно задать бизнес-окна напоминаний (например, только D-3/D-1).

**Done:** рестарт процесса не приводит к повторной массовой рассылке за тот же период.

---

## День 6 — Observability + алерты (P1)

- Добавить метрики и структурированные логи.
- Настроить дашборд и 3 критичных алерта (duplicate anomaly, fail rate, queue backlog).

**Done:** видно end-to-end путь события и легко определить, где возник дубль/провал.

---

## День 7 — Hardening + rollback plan + релиз (P2)

- Нагрузочные/replay-тесты (webhook storm, worker restart, SMTP transient fail).
- Runbook: как действовать при всплеске дублей.
- Выпуск в production с feature flag/поэтапным включением.

**Done:**
- duplicate rate по ключевым шаблонам ≤ 0.1%;
- нет «повторов через дни» для одного dedupe key;
- rollback процедура документирована.

---

## Приоритеты (сводно)

- **P0:** persisted idempotency (email_events + webhook), перевод транзакционных точек на outbox.
- **P1:** миграция cleanup/engagement, наблюдаемость и алертинг.
- **P2:** оптимизация ретраев, нагрузочные тесты, операционный runbook.

---

## Критерии Done проекта целиком

1. Для любого письма можно ответить SQL-запросом: когда создано событие, сколько попыток, финальный статус, message-id.  
2. Повтор одного и того же бизнес-события не приводит к повторной отправке (за пределами явно разрешённых reminder-buckets).  
3. Рестарт backend/масштабирование до N инстансов не увеличивает дублей.  
4. Replay webhook (включая через несколько дней) не создаёт повторное письмо и повторный бизнес-эффект.  
5. Есть алерты и дашборд, позволяющие поймать регресс в течение минут.

---

## Быстрые «первые фиксы» до полной миграции (временная защита)

1. Увеличить webhook idempotency TTL до 30+ дней (если временно остаётся Redis-key подход).  
2. Добавить временный DB-флаг/таблицу для `cleanup` expiring/suspended писем.  
3. Ограничить reminder policy (например, D-3 и D-1, не каждые 24 часа).  

Это не финальная архитектура, но сразу уменьшит боль до полного перехода на outbox+ledger.
