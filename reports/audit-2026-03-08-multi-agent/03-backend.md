# Аудит VibeHosting — Backend/Reliability (2026-03-08)

Статус: завершено.

## Ключевой вывод
Главный риск — выполнение пользовательской сборки в текущем контуре с root-рантаймом и in-process воркерами. Плюс высокий шум рестартов и слабая наблюдаемость/DR-практика.

## Фактические наблюдения
- 1 VM на всё (nginx + app + db + redis).
- PM2 под root, высокие restart counters.
- В логах реальные runtime-ошибки (в т.ч. SQL table naming bug).
- Деплой в фоне внутри API процесса.
- Есть health endpoint, но ограниченная observability.

## Приоритетные риски
P0:
1. Потенциальный RCE/blast radius через пользовательские build scripts.
2. SPOF: один сервер на все роли.
3. Фоновая бизнес-логика внутри API процесса.

P1:
4. Неполная идемпотентность при деградации redis/restarts.
5. Слабые метрики/алерты/request tracing.
6. Sync/blocking участки в runtime.
7. Недостаток pre-prod контрактных проверок.

P2:
8. Рост временных файлов/орфанов.
9. API-контракт неформализован.
10. Слишком широкий root blast radius для ops-операций.

## P0 backlog
1. Изолировать build/deploy в sandbox (non-root, resource/network limits).
2. Убрать root runtime у backend/frontend.
3. Вынести deploy в очередь+worker.
4. Починить прод-баг tags endpoint + тест.

## P1/P2 backlog (кратко)
- Метрики/логирование/трейсинг + SLO alerting.
- Единый error schema + requestId.
- Offsite backup + restore drills.
- Устранение sync hotspots.
- Contract/smoke tests для критичных API.
- Cleanup временных артефактов.

## Минимальные SLO
- API availability 99.5%/30d.
- p95 latency read endpoints <400ms.
- 5xx <1%.
- Deploy success >=98%.
- Weekly restore success 100%.

## План стабилизации 30 дней
- W1: hotfix багов, базовые метрики/алерты, postmortem рестартов.
- W2: queue+worker, non-root, resource limits build.
- W3: SLI/SLO dashboards + burn-rate alerts + DB baseline.
- W4: offsite backups + restore drill + stability review.

---
Полный развернутый отчёт — в истории subagent `vibe-audit-backend`.
