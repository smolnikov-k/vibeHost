# VibeHosting — hostingvibe.ru

Хостинг-платформа: загрузил ZIP → сайт на slug.hostingvibe.ru. Визуальный редактор, QR, пароли, кастомные домены, аналитика.

## Документация проекта

Подробная документация в `.claude/skills/project-knowledge/references/`:
- `project.md` — обзор, стек, env, тарифы
- `architecture.md` — структура, БД, API endpoints, middleware
- `patterns.md` — код-конвенции, auth, deploy pipeline, rate limits
- `deployment.md` — серверы, деплой, Nginx, пермишены

Читай только нужный файл для текущей задачи, не все сразу.

## После compaction

Прочитай `.claude/CURRENT_WORK.md` — там текущая задача и прогресс. Обновляй при начале/завершении крупных задач.

## Шаблоны

- `.claude/templates/user-spec.md` — бриф перед крупной фичей

## Quick Reference

- Emerald accent (green-500/600), anime.js 4.x named exports, React 19 useRef(null)
- API fallback: `response.project || response`
- JWT 30d, Bearer, localStorage `vibe_token`
- Тарифы: FREE (1 site, 50MB, 30 дней) / PRO (3, 500MB, 386₽/мес)
- Deploy: build → rsync → tsc on prod → PM2 restart → chmod static
- PM2: `sudo PM2_HOME=/root/.pm2 pm2`

## TODO
See `TODO.md`
