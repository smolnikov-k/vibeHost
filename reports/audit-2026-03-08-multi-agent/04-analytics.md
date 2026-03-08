# Аудит VibeHosting — Аналитик (2026-03-08)

Статус: завершено.

## Ключевое
- Предложенная North Star: **Weekly Value-Realized Sites (WVRS)** — сайты с deploy за 7 дней и подтверждённой ценностью (трафик >=50 визитов или >=1 лид).
- Сформирован event-taxonomy (расширенный), 3 ключевые воронки, MVP-дашборд, план внедрения аналитики по этапам.

## Что внедрить в первую очередь
1. Единый tracking plan + словарь событий/свойств.
2. Сквозные идентификаторы (anonymous_id -> user_id), event_id UUID, event_version.
3. UTM persistence (first-touch + last-non-direct).
4. Воронка Acquisition -> Activation до `site_live_first_time`.
5. Telemetry build/deploy (duration, error_code, success_flag).

## 3 приоритетные воронки
1. Landing -> Signup -> First Live Site (activation).
2. First Live Site -> Upgrade -> Payment Success (monetization).
3. First Live Site -> Redeploy/Analytics -> Renewal (retention/value).

## MVP Dashboard блоки
- Growth: signups, activation rate, time-to-first-live.
- Product: build/deploy success, p95 duration, domain/SSL success.
- Monetization: free->paid D7/D30, MRR, churn, failed payments.
- Retention: W1/W4 cohorts, WAU/MAU, active sites with value signals.
- Quality/Ops: event loss, duplicates, unattributed %, incidents/SLA.

## Этапный план
- Неделя 1: foundation и data contracts.
- Недели 2-3: core product analytics.
- Недели 4-5: monetization + retention.
- Недели 6-8: data quality + attribution + A/B framework.
- Далее: операционный cadence (daily/weekly/monthly).

---
Полный исходный ответ агента сохранён в истории сессии; при финальной сборке добавлю полный развернутый вариант в сводный файл.
