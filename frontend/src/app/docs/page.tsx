import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, FileArchive, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Документация по загрузке — VibeHosting',
  description: 'Правила и требования к загрузке сайтов на VibeHosting. Форматы файлов, ограничения, структура архива.',
  alternates: {
    canonical: '/docs',
  },
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">
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
          <h1>Документация по загрузке сайтов</h1>
          <p className="lead text-gray-600">
            Эта страница описывает все правила и ограничения загрузки файлов на VibeHosting.
            Вы можете скинуть ссылку на эту страницу своей нейросети (ChatGPT, Claude, YandexGPT и т.д.),
            чтобы она сразу знала требования.
          </p>

          <div className="not-prose bg-emerald-50 border border-emerald-200 rounded-lg p-4 my-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <strong>Для нейросетей:</strong> машиночитаемая версия этой документации доступна по адресу{' '}
                <a href="/llms.txt" className="underline font-medium">hostingvibe.ru/llms.txt</a>
              </div>
            </div>
          </div>

          <h2>Что такое VibeHosting</h2>
          <p>
            VibeHosting — это хостинг <strong>статических</strong> веб-сайтов. Мы размещаем HTML, CSS, JavaScript,
            изображения и другие статические файлы. Серверный код (PHP, Python, Node.js и т.д.) не поддерживается.
          </p>

          <h2>Формат загрузки</h2>
          <p>Сайт загружается как <strong>ZIP-архив</strong>. Требования:</p>

          <div className="not-prose grid gap-3 my-4">
            <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
              <FileArchive className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-gray-900">Структура архива</div>
                <div className="text-sm text-gray-600 mt-1">
                  В корне архива (или в единственной подпапке вроде <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">dist/</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">build/</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">out/</code>) должен быть файл <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">index.html</code>.
                </div>
              </div>
            </div>
          </div>

          <h2>Ограничения по тарифам</h2>
          <div className="not-prose my-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Параметр</th>
                  <th className="px-4 py-3 text-left font-semibold">Free</th>
                  <th className="px-4 py-3 text-left font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Количество проектов</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">3</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Макс. размер сайта</td>
                  <td className="px-4 py-3">50 МБ</td>
                  <td className="px-4 py-3">500 МБ</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Общее хранилище</td>
                  <td className="px-4 py-3">50 МБ</td>
                  <td className="px-4 py-3">1 ГБ</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Макс. файлов в архиве</td>
                  <td className="px-4 py-3" colSpan={2}>5 000</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-3">Свой домен</td>
                  <td className="px-4 py-3">—</td>
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
            {['.php', '.exe', '.sh', '.py', '.cgi', '.htaccess', '.bat', '.cmd', '.pl', '.jsp', '.asp', '.aspx', '.rb'].map(ext => (
              <span key={ext} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 font-mono">
                <XCircle className="w-3.5 h-3.5" />
                {ext}
              </span>
            ))}
          </div>
          <p>
            <strong>Важно:</strong> удалите эти файлы из архива перед загрузкой. Если ваш проект содержит скрипты
            для сборки (например, <code>build.py</code>), запустите сборку локально и загрузите только результат
            (<code>dist/</code> или <code>build/</code>).
          </p>

          <h2>Игнорируемые файлы</h2>
          <p>Эти файлы автоматически пропускаются при распаковке (можно не удалять):</p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {['.env', '.git', '.gitignore', '.npmrc', '.dockerignore', '.DS_Store', 'Thumbs.db', '.gitkeep', '.gitattributes'].map(name => (
              <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700 font-mono">
                {name}
              </span>
            ))}
          </div>

          <h2>Разрешённые типы файлов</h2>
          <p>Любые файлы, не попадающие в запрещённый список, будут извлечены. Типичные файлы статического сайта:</p>
          <div className="not-prose flex flex-wrap gap-2 my-4">
            {['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.mp4', '.webm', '.mp3', '.txt', '.xml', '.map'].map(ext => (
              <span key={ext} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700 font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                {ext}
              </span>
            ))}
          </div>

          <h2>Правильная структура архива</h2>
          <div className="not-prose bg-gray-900 rounded-lg p-4 my-4 font-mono text-sm text-gray-100 leading-relaxed overflow-x-auto">
            <div className="text-emerald-400 mb-2"># Вариант 1: файлы в корне архива</div>
            <div>my-site.zip</div>
            <div className="text-gray-400">├── index.html</div>
            <div className="text-gray-400">├── style.css</div>
            <div className="text-gray-400">├── script.js</div>
            <div className="text-gray-400">└── images/</div>
            <div className="text-gray-400">    ├── logo.png</div>
            <div className="text-gray-400">    └── hero.jpg</div>
            <div className="text-emerald-400 mt-4 mb-2"># Вариант 2: файлы в подпапке (автоопределение)</div>
            <div>my-site.zip</div>
            <div className="text-gray-400">└── dist/</div>
            <div className="text-gray-400">    ├── index.html</div>
            <div className="text-gray-400">    ├── assets/</div>
            <div className="text-gray-400">    │   ├── style.abc123.css</div>
            <div className="text-gray-400">    │   └── main.def456.js</div>
            <div className="text-gray-400">    └── favicon.ico</div>
          </div>

          <h2>Частые ошибки</h2>

          <div className="not-prose space-y-3 my-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900">«Запрещённый тип файла: .py»</div>
                <div className="text-sm text-red-700 mt-1">
                  В архиве найден Python-скрипт. Удалите все <code className="text-xs">.py</code> файлы —
                  VibeHosting не выполняет серверный код.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900">«Архив должен содержать index.html»</div>
                <div className="text-sm text-red-700 mt-1">
                  Нет <code className="text-xs">index.html</code> ни в корне, ни в подпапке. Убедитесь, что вы запаковали
                  результат сборки, а не исходный код проекта.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-red-900">«Слишком много файлов»</div>
                <div className="text-sm text-red-700 mt-1">
                  Архив содержит более 5 000 файлов. Проверьте, не попала ли папка <code className="text-xs">node_modules</code>.
                </div>
              </div>
            </div>
          </div>

          <h2>Инструкция для нейросети</h2>
          <p>
            Если вы просите нейросеть (ChatGPT, Claude, YandexGPT) сделать сайт для VibeHosting,
            отправьте ей эту инструкцию:
          </p>
          <div className="not-prose bg-gray-900 rounded-lg p-4 my-4 font-mono text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">{`Сделай статический сайт для хостинга VibeHosting (hostingvibe.ru).

Правила:
- Только HTML + CSS + JS (серверный код запрещён)
- Упаковать результат в ZIP-архив
- В корне архива должен быть index.html
- Запрещённые расширения: .php .exe .sh .py .cgi .htaccess .bat .cmd .pl .jsp .asp .aspx .rb
- Не включать: node_modules, .git, .env
- Макс. размер: 50 МБ (Free) или 500 МБ (Pro)
- Макс. файлов: 5 000`}</div>

        </article>
      </main>
    </div>
  );
}
