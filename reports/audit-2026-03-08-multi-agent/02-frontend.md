# Аудит VibeHosting — Frontend (2026-03-08)

Статус: завершено.

## Ключевой вывод
Фундамент UX хороший, но есть критичные точки: доступность главного upload-флоу, SEO/metadata auth-страниц, и избыточный клиентский payload.

## Сильные стороны
1. Понятный value prop и первичный CTA.
2. Достаточно структурированный trust-контент (docs/legal/faq).
3. Быстрый TTFB.
4. Консистентный UI-стиль.
5. Понятные API-ошибки в auth.

## Топ-проблемы
P0:
- Dropzone недоступен с клавиатуры.
- `/login` почти shell-only (SSR формы в HTML отсутствует).
- Ошибочные metadata/canonical на `/register`.

P1:
- Нет aria-label у toggle пароля.
- Нет autocomplete в auth полях.
- Слабая связка ошибок формы с полями (aria-live/invalid/describedby).
- Тяжёлый payload на простых страницах.

P2:
- Риски mobile overflow на `/docs`.
- Местами слабый контраст текста.
- Токен в localStorage (безопасностный фронтовый риск, нужен план миграции).

## Quick fixes (1-3 дня)
- Починить accessibility Dropzone.
- Исправить metadata/canonical на auth страницах.
- Доработать a11y формы (aria + autocomplete).
- Облегчить non-critical JS на docs/legal/auth.
- Добавить mobile overflow guard на docs-таблицы.

## План 2-4 недели
- Lighthouse CI + web-vitals + Sentry baseline.
- Полный a11y-проход для критичных флоу.
- Performance optimization (code-splitting/lazy).
- E2E Playwright + quality gates в CI.

## DoD (сокращённо)
- Критичный флоу полностью keyboard-accessible.
- WCAG AA для auth.
- Корректные SSR/meta/canonical для login/register.
- 320px mobile без горизонтального скролла в docs.
- LCP/INP/CLS в целевых диапазонах.

---
Полный отчёт — в истории subagent `vibe-audit-frontend`.
