# Проверка старого аудита REVIEW-2026-03-04.md

Дата проверки: 2026-03-08
Источник: /root/vibecode/vibe-hosting/REVIEW-2026-03-04.md

## Краткий итог
Старый аудит проверен: часть пунктов уже закрыта, но критичные хвосты всё ещё есть.

## Уже закрыто (подтверждено)
- robots.txt присутствует и закрывает dashboard/admin/api от индексации.
- Яндекс.Метрика на hostingvibe.ru подключена.
- BUSINESS-тариф с лендинга убран (в текущем pricing только FREE/PRO).
- PRO в оферте/ценообразовании выглядит синхронно (1 ГБ упоминается в оферте).
- `/register` и `/login` canonical исправлены.
- `gallery/meta/tags` bug исправлен.
- В API есть `X-Request-Id`.
- Redis-backed rate limiting подключён в backend middleware.
- В БД есть уникальный индекс `telegram_links_chat_id_key` (пункт про chatId unique закрыт).

## Не закрыто / частично закрыто
- `/docs` и `/gallery` canonical всё ещё указывают на главную.
- `/ai` отсутствует в sitemap.xml.
- JWT в URL для SSE всё ещё в коде (`frontend/src/lib/api.ts`).
- Build user-проектов всё ещё без sandbox-изоляции.
- PM2 процессы на проде всё ещё под root.
- В репозитории всё ещё есть парольный SSH-шаблон (`.claude/.../deployment.md` с `sshpass -p 'Vibecoder'`).
- Биллинг-аномалия остаётся: активная подписка с `price_rub=0`.
- Полный legal-consent контур (privacy/cookie consent/UI согласия) не доведён до завершения.
- Часть DevOps hardening-пунктов (SSH policy, TLS policy review, offsite backup maturity, CI/CD полноценно) требует отдельного прохода.

## Вывод
Старый аудит **частично закрыт**, но по безопасности/архитектуре/комплаенсу остаются задачи уровня P0–P1, которые нужно закрыть в следующей волне.
