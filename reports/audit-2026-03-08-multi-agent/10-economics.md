# Аудит VibeHosting — Экономист / юнит-экономика (2026-03-08)

Статус: завершено.

## Ключевой вывод
Перед масштабированием acquisition нужно сначала починить финансовую консистентность (booked MRR/биллинг), синхронизировать оффер/лимиты и только потом разгонять платный рост.

## Что критично
1. Выборка пока маленькая (низкая статистическая устойчивость).
2. Аномалия в биллинге: активная подписка с `price_rub=0` => booked MRR искажается.
3. Конфликт оффера/логики (free навсегда vs expiry-логика и др.) бьет по доверию и конверсии.

## Мини-модель юнит-экономики
- CM = P*(1-fee)-Cvar
- LTVgross = CM/churn
- Payback = CAC/CM
- Breakeven paid users = Fixed/CM

В базовом сценарии PRO 386 ₽: CM ~301 ₽ (при fee 4%, Cvar 70 ₽).

## Риски прайсинга
- Single-tier trap (только Free/Pro).
- Неправильная ценовая “полка” без четкого value proof.
- Риски маржи на безлимитном трафике без guardrails.
- Нет сильной anti-churn механики (annual/dunning/win-back).

## Рекомендации по линейке
- Free (acquisition)
- Lite 149-199 ₽
- Pro 349-399 ₽
- Business 699+ ₽

Плюс add-ons: extra sites/storage/AI packs, annual prepaid -15..20%.

## План экспериментов на 30 дней
- Price ladder test.
- Annual plan test.
- Value packaging A/B.
- Dunning/retention flow.

Стоп/гоу ориентиры:
- Go: CAC_paid <= 1,200 ₽, payback <= 4 мес, D30 free->paid >= 5%
- Stop: CAC > 1,800 ₽ и churn > 12%

## Факты из текущей базы (по отчёту агента)
- Users: 5
- PRO: 1
- Projects: 4 (LIVE: 3)
- Storage used: ~31.9 MB
- Booked MRR (subscriptions): 0 ₽
- Теоретический MRR по плану: 386 ₽

---
Полный развернутый отчёт — в истории subagent `vibe-audit-economist`.
