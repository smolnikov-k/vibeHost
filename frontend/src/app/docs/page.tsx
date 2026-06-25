import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, FileArchive, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Документация по деплою',
  description: 'Актуальные правила загрузки и деплоя сайтов на VibeHosting: архивы, автосборка, лимиты, API и ошибки.',
  alternates: {
    canonical: '/docs',
  },
};

const archiveFormats = ['.zip', '.tar.gz', '.tgz'];
const buildOutputs = ['dist/', 'build/', 'out/', '.output/public/'];
const forbiddenExtensions = ['.php', '.exe', '.sh', '.py', '.cgi', '.htaccess', '.bat', '.cmd', '.pl', '.jsp', '.asp', '.aspx', '.rb'];
const ignoredFiles = ['.env', '.git', '.gitignore', '.npmrc', '.dockerignore', '.DS_Store', 'Thumbs.db', '.gitkeep', '.gitattributes'];
const autoInjectedScripts = ['vibe-forms.js', 'vibe-patches.js', 'vibe-analytics.js'];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
          <Link href="/llms.txt" className="text-xs text-gray-400 hover:text-emerald-500 transition-colors">
            llms.txt
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 overflow-x-hidden">
        <article className="prose prose-sm prose-gray max-w-none break-words">
          <h1>Документация по деплою</h1>
          <p className="lead text-gray-600 dark:text-gray-300">
            Эта страница описывает текущие правила деплоя на VibeHosting по состоянию кода:
            какие архивы поддерживаются, как работает автосборка, какие лимиты действуют
            и как автоматизировать публикацию через API.
          </p>

          <div className="not-prose bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 my-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800 dark:text-emerald-300">
                <strong>Для AI и автоматизаций:</strong> машиночитаемая версия этой документации доступна по адресу{' '}
                <a href="/llms.txt" className="underline font-medium">hostingvibe.ru/llms.txt</a>.
              </div>
            </div>
          </div>

          <h2>Что поддерживается</h2>
          <p>
            VibeHosting публикует <strong>статический результат</strong>: HTML, CSS, JavaScript, изображения,
            шрифты, видео и другие ассеты. Серверный код на PHP, Python, Node.js и похожих технологиях не исполняется.
          </p>
          <p>
            На вход можно передать либо уже собранный статический сайт, либо исходники фронтенд-проекта,
            если в архиве есть <code>package.json</code> со скриптом <code>build</code>. После сборки на хостинг всё
            равно попадает только статический output.
          </p>

          <h2>Способы деплоя</h2>
          <div className="not-prose grid gap-3 my-4">
            <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <FileArchive className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">Архивный деплой</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Поддерживаются форматы {archiveFormats.map((format, index) => (
                    <span key={format}>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{format}</code>
                      {index < archiveFormats.length - 1 ? ', ' : ''}
                    </span>
                  ))}. В корне архива должен быть <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">index.html</code> или{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">package.json</code> со сборкой.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">Автосборка исходников</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Если в архиве найден <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">package.json</code> со скриптом{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">build</code>, VibeHosting выполняет{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">npm install</code> или{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">npm ci</code>, затем{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">npm run build</code> и ищет результат в{' '}
                  {buildOutputs.map((dir, index) => (
                    <span key={dir}>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{dir}</code>
                      {index < buildOutputs.length - 1 ? ', ' : ''}
                    </span>
                  ))}.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">GitHub deploy</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Через личный кабинет можно деплоить публичный GitHub-репозиторий. В нём уже должен существовать готовый{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">index.html</code> в корне или в выбранной подпапке.
                  Автосборка для GitHub-flow сейчас не запускается.
                </div>
              </div>
            </div>
          </div>

          <h2>Ограничения по тарифам</h2>
          <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Параметр</th>
                  <th className="px-4 py-3 text-left font-semibold">Free</th>
                  <th className="px-4 py-3 text-left font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Количество проектов</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">3</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Макс. размер одного сайта</td>
                  <td className="px-4 py-3">100 МБ</td>
                  <td className="px-4 py-3">500 МБ</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Общее хранилище</td>
                  <td className="px-4 py-3">100 МБ</td>
                  <td className="px-4 py-3">500 МБ</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Макс. файлов в деплое</td>
                  <td className="px-4 py-3" colSpan={2}>5 000</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Кастомный домен</td>
                  <td className="px-4 py-3">Нет</td>
                  <td className="px-4 py-3">Да</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">Rollback на предыдущую версию</td>
                  <td className="px-4 py-3">Нет</td>
                  <td className="px-4 py-3">Да</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Запрещённые типы файлов</h2>
          <p>
            Если архив содержит файл с любым из этих расширений, <strong>весь деплой будет отклонён</strong>:
          </p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {forbiddenExtensions.map(ext => (
              <span key={ext} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300 font-mono">
                <XCircle className="w-3.5 h-3.5" />
                {ext}
              </span>
            ))}
          </div>
          <p>
            Это правило не означает, что исходники запрещены полностью. Можно загружать фронтенд-проекты,
            но без серверных или исполняемых файлов внутри архива.
          </p>

          <h2>Игнорируемые файлы</h2>
          <p>Эти файлы автоматически пропускаются при извлечении и не влияют на деплой:</p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {ignoredFiles.map(name => (
              <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-700 dark:text-yellow-300 font-mono">
                {name}
              </span>
            ))}
          </div>

          <h2>Правильная структура архива</h2>
          <div className="not-prose bg-gray-900 rounded-lg p-4 my-4 font-mono text-sm text-gray-100 leading-relaxed overflow-x-auto">
            <div className="text-emerald-400 mb-2"># Вариант 1: готовый статический сайт</div>
            <div>my-site.zip</div>
            <div className="text-gray-400">├── index.html</div>
            <div className="text-gray-400">├── assets/</div>
            <div className="text-gray-400">├── styles.css</div>
            <div className="text-gray-400">└── script.js</div>
            <div className="text-emerald-400 mt-4 mb-2"># Вариант 2: файлы лежат в одной подпапке</div>
            <div>my-site.tgz</div>
            <div className="text-gray-400">└── dist/</div>
            <div className="text-gray-400">    ├── index.html</div>
            <div className="text-gray-400">    └── assets/...</div>
            <div className="text-emerald-400 mt-4 mb-2"># Вариант 3: исходники с автосборкой</div>
            <div>my-app.zip</div>
            <div className="text-gray-400">├── package.json</div>
            <div className="text-gray-400">├── package-lock.json</div>
            <div className="text-gray-400">├── src/</div>
            <div className="text-gray-400">└── public/</div>
          </div>

          <h2>Что платформа добавляет автоматически</h2>
          <p>
            После успешного деплоя VibeHosting может автоматически встроить служебные скрипты платформы в HTML-файлы.
            Их не нужно включать в архив вручную.
          </p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {autoInjectedScripts.map(name => (
              <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm text-emerald-700 dark:text-emerald-300 font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                {name}
              </span>
            ))}
          </div>
          <p>
            Если у проекта настроен счётчик Яндекс.Метрики, он тоже добавляется автоматически во все HTML-страницы.
          </p>

          <h2>API и автоматизация</h2>
          <p>
            Веб-клиент использует защищённую <code>httpOnly</code>-cookie <code>vibe_token</code>. Для CLI и внешних
            интеграций backend также возвращает JWT в ответе на <code>/api/auth/register</code> и{' '}
            <code>/api/auth/login</code>, и этот токен можно передавать как <code>Authorization: Bearer ...</code>.
          </p>
          <p>
            Время жизни текущей auth-сессии — <strong>7 дней</strong>. Для автоматизаций удобно хранить Bearer JWT,
            а для браузера ничего дополнительно сохранять не нужно.
          </p>
          <div className="not-prose bg-gray-900 rounded-lg p-4 my-4 font-mono text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">{`# Логин (получаем JWT и cookie)
curl -s -X POST https://hostingvibe.ru/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"USER_EMAIL","password":"USER_PASSWORD"}'

# Создание проекта
curl -s -X POST https://hostingvibe.ru/api/projects \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"title":"My site","slug":"my-site"}'

# Архивный деплой
curl -s -X POST https://hostingvibe.ru/api/projects/PROJECT_ID/deploy \\
  -H "Authorization: Bearer TOKEN" \\
  -F "file=@site.zip"`}</div>

          <h2>Частые ошибки</h2>
          <div className="not-prose space-y-3 my-4">
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900 dark:text-red-300">«Запрещённый тип файла: .py»</div>
                <div className="text-sm text-red-700 dark:text-red-400 mt-1">
                  В архиве найден исполняемый или серверный файл. Удалите его из архива и загружайте только фронтенд-часть.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900 dark:text-red-300">«Архив должен содержать index.html в корне или package.json для сборки»</div>
                <div className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Вы загрузили исходники без статического output и без build-скрипта. Нужен либо готовый <code className="text-xs">index.html</code>,
                  либо проект, который можно собрать через <code className="text-xs">npm run build</code>.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900 dark:text-red-300">«Сборка прошла, но не найден index.html»</div>
                <div className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Проверьте, что build кладёт сайт в <code className="text-xs">dist/</code>, <code className="text-xs">build/</code>,{' '}
                  <code className="text-xs">out/</code> или <code className="text-xs">.output/public/</code>.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900 dark:text-red-300">«Слишком много файлов»</div>
                <div className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Скорее всего, в архив попали <code className="text-xs">node_modules</code>, кеши сборки или лишние ассеты.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900 dark:text-red-300">«Размер превышает лимит»</div>
                <div className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Сожмите медиафайлы, уберите лишние исходники или перейдите на PRO, если проект объективно больше 100 МБ.
                </div>
              </div>
            </div>
          </div>

          <h2>Инструкция для нейросети</h2>
          <p>
            Если вы просите нейросеть подготовить проект под VibeHosting, можно дать ей такой короткий prompt:
          </p>
          <div className="not-prose bg-gray-900 rounded-lg p-4 my-4 font-mono text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">{`Сделай сайт для VibeHosting (hostingvibe.ru).

Правила:
- результат должен быть статическим
- можно прислать готовый архив .zip / .tar.gz / .tgz
- либо исходники с package.json и командой build
- в итоговом output нужен index.html
- build output должен лежать в dist/, build/, out/ или .output/public/
- запрещены: .php .exe .sh .py .cgi .htaccess .bat .cmd .pl .jsp .asp .aspx .rb
- не включать node_modules, .git, .env
- лимит: 100 МБ на Free и 500 МБ на Pro
- максимум 5 000 файлов`}</div>
        </article>
      </main>
    </div>
  );
}
