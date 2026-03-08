# Audit Cycle #2 — Implementation Wave (2026-03-08)

## Цель
Полировка всего сервиса (не только email): убрать user-facing расхождения, усилить стабильность и безопасность без breaking changes.

## Что сделано в этом цикле

### 1) Truth alignment в UX/копирайте (P0)
- Убраны вводящие в заблуждение формулировки про "регистрацию через Telegram".
- Синхронизирован upload-copy с фактическим backend-контрактом (ZIP/TAR.GZ; убраны HTML-обещания там, где не поддерживаются).
- Уточнены тексты тарифов FREE в лендинге/биллинге, чтобы снизить конфликт ожиданий.
- Обновлены спорные claim-блоки (UseCases/Features), где были неподтверждённые возможности.

### 2) Security/Platform hardening (быстрые фиксы)
- Усилен auth middleware:
  - cookie/header/query token pipeline сохранён,
  - для cookie-auth mutating запросов добавлен Origin allowlist check,
  - query-token помечается deprecation headers + warning log.
- Исправлен rate-limit store reuse (отдельные Redis prefixes/stores на limiter), чтобы убрать прод-шум `ERR_ERL_STORE_REUSE`.
- На проде ужесточены права:
  - `backend/.env` -> `600`
  - `logs/` -> `750`, файлы логов -> `640`

### 3) Циклический аудит качества
- Добавлен исполнимый скрипт: `scripts/audit/run_cycle.sh`
- Скрипт проверяет:
  - доступность сайта/API,
  - SEO/meta инварианты,
  - smoke endpoints,
  - конфиг-санити (SMTP/billing constant),
  - опциональные DB-инварианты (`AUDIT_CHECK_DB=1`).
- Доки и отчёты:
  - `reports/audit-cycle/CYCLE_RUNBOOK.md`
  - `reports/audit-cycle/CYCLE-1.md`
  - `reports/audit-cycle/CYCLE-2-IMPLEMENTATION.md`

### 4) Контент-маркетинг пакет
- Сформирован пакет стратегий:
  - `reports/marketing/CONTENT_STRATEGY_90D.md`
  - `reports/marketing/EMAIL_CAMPAIGNS_PACK.md`
  - `reports/marketing/SEO_CLUSTER_MAP.md`
  - `reports/marketing/CONTENT_QA_CHECKLIST.md`

### 5) Full audits сохранены
- `reports/audit-cycle/FULL_SERVICE_UX_PRODUCT_AUDIT.md`
- `reports/audit-cycle/FULL_SERVICE_TECH_AUDIT.md`
- `reports/audit-cycle/FULL_SERVICE_SECURITY_COMPLIANCE_AUDIT.md`

## Проверки
- Backend build: PASS
- Frontend build: PASS
- `scripts/audit/run_cycle.sh`: PASS (с предупреждением при выключенной DB-проверке)

## Что остаётся в следующую волну (P1/P2)
1. Перевод с localStorage JWT на HttpOnly cookie-first с планом миграции.
2. Изоляция build/deploy (sandbox/worker-runtime) и разведение фоновых workers от API-процесса.
3. Внедрение централизованных SLO/SLI алертов и метрик (error budget, billing/webhook/email).
4. Полная legal/retention трассируемость (consent audit trail, retention matrix).
