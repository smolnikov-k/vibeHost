# Аудит VibeHosting — Product Manager (2026-03-08)

Статус: завершено.

## Сегменты и JTBD (кратко)
- Предприниматель с AI-лендингом: быстро запустить и получать лиды.
- Фрилансер/маркетолог: быстро выкатывать сайты клиентов без серверной рутины.
- Студент/джун: портфолио по URL дёшево и просто.
- Стартапер/инди: быстро показать MVP на домене.

## Ключевые проблемы и гипотезы
1. Трение до first-live -> try-before-signup + onboarding checklist.
2. Мало ценности после 1-го деплоя -> формы+Telegram+аналитика.
3. Сложность домена/SSL -> domain wizard с автопроверкой.
4. Страх сломать при обновлении -> rollback + прозрачные статусы.
5. Слабая измеримость -> единый tracking plan.

## Backlog (RICE, топ)
P0:
- Try-before-signup + instant preview.
- Сквозная аналитика + activation funnel.

P1:
- Онбординг-чеклист + ясные ошибки.
- Value-based upgrade nudges.
- Надёжность деплоя + rollback UX.
- Domain connect wizard.

P2:
- Lifecycle retention.
- Forms+Telegram retention loop.

## 6-недельный roadmap
- W1: tracking plan, KPI-дерево, консистентность оффера.
- W2: try-before-signup, onboarding checklist, error UX.
- W3: deploy reliability, rollback, post-deploy notifications.
- W4: domain wizard v1 + payment flow/value paywall.
- W5: forms+telegram polishing + value-report.
- W6: lifecycle CRM + ретро метрик.

## Критерии успеха (примеры)
- +25% visitor->signup
- +20% signup->first-live
- deploy success >97%
- p95 deploy <120s
- +20% free->paid D30
- +15% W4 retention SMB

## Топ-5 продуктовых рисков
1. Commodity trap.
2. Провал активации.
3. Высокий ранний churn.
4. Abuse free-плана.
5. Data-blind decisions.

Митигации: value-workflow дифференциация, SLO активации, lifecycle, abuse controls, decision log + event-contract.

---
Полный развернутый отчёт — в истории subagent `vibe-audit-pm`.
