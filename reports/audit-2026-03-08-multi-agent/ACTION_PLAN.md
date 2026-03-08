# VibeHosting — ACTION_PLAN (итерация после multi-agent аудита)

Дата: 2026-03-08  
Источник: `reports/audit-2026-03-08-multi-agent/*` (без `08-security.md`, ждём отдельно)

## Принцип приоритизации
Приоритет задан по **impact на UX + trust + стабильность**:
1. Сначала убираем то, что ломает доверие/базовый user journey.
2. Затем ускоряем Time-to-First-Live и конверсию.
3. После — масштабируем экономику и retention.

---

## P0 (48–72 часа) — критичный impact

### P0.1 Единый truth source оффера и ограничений
**Почему:** сейчас есть конфликт между обещаниями в маркетинге и фактическими лимитами/поддержкой; это прямой удар по UX-доверию.  
**Сделать:**
- Сверить landing/docs/pricing/register/terms/offer с фактическими capability backend.
- Убрать противоречия (в т.ч. backend/Next server-side ограничения).
- Зафиксировать «Source of Truth» документ для product+marketing+support.
**Критерий готовности:** на ключевых страницах нет конфликтующих формулировок.

### P0.2 Trust bug: убрать «пустые числа» и неподтвержденные метрики
**Почему:** «пустые»/невалидные цифры в тарифах и блоках метрик = критический trust-break.  
**Сделать:**
- Исправить отображение всех числовых KPI/лимитов в UI.
- Скрыть или заменить неподтвержденные claims на проверяемые proof points.
- Добавить минимальные кейсы/доказательства (даже 1–2 валидных).
**Критерий готовности:** пользователь не видит пустых/сомнительных чисел; все claims объяснимы.

### P0.3 SEO/metadata core fix (без этого трафик искажается)
**Почему:** canonical/meta ошибки бьют по индексации и качеству входящего UX-потока.  
**Сделать:**
- Self-referencing canonical на индексируемых страницах.
- Исправить `/register` и `/login` (title/description/canonical + смысловая консистентность).
- Добавить отсутствующие страницы (`/ai`) в sitemap.
**Критерий готовности:** нет canonical conflicts; metadata валидна для auth/landing.

### P0.4 Стабилизация backend-контура (операционная надежность)
**Почему:** текущие runtime-ошибки и рестарты напрямую ухудшают UX (фейлы деплоя, нестабильность).  
**Сделать:**
- Починить прод-баг SQL naming (`tags endpoint`) + автотест.
- Вынести deploy/build из API-процесса в очередь+worker (минимальная декомпозиция).
- Разобрать PM2 restart root causes и погасить топ-источники.
**Критерий готовности:** deploy success и стабильность перестают деградировать при нагрузке.

### P0.5 Финансовая консистентность (booked MRR и биллинг)
**Почему:** нельзя принимать продуктовые/маркетинговые решения на сломанном учете денег.  
**Сделать:**
- Исправить аномалию `price_rub=0` у активной подписки.
- Валидировать прайсинг-данные в DB и API.
- Развести «booked MRR» и «теоретический MRR» в отчетах.
**Критерий готовности:** MRR/ARR считаются корректно, аномалия закрыта.

### P0.6 Legal minimum для безопасного UX
**Почему:** пользователь должен понимать, какие данные собираются и на что он соглашается.  
**Сделать:**
- Обновить Privacy под фактический трекинг/cookies.
- Включить cookie consent (базовый баннер + логирование выбора).
- Добавить явные UI-согласия в формах (privacy/ПД отдельно от маркетинга).
**Критерий готовности:** doc↔UI↔tracking не конфликтуют на критических страницах.

---

## P1 (1–2 недели) — высокий impact на activation/conversion

### P1.1 Onboarding до first-live
- Try-before-signup / instant preview.
- Onboarding checklist + человеческие error messages.
- Промежуточные CTA (демо/пример/тест-деплой).
**Target:** рост signup->first-live, снижение drop-off в register/login.

### P1.2 Frontend UX/a11y hardening
- Keyboard flow для dropzone.
- `aria-label`, `autocomplete`, корректная связка ошибок формы.
- Mobile overflow guard для docs.
**Target:** WCAG AA на auth и критичных шагах.

### P1.3 Observability baseline
- Единый `request_id`, error schema.
- Дашборд: 5xx, p95, deploy success, queue health.
- Базовые alerting правила (burn-rate/incident).

### P1.4 Analytics foundation
- Единый tracking plan + taxonomy + event contracts.
- Сквозные ID + UTM persistence.
- 3 воронки: activation / monetization / retention.

### P1.5 Доверие и коммерческий UX
- Гарантии/безрисковость рядом с CTA.
- FAQ-возражения ближе к decision point.
- Уточнить SLA/поддержку/условия в понятном UI-формате.

---

## P2 (2–6 недель) — масштабирование и устойчивый рост

### P2.1 Product/package evolution
- Тарифная лестница: Free/Lite/Pro/Business.
- Add-ons и annual план (-15..20%) с прозрачной ценностью.

### P2.2 Domain & rollback UX
- Domain wizard v1 (автопроверки + понятные статусы).
- Прозрачный rollback + post-deploy notifications.

### P2.3 Data model hardening
- `payment_events` с уникальностью provider_event_id.
- Критичные constraints (в т.ч. `UNIQUE(project_id, version)`).
- Partitioning для time-series таблиц.

### P2.4 Backup/DR maturity
- Offsite backup + PITR + регулярные restore drills.
- RPO/RTO контроль и отчетность.

### P2.5 Retention loops
- Forms+Telegram loop, lifecycle коммуникации, win-back/dunning.
- Отчеты по delivered value (не только «деплой был»).

---

## KPI-фокус для текущей итерации
- Conversion: visitor->signup, signup->first-live, free->paid D30.
- UX reliability: deploy success, p95 deploy duration, 5xx.
- Trust/consistency: количество конфликтов doc↔UI↔product (целевое: 0 для критичных страниц).
- Data quality: event loss %, unattributed %, billing anomalies (целевое: 0 критичных).
