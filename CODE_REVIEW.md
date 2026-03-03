# Код-ревью VibeHosting — 28.02.2026

## CRITICAL (исправить немедленно)

| # | Файл | Проблема |
|---|------|----------|
| 1 | `ecosystem.config.js` | **Хардкод пароля БД** `vibe_pass` и **JWT_SECRET = 'CHANGE_THIS_IN_PRODUCTION'** — перенести в `.env` |
| 2 | `billing.ts:88` | **Вебхук без подписи проходит** — если нет `secretKey`, проверка пропускается. Любой может активировать PRO бесплатно |
| 3 | `projects.ts:167` | **Shell injection** через `execSync` с `siteDir` из пользовательского slug. Заменить на `spawnSync` |

## HIGH (важно)

| # | Файл | Проблема |
|---|------|----------|
| 4 | `auth.ts:83` | `/me` роут без `authMiddleware` — `req.userId = undefined` |
| 5 | `billing.ts:117` | Replay-атака вебхуков — нет проверки уникальности `payment_id` |
| 6 | `deploy.service.ts:88` | Race condition при двух одновременных деплоях — дубликат версий. Нет DB-level lock |

## MEDIUM (планово)

| # | Файл | Проблема |
|---|------|----------|
| 7 | `nginx/hostingvibe.ru` | `client_max_body_size 55m` при лимите PRO 500 МБ → 413 у PRO-юзеров |
| 8 | `deploy.ts:50` | `readFileSync` всего ZIP в память (до 500 МБ) — нужен streaming hash |
| 9 | `deploy.service.ts:25` | ZIP lookup через `f.includes(deploymentId)` — возможен ложный матч. Использовать exact match |
| 10 | `domains.ts:42` | Двойной запрос в БД (user + project) — можно объединить |

## LOW

| # | Файл | Проблема |
|---|------|----------|
| 11 | `ecosystem.config.js:22` | Frontend PM2 через `node_modules/.bin/next` — при очистке node_modules процесс упадёт |
| 12 | `nginx` | Нет HTTPS (SSL ещё не настроен) |
| 13 | `schema.prisma:49` | `Project.likes` counter никогда не обновляется — мёртвое поле |
| 14 | `upload.ts:7,12` | Multer коллбэки типизированы как `any` |

---

**Итого: 14 issues (3 critical, 3 high, 4 medium, 4 low)**
