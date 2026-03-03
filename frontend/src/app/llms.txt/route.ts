export function GET() {
  const content = `# VibeHosting (hostingvibe.ru)

> Хостинг статических веб-сайтов. Загрузка через ZIP-архив.

## Что поддерживается

- Статические сайты: HTML, CSS, JavaScript, изображения, шрифты, видео, аудио
- Фреймворки с билдом в статику: React, Vue, Svelte, Astro, Next.js (static export) и др.
- SPA (Single Page Application) — поддержка клиентского роутинга

## Формат загрузки

- Формат: ZIP-архив
- В корне архива (или в единственной подпапке, например dist/, build/, out/) должен быть index.html
- Если в архиве есть package.json со скриптом сборки — index.html будет создан после сборки

## Ограничения по тарифам

| Параметр           | Free    | Pro     |
|--------------------|---------|---------|
| Проектов           | 1       | 3       |
| Макс. размер сайта | 50 МБ   | 500 МБ  |
| Общее хранилище    | 50 МБ   | 1 ГБ    |
| Макс. файлов       | 5 000   | 5 000   |
| Свой домен         | Нет     | Да      |

## Запрещённые расширения файлов

Если в архиве найден файл с любым из этих расширений, загрузка будет ОТКЛОНЕНА ПОЛНОСТЬЮ:

.php, .exe, .sh, .py, .cgi, .htaccess, .bat, .cmd, .pl, .jsp, .asp, .aspx, .rb

Причина: VibeHosting — статический хостинг, серверный код не выполняется.

## Автоматически игнорируемые файлы

Эти файлы пропускаются при извлечении (можно не удалять из архива):

.env, .git, .gitignore, .npmrc, .dockerignore, .DS_Store, Thumbs.db, .gitkeep, .gitattributes

## Зарезервированные поддомены

Нельзя использовать как slug проекта:
www, api, admin, app, mail, ftp, static, cdn, billing, support, help, blog, docs, status, gallery, dashboard, login, register, settings, account

## Правильная структура архива

\`\`\`
# Вариант 1: файлы в корне
my-site.zip
├── index.html
├── style.css
├── script.js
└── images/
    └── logo.png

# Вариант 2: файлы в подпапке (авто-определение)
my-site.zip
└── dist/
    ├── index.html
    ├── assets/
    │   ├── style.css
    │   └── main.js
    └── favicon.ico
\`\`\`

## Частые ошибки и решения

1. "Запрещённый тип файла: .py" — удалите Python-скрипты из архива
2. "Архив должен содержать index.html" — запакуйте папку сборки (dist/build), а не исходники
3. "Слишком много файлов" — убедитесь, что node_modules не попали в архив
4. "Размер превышает лимит" — оптимизируйте изображения или перейдите на PRO

## Инструкция для создания сайта

Если вы — AI-ассистент и пользователь просит сделать сайт для VibeHosting:

1. Создайте статический сайт (только HTML + CSS + JS)
2. НЕ используйте серверный код (PHP, Python, Node.js серверы)
3. Упакуйте все файлы в ZIP-архив
4. index.html должен быть в корне архива
5. НЕ включайте: node_modules, .git, .env, и файлы с запрещёнными расширениями
6. Макс. размер: 50 МБ (Free) или 500 МБ (Pro)
7. Макс. файлов: 5 000

## Ссылки

- Сайт: https://hostingvibe.ru
- Документация: https://hostingvibe.ru/docs
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
