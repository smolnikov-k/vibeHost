# WAVE EMAIL — Execution Status

Дата: 2026-03-08

## Выполнено (тех)
- Добавлена персистентная идемпотентность email-событий через `email_events`.
- Добавлена персистентная идемпотентность платежных webhook side-effects через `payment_events`.
- Введён единый `sendEmailOnce(...)` дедуп-гейт в ключевых триггерах:
  - deploy live
  - welcome
  - password reset
  - subscription expiring/expired
  - project expiring/suspended
  - engagement onboarding/tips/winback
  - pro upgrade / subscription cancelled
- Убрана зависимость от in-memory дедупа в cleanup/engagement сценариях.
- Усилена обработка повторов webhook через durable claim/processed/fail flow.

## Выполнено (контент)
- Переписаны ключевые lifecycle шаблоны под value-first формат:
  - onboarding reminder
  - tips after activation
  - win-back
- Включён quiet-period в lifecycle/marketing потоке (anti-annoying правило).
- Зафиксированы стратегические документы:
  - `reports/email/WAVE_EMAIL_CONTENT_PLAN.md`
  - `reports/email/WAVE_EMAIL_TECH_PLAN.md`

## Дополнительно в релизной пачке
- Wave2 SEO: canonical для `/docs` и `/gallery`, `/ai` в sitemap.
- Wave2 auth/SSE: убран JWT в query для stream, cookie-first auth.
- Wave2 legal UX: cookie consent + metrika-after-consent + privacy updates.
- Billing: guard от `price_rub=0` + SQL one-time fix/runbook.

## Осталось после релиза
- Поднять метрики/дашборд по email deliverability+dedeupe.
- Добавить автоматические A/B тесты тем писем.
- Вынести scheduler locks в distributed lock (если появятся multi-instance worker run'ы).
