# Аудит VibeHosting — Архитектор БД (2026-03-08)

Статус: завершено.

## Ключевой вывод
Текущая модель рабочая, но есть системные риски роста: неполная мультиарендность, слабые DB-ограничения консистентности, недостаточная идемпотентность биллинга на уровне БД, и отсутствие partitioning для “тяжёлых” событийных таблиц.

## Приоритетные риски
1. Нет явной tenant-модели во всех критичных таблицах.
2. Потенциальная логическая неконсистентность owner-связей (domain/project/user).
3. Нет `UNIQUE(project_id, version)` для деплоев.
4. GitHub deploy path частично неатомарен.
5. Идемпотентность платёжных webhook без DB-grade unique event table.
6. Time-series данные без partitioning.

## Рекомендации (ядро)
- Ввести tenant/memberships слой.
- Добавить критичные constraints + CHECK + уникальности.
- Ввести таблицу `payment_events` (`provider_event_id UNIQUE`).
- Перевести page_views/audit_log на partitioning (monthly).
- Добавить полноценный audit_log по биллингу/доменам/деплоям.

## Backup/Restore target
- RPO 5-15 минут, RTO 1-2 часа.
- PITR через WAL archiving + weekly base backup + ежедневный logical dump.
- Обязательные регулярные restore tests (иначе backup не считается валидным).

## Roadmap 1-2 месяца
- Нед 1-2: constraints, payment events, транзакционность deploy, audit log.
- Нед 3-4: partitioning и индексы под hot queries.
- Нед 5-6: PITR + мониторинг backup freshness.
- Нед 7-8: миграция к tenant-модели + credit ledger.

---
Полный технический разбор и предложения миграций — в истории subagent `vibe-audit-db-architect`.
