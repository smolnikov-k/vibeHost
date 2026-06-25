export function GET() {
  const content = `# VibeHosting (hostingvibe.ru)

> Платформа для публикации статических сайтов. Основной flow: создать проект -> загрузить архив или подключить публичный GitHub -> дождаться деплоя.

## Что поддерживается

- Готовые статические сайты: HTML, CSS, JavaScript, изображения, шрифты, видео, PDF и другие ассеты
- Архивы: .zip, .tar.gz, .tgz
- Исходники фронтенд-проекта, если в архиве есть package.json со скриптом build
- SPA и build output из React/Vite, Vue, Svelte, Astro, Next static export и похожих стеков
- Публичный GitHub deploy для репозитория, в котором уже есть готовый index.html

## Что НЕ поддерживается

- Выполнение серверного кода
- PHP, Python, shell-скрипты, CGI и другие исполняемые файлы внутри деплоя
- GitHub deploy с обязательной серверной сборкой: текущий GitHub flow build не запускает

## Как работает архивный деплой

1. Пользователь создаёт проект
2. Загружает .zip / .tar.gz / .tgz
3. Система валидирует размер, количество файлов, forbidden extensions и безопасность путей
4. Если найден package.json со скриптом build, выполняются npm ci или npm install и npm run build
5. Результат ищется в dist/, build/, out/ или .output/public/
6. Статический output публикуется на slug.hostingvibe.ru

## Ограничения по тарифам

| Параметр | Free | Pro |
|---|---|---|
| Проектов | 1 | 3 |
| Макс. размер одного сайта | 100 МБ | 500 МБ |
| Общее хранилище | 100 МБ | 500 МБ |
| Макс. файлов | 5 000 | 5 000 |
| Кастомный домен | Нет | Да |
| Rollback | Нет | Да |

## Запрещённые расширения

.php .exe .sh .py .cgi .htaccess .bat .cmd .pl .jsp .asp .aspx .rb

Если хотя бы один такой файл найден в архиве, весь деплой отклоняется.

## Игнорируемые файлы

.env .git .gitignore .npmrc .dockerignore .DS_Store Thumbs.db .gitkeep .gitattributes

## Требования к структуре

- В корне архива должен быть index.html
- Или все файлы могут лежать в одной подпапке, если внутри неё есть index.html
- Или в архиве должен быть package.json со скриптом build
- После build итоговый index.html должен оказаться в dist/, build/, out/ или .output/public/

## Что система добавляет автоматически

- https://hostingvibe.ru/api/vibe-forms.js
- https://hostingvibe.ru/api/vibe-patches.js
- https://hostingvibe.ru/api/vibe-analytics.js
- Yandex.Metrika, если у проекта задан metrikaId

## Slug rules

- длина: от 3 до 63 символов
- только строчные латинские буквы, цифры и дефисы
- slug не может начинаться или заканчиваться дефисом
- двойной дефис запрещён
- есть зарезервированные slug'и: www, api, admin, app, mail, ftp, static, cdn, billing, support, help, blog, docs, status, gallery, dashboard, login, register, settings, account

## Аутентификация

- Для браузера backend выставляет secure httpOnly cookie vibe_token
- В ответах /api/auth/register и /api/auth/login backend также возвращает JWT
- Для CLI разрешён Authorization: Bearer TOKEN
- Текущее время жизни auth-сессии: 7 дней

## API

Базовый URL: https://hostingvibe.ru/api

### Регистрация

\`\`\`bash
curl -s -X POST https://hostingvibe.ru/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"USER_EMAIL","password":"USER_PASSWORD","displayName":"USER_NAME"}'
\`\`\`

Ответ содержит:

- token
- user
- и одновременно выставляет cookie vibe_token

### Логин

\`\`\`bash
curl -s -X POST https://hostingvibe.ru/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"USER_EMAIL","password":"USER_PASSWORD"}'
\`\`\`

### Текущий пользователь

\`\`\`bash
curl -s https://hostingvibe.ru/api/auth/me \\
  -H "Authorization: Bearer TOKEN"
\`\`\`

### Создание проекта

\`\`\`bash
curl -s -X POST https://hostingvibe.ru/api/projects \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"title":"Название сайта","slug":"my-site","description":"Опционально"}'
\`\`\`

Ответ содержит id проекта и его slug.

### Архивный деплой

\`\`\`bash
curl -s -X POST https://hostingvibe.ru/api/projects/PROJECT_ID/deploy \\
  -H "Authorization: Bearer TOKEN" \\
  -F "file=@site.zip"
\`\`\`

Ответ:

\`\`\`json
{"deploymentId":"DEPLOY_ID","version":1,"status":"PENDING","message":"Деплой запущен"}
\`\`\`

### Статус деплоя

\`\`\`bash
curl -s https://hostingvibe.ru/api/projects/PROJECT_ID/deployments/DEPLOY_ID/status \\
  -H "Authorization: Bearer TOKEN"
\`\`\`

Статусы:

- PENDING
- EXTRACTING
- BUILDING
- LIVE
- FAILED
- SUPERSEDED

### GitHub deploy

\`\`\`bash
curl -s -X POST https://hostingvibe.ru/api/projects/PROJECT_ID/deploy-github \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"repoUrl":"https://github.com/owner/repo","subdir":"dist"}'
\`\`\`

Важно:

- repo должен быть публичным
- внутри repo или subdir должен существовать готовый index.html
- build на этом этапе не запускается

## Частые ошибки

1. "Запрещённый тип файла: .py" -> убрать серверные/исполняемые файлы из архива
2. "Архив должен содержать index.html в корне или package.json для сборки" -> нужен готовый output или корректный build-проект
3. "Сборка прошла, но не найден index.html" -> build кладёт результат не в dist/, build/, out/ или .output/public/
4. "Слишком много файлов" -> обычно в архив попали node_modules или build-cache
5. "Размер превышает лимит" -> сжать ассеты или перейти на Pro

## Рекомендуемый сценарий для AI-ассистента

1. Создай статический сайт или подготовь buildable frontend-проект
2. Не добавляй запрещённые расширения и лишние директории
3. Попроси у пользователя email и пароль
4. Выполни login или register
5. Создай проект
6. Загрузи архив через /deploy или используй /deploy-github
7. Проверяй статус до LIVE
8. После успеха дай ссылку на https://SLUG.hostingvibe.ru

## Ссылки

- Сайт: https://hostingvibe.ru
- Пользовательская документация: https://hostingvibe.ru/docs
- AI prompt: https://hostingvibe.ru/ai
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
