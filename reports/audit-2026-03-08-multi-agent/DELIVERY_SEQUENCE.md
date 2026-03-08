# VibeHosting — DELIVERY_SEQUENCE (без конфликтов внедрения)

Дата: 2026-03-08  
Цель: внедрение в порядке, который минимизирует регрессии и сохраняет консистентный UX.

## Принцип порядка
Сначала фиксируем **данные/факты и стабильность**, затем меняем **UX/воронку**, и только потом делаем **ценовые/масштабные эксперименты**.

---

## Фаза 0 — Freeze & Scope (0.5 дня)
1. Зафиксировать scope P0 и владельцев.
2. Ввести временный change-freeze на некритичные UI/copy-изменения.
3. Создать единый changelog по итерации.

**Зачем:** исключаем параллельные правки, которые ломают друг друга.

---

## Фаза 1 — Truth, Billing, Reliability Core (День 1–2)

### 1.1 Data/финансы first
- Закрыть `price_rub=0` аномалию и валидации биллинга.
- Проверить корректность MRR/ARR отчётов.

### 1.2 Backend hotfix + runtime stability
- Починить SQL naming bug (`tags endpoint`) + тест.
- Разобрать PM2 restart причины, устранить топ-источники.

### 1.3 Product truth sync
- Свести фактические capability и публичные обещания в единую матрицу.

**Dependency gate G1:**
- Финансовые данные корректны.
- Критичный прод-баг закрыт.
- Матрица «обещание ↔ фактическая функция» утверждена.

---

## Фаза 2 — UX trust shell (День 2–4)

### 2.1 Убрать trust-break в интерфейсе
- Исправить пустые/сомнительные цифры в тарифах/метриках.
- Добавить проверяемые proof points и гарантии рядом с CTA.

### 2.2 SEO/meta cleanup
- canonical self-referencing.
- `/register` и `/login` metadata/семантика.
- sitemap completion (`/ai`).

### 2.3 Legal UX minimum
- Consent banner + лог выбора.
- Явные UI-согласия в формах.
- Privacy синхронизирован с фактом трекинга.

**Dependency gate G2:**
- На ключевых страницах нет конфликтов claims/meta/legal.
- Пользовательский decision path (landing->signup) прозрачен и не вводит в заблуждение.

---

## Фаза 3 — Activation & A11y (Неделя 2)

### 3.1 Онбординг до first-live
- Try-before-signup / instant preview.
- Onboarding checklist + ясные ошибки.

### 3.2 A11y critical flow
- Keyboard-accessible dropzone.
- Auth-form accessibility (`aria`, `autocomplete`, error associations).

### 3.3 Analytics foundation
- Tracking plan + event contracts + сквозные ID + UTM.
- Дашборд активации и качества воронки.

**Dependency gate G3:**
- Критичный флоу проходит keyboard-only.
- Видим end-to-end activation funnel до `site_live_first_time`.

---

## Фаза 4 — Architecture hardening (Неделя 3–4)

1. Вынести deploy/build в queue+worker.
2. Ограничить runtime blast radius (non-root, resource limits).
3. Ввести request-id, error schema, базовые SLO/alerts.
4. DB hardening: constraints + payment_events + audit log.

**Dependency gate G4:**
- Deploy success стабилен, аварийность не растет.
- Есть наблюдаемость и понятная реакция на деградации.

---

## Фаза 5 — Growth packaging (Неделя 4–6)

1. Тарифная лестница Free/Lite/Pro/Business.
2. Annual/add-on эксперименты.
3. Domain wizard + rollback UX polishing.
4. Retention loops (forms+Telegram, lifecycle, dunning/win-back).

**Финальный критерий:** рост активации и paid-конверсии без ухудшения стабильности.

---

## Правила, чтобы не ловить конфликты
- **Один source-of-truth файл** для capability/claims (обновляется только PM+Backend).
- **UI/copy/legal правки через согласованный merge-window** (ежедневный слот).
- **Нельзя запускать pricing-эксперименты**, пока не закрыт billing/data-quality gate.
- **Любой UX-эксперимент должен иметь event-contract до релиза**.
- **Rollback plan обязателен** для изменений в deploy/billing/auth.
