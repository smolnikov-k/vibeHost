# Review — код-ревью с фокусом на безопасность хостинга

Проверяет изменённый код по 4 направлениям, приоритезированным для хостинг-платформы.

## Когда использовать
- Перед деплоем крупных изменений
- После добавления нового route или service
- При работе с пользовательским вводом, файлами, shell-командами

## Процесс

### 1. Собрать diff
Запусти `git diff --cached` (staged) или `git diff` (unstaged). Если нет diff — спроси что ревьюить.

### 2. Проверить по 4 направлениям

#### Безопасность (критический приоритет для хостинга)
- **Path traversal:** любой путь из пользовательского ввода (slug, filename, path query) — проверить на `..`, абсолютные пути, symlink escape
- **Command injection:** `exec`, `spawn`, `execSync` — никогда не передавать пользовательский ввод в shell. Использовать массив args
- **ZIP bombs:** validateZip должен проверять ratio, количество файлов, forbidden extensions
- **SSRF:** если код делает HTTP-запросы по URL от пользователя (GitHub deploy) — проверить на internal IP
- **Auth bypass:** новые routes ПЕРЕД authMiddleware = публичные. Убедиться что это намеренно
- **XSS через innerHTML:** editor и visual patches — sanitize пользовательский HTML
- **Secrets в коде:** JWT_SECRET, пароли, токены не должны быть hardcoded

#### Паттерны проекта
- Ответы API: `{ error: "..." }` для ошибок, прямой объект для успеха
- Rate limiting на новых routes
- BigInt → Number() для sizeBytes
- Проверка плана (FREE/PRO) для premium-функций
- Custom type declarations в `global.d.ts` если используются новые Node API

#### Ресурсы и производительность
- Утечки: незакрытые streams, Prisma connections без disconnect
- N+1 запросы: findMany в цикле вместо include/join
- Большие файлы в памяти: использовать streams для ZIP/файлов

#### Nginx и деплой (если затронуты)
- `nginx -t` перед reload
- Пермишены: www-data должен читать файлы
- CORS: проверить Access-Control-Allow-Origin
- SSL: certbot для новых доменов

### 3. Отчёт

Для каждого найденного issue:

| # | Severity | Файл:строка | Проблема | Рекомендация |
|---|----------|-------------|----------|-------------|

Severity: `CRITICAL` (эксплойт), `HIGH` (потенциальная уязвимость), `MEDIUM` (плохая практика), `LOW` (стиль/readability)

### 4. Вердикт
- **OK** — можно деплоить
- **FIX REQUIRED** — есть CRITICAL/HIGH, деплоить нельзя
- **ADVISORY** — есть MEDIUM/LOW, деплоить можно но лучше пофиксить
