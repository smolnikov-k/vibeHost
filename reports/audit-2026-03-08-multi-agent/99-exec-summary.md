# VibeHosting Multi-Agent Audit — Executive Summary (v1, без Security)

Дата: 2026-03-08
Статус: 9/10 отчётов готовы. Security-аудит в процессе, будет добавлен отдельным блоком.

## Что критично сделать в первую очередь (P0, 48-72 часа)
1. **Синхронизировать оффер и реальность продукта**
   - Убрать противоречия “что поддерживаем” (особенно про backend/Next server-side).
   - Привести тексты, docs, pricing и onboarding к одному truth source.

2. **Починить SEO-базу и метаданные**
   - Canonical: self-referencing на индексируемых страницах.
   - Исправить `/register` и `/login` title/description/canonical.
   - Добавить отсутствующие страницы в sitemap.

3. **Закрыть доверительные дыры на лендинге/тарифах**
   - Убрать “пустые” цифры/метрики в UI (critical trust bug).
   - Добавить проверяемые proof points, кейсы, понятные гарантии.

4. **Стабилизировать backend-контур**
   - Починить найденные прод-баги (в т.ч. SQL naming bug).
   - Вынести deploy/batch из API-процесса в worker-очередь.
   - Разобрать причины частых PM2 restart и снизить аварийность.

5. **Починить биллинг-учёт/метрики денег**
   - Исправить аномалию с `price_rub=0` в активной подписке.
   - Сделать корректный booked MRR/ARR и валидацию ценовых данных.

## P1 (1-2 недели)
- Онбординг до first-live: чеклист, человеческие ошибки, drop-off reduction.
- Frontend a11y: keyboard flow для dropzone, aria/autocomplete для auth форм.
- Базовая observability: request-id, error schema, dashboard 5xx/p95/deploy success.
- Legal cleanup: privacy/cookie consent/оферта/terms в соответствии с фактической обработкой данных.
- Analytics foundation: единый tracking plan + event taxonomy + 3 ключевые воронки.

## P2 (2-6 недель)
- Тарифная лестница (Free/Lite/Pro/Business) + апсейлы.
- Domain wizard и rollback UX для роста активации/retention.
- Data model hardening: constraints/partitioning/audit log/payment_events.
- Offsite backup + регулярные restore drills.

## Общие выводы по направлениям
- **Маркетинг:** оффер сильный, но SEO и consistency мешают конверсии.
- **Фронтенд:** хороший UX-фундамент, но есть критичные a11y/metadata/perf точки.
- **Бэкенд:** ключевой риск — архитектура исполнения/надёжности при росте.
- **Аналитика:** нужно мерить не деплои, а delivered value (traffic/leads).
- **БД:** нужно усилить консистентность, идемпотентность и time-series хранение.
- **Копирайт:** тексты сильные по смыслу, но trust ломается из-за несостыковок и пустых чисел.
- **PM:** правильный фокус — activation -> value -> paid -> retention.
- **Юридический блок:** документы и фактический трекинг должны быть синхронизированы.
- **Экономика:** сначала чинить учёт/прайсинг-консистентность, потом масштабировать CAC.

## Предложенный порядок работ
1. Stabilize + Trust + Data correctness (1 неделя)
2. Activation & Conversion improvements (2-3 неделя)
3. Reliability/Observability + Legal completion (3-4 неделя)
4. Pricing experiments + retention loops (4-6 неделя)

---
После получения `08-security.md` обновлю этот файл до финальной версии v2 и добавлю security-priority matrix.
