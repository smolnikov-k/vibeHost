# VibeHosting — Checklist Status (Wave1 validation)

Дата проверки: 2026-03-08
Проверялось по: 99-exec-summary.md + ACTION_PLAN.md + ACCEPTANCE_CHECKLIST.md

## Итог
- Полностью закрыто: часть P0/P1 технических пунктов
- Не закрыто: несколько критичных пунктов из всех аудитов (SEO, legal, billing consistency, reliability architecture)

## Статус по ключевым пунктам

### 1) SEO/metadata
- [x] `/register` canonical исправлен (`/register`)
- [x] `/login` canonical исправлен (`/login`)
- [ ] `/docs` canonical всё ещё указывает на `/` (не self-referencing)
- [ ] `/gallery` canonical всё ещё указывает на `/` (не self-referencing)
- [ ] `/ai` отсутствует в `sitemap.xml` (страница 200, но в sitemap нет)

### 2) Backend/stability quick fixes
- [x] fix `gallery/meta/tags` (endpoint работает, не падает)
- [x] `X-Request-Id` добавлен в ответы (`/api/health`)
- [x] улучшен error-handling в deploy/auth (внесено в код)
- [ ] deploy/build по-прежнему не вынесен в отдельный queue-worker контур (архитектурно P0/P1 не завершено)
- [ ] PM2 процессы всё ещё под `root`

### 3) Trust/copy/pricing consistency
- [x] Явный баг "₽ / мес" без числа закрыт в коде (`Pricing.tsx`)
- [ ] Полная trust-доработка (кейсы, доказательства, SLA/гарантии на лендинге) не завершена
- [ ] Полная синхронизация оффера между landing/docs/legal не завершена

### 4) Billing/economics
- [ ] Аномалия в БД остаётся: `ACTIVE subscriptions with price_rub=0 = 1` (из 1 активной)
- [ ] Полный контур корректного booked MRR/ARR не закрыт

### 5) Legal/compliance
- [ ] Privacy/offer/terms/cookie-consent как единый согласованный контур не закрыт
- [ ] Явный consent-механизм для метрики/cookies не подтверждён

### 6) QA process/docs
- [x] `ACTION_PLAN.md` создан
- [x] `DELIVERY_SEQUENCE.md` создан
- [x] `OWNER_MAP.md` создан
- [x] `ACCEPTANCE_CHECKLIST.md` создан

## Что выкатили в прод в Wave1
- backend + frontend обновлены
- миграции применены
- PM2 перезапущен
- `https://hostingvibe.ru` = 200
- `https://hostingvibe.ru/api/health` = 200

## Следующий шаг (Wave2)
1. Закрыть SEO-хвосты (`/docs`,`/gallery` canonical + `/ai` в sitemap)
2. Закрыть billing anomaly (`price_rub=0`) и отчётность MRR
3. Выполнить legal sync + cookie consent
4. Добить reliability архитектурные хвосты (queue/worker, non-root runtime)
