'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, Plus, Trash2, CheckCircle, Clock, AlertTriangle,
  Loader2, Shield, Copy, Check, X, ChevronDown,
} from 'lucide-react';
import { api, type Domain, type Project } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showToast } from '@/lib/toast';

const sslBadge: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400', label: 'Ожидание' },
  PROVISIONING: { color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300', label: 'Выпуск SSL' },
  ACTIVE: { color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', label: 'SSL активен' },
  FAILED: { color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300', label: 'SSL ошибка' },
  EXPIRED: { color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300', label: 'SSL истёк' },
};

const SERVER_IP = '203.0.113.10';

interface RegistrarGuide {
  name: string;
  url: string;
  steps: { action: string; detail?: string }[];
  warning?: string;
}

function getRegistrarGuides(hostname: string, ip: string, verifyToken?: string): RegistrarGuide[] {
  return [
    {
      name: 'REG.RU',
      url: 'https://www.reg.ru/user/account/#/domains/',
      steps: [
        { action: 'Войдите в личный кабинет на reg.ru' },
        { action: 'Перейдите в «Мои домены»', detail: 'Левое меню → «Мои домены». Нажмите на ваш домен.' },
        { action: 'Откройте «DNS-серверы и управление зоной»', detail: 'Это кнопка в карточке домена, обычно в самом низу страницы.' },
        { action: 'Проверьте DNS-серверы', detail: 'Должны быть ns1.reg.ru и ns2.reg.ru. Если другие — нажмите «Изменить» и выберите «Бесплатные DNS-серверы REG.RU». После смены подождите 15 минут.' },
        { action: 'Нажмите «Управление зоной» → «Добавить запись»' },
        {
          action: 'Создайте A-запись',
          detail: `Тип записи: A. В поле «Subdomain» введите @ (или оставьте пустым). В поле «IP Address» вставьте ${ip}. TTL оставьте по умолчанию.`,
        },
        {
          action: 'Создайте CNAME-запись для www',
          detail: `Тип записи: CNAME. В поле «Subdomain» введите www. В поле «Canonical name» вставьте ${hostname}. (с точкой в конце!). TTL оставьте по умолчанию.`,
        },
        ...(verifyToken ? [{
          action: 'Создайте TXT-запись для подтверждения',
          detail: `Тип записи: TXT. В поле «Subdomain» введите _vibe-verify. В поле «Text» вставьте ${verifyToken}. TTL оставьте по умолчанию.`,
        }] : []),
        { action: 'Нажмите «Сохранить» после каждой записи', detail: 'Убедитесь, что все 3 записи появились в списке. Если была старая A-запись на @ — удалите её (нажмите корзину).' },
      ],
      warning: 'Если DNS-серверы не REG.RU (например, Cloudflare или хостинг) — записи нужно добавлять там, а не в REG.RU.',
    },
    {
      name: 'Timeweb',
      url: 'https://timeweb.cloud/my/domains',
      steps: [
        { action: 'Войдите в панель timeweb.cloud' },
        { action: 'Перейдите в «Домены»', detail: 'Левое меню → «Домены». Нажмите на ваш домен в списке.' },
        { action: 'Откройте вкладку «DNS-записи»', detail: 'Вверху карточки домена есть вкладки: Обзор, DNS-записи, и т.д. Нажмите «DNS-записи».' },
        { action: 'Удалите старые A-записи', detail: 'Если в списке есть A-запись для @ с другим IP — нажмите на неё, потом нажмите «Удалить». Иначе будет конфликт.' },
        {
          action: 'Нажмите «Добавить запись» → тип A',
          detail: `Хост: оставьте пустым (это значит корневой домен). Значение: ${ip}. TTL: 3600.`,
        },
        {
          action: 'Ещё раз «Добавить запись» → тип CNAME',
          detail: `Хост: www. Значение: ${hostname}. TTL: 3600.`,
        },
        ...(verifyToken ? [{
          action: 'Ещё раз «Добавить запись» → тип TXT',
          detail: `Хост: _vibe-verify. Значение: ${verifyToken}. TTL: 3600.`,
        }] : []),
      ],
    },
    {
      name: 'Beget',
      url: 'https://cp.beget.com/domains',
      steps: [
        { action: 'Войдите в панель управления beget.com' },
        { action: 'Перейдите в раздел «Домены»', detail: 'Левое меню → «Домены». Найдите ваш домен в списке.' },
        { action: 'Нажмите на шестерёнку справа от домена', detail: 'Откроется выпадающее меню. Выберите «DNS».' },
        { action: 'Выберите «Свой DNS» если ещё не выбрано', detail: 'По умолчанию у Beget может стоять «DNS Beget» — это ок, записи можно добавлять.' },
        { action: 'Нажмите «Управление DNS-записями»' },
        {
          action: 'Добавьте A-запись',
          detail: `Нажмите «Добавить». Тип: A. Имя: @ (или оставьте пустым). Адрес: ${ip}.`,
        },
        {
          action: 'Добавьте CNAME-запись',
          detail: `Нажмите «Добавить». Тип: CNAME. Имя: www. Домен: ${hostname}.`,
        },
        ...(verifyToken ? [{
          action: 'Добавьте TXT-запись',
          detail: `Нажмите «Добавить». Тип: TXT. Имя: _vibe-verify. Значение: ${verifyToken}.`,
        }] : []),
        { action: 'Проверьте и сохраните', detail: 'Убедитесь, что старых A-записей на @ не осталось. Если есть — удалите их.' },
      ],
    },
    {
      name: 'Cloudflare',
      url: 'https://dash.cloudflare.com',
      steps: [
        { action: 'Войдите в dash.cloudflare.com' },
        { action: 'Выберите ваш домен', detail: 'На главной странице нажмите на домен в списке сайтов.' },
        { action: 'Перейдите в раздел «DNS»', detail: 'Левое меню → «DNS» → «Records».' },
        {
          action: 'Нажмите «Add record» → тип A',
          detail: `Name: @. IPv4 address: ${ip}. Proxy status: ОБЯЗАТЕЛЬНО переключите на «DNS only» (серое облако). Если оставить оранжевое — SSL не выпустится!`,
        },
        {
          action: 'Ещё раз «Add record» → тип CNAME',
          detail: `Name: www. Target: ${hostname}. Proxy status: тоже «DNS only» (серое облако).`,
        },
        ...(verifyToken ? [{
          action: 'Ещё раз «Add record» → тип TXT',
          detail: `Name: _vibe-verify. Content: ${verifyToken}.`,
        }] : []),
      ],
      warning: 'Proxy (оранжевое облако) НУЖНО отключить! Нажмите на облако — оно станет серым. Иначе certbot не сможет выпустить SSL-сертификат.',
    },
    {
      name: 'Другой',
      url: '',
      steps: [
        { action: 'Войдите в панель управления вашего регистратора', detail: 'Это сайт, где вы покупали домен (например, nic.ru, r01.ru, 2domains.ru и т.д.).' },
        { action: 'Найдите настройки DNS', detail: 'Обычно раздел называется «DNS», «DNS-записи», «Управление зоной» или «Resource records». Может быть внутри настроек домена.' },
        { action: 'Удалите старые A-записи для @ (если есть)', detail: 'Если есть A-запись с чужим IP — удалите. Две A-записи вызовут проблемы.' },
        {
          action: 'Добавьте A-запись',
          detail: `Тип: A. Имя/Host: @ (или пустое поле). Значение/Value/IP: ${ip}. TTL: 3600 (или «по умолчанию»).`,
        },
        {
          action: 'Добавьте CNAME-запись',
          detail: `Тип: CNAME. Имя/Host: www. Значение/Value: ${hostname}. (некоторые регистраторы требуют точку в конце). TTL: 3600.`,
        },
        ...(verifyToken ? [{
          action: 'Добавьте TXT-запись',
          detail: `Тип: TXT. Имя/Host: _vibe-verify. Значение/Value: ${verifyToken}. TTL: 3600.`,
        }] : []),
        { action: 'Сохраните изменения' },
      ],
    },
  ];
}

function DnsGuide({ domain, copied, copyToClipboard }: {
  domain: Domain;
  copied: string;
  copyToClipboard: (text: string, key: string) => void;
}) {
  const [openRegistrar, setOpenRegistrar] = useState<string | null>(null);

  return (
    <div className="mt-4 ml-3 sm:ml-6 space-y-4">
      <div className="p-5 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Подключение домена {domain.hostname}</p>
        <p className="text-xs text-gray-500 mb-1">Нужно указать вашему домену, что сайт теперь живёт на нашем сервере. Для этого добавьте 2 DNS-записи.</p>
        <p className="text-xs text-gray-400 mb-4">DNS — это «телефонная книга» интернета. Вы меняете запись «куда ведёт домен» у регистратора, где покупали домен.</p>

        {/* Step 1: Where to go */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">Откройте настройки DNS у вашего регистратора</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">
                Зайдите на сайт, где вы покупали домен, и найдите раздел управления DNS-записями.
              </p>

              {/* Registrar tabs */}
              {(() => {
                const guides = getRegistrarGuides(domain.hostname, SERVER_IP, domain.verifyToken ?? undefined);
                const activeGuide = guides.find(r => r.name === openRegistrar);
                return (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {guides.map((r) => (
                        <button
                          key={r.name}
                          onClick={() => setOpenRegistrar(openRegistrar === r.name ? null : r.name)}
                          className={`px-2.5 py-1.5 text-xs sm:text-[11px] rounded-md border transition-colors ${
                            openRegistrar === r.name
                              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-200 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                        >
                          {r.name}
                          <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${openRegistrar === r.name ? 'rotate-180' : ''}`} />
                        </button>
                      ))}
                    </div>

                    {/* Registrar-specific steps */}
                    {activeGuide && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 mb-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">{activeGuide.name}</p>
                          {activeGuide.url && (
                            <a href={activeGuide.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-500 hover:text-emerald-700 underline">
                              Открыть панель →
                            </a>
                          )}
                        </div>
                        {activeGuide.warning && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-2">
                            <p className="text-[11px] text-yellow-700">
                              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                              {activeGuide.warning}
                            </p>
                          </div>
                        )}
                        <ol className="space-y-2">
                          {activeGuide.steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-xs">
                              <span className="text-gray-400 font-mono shrink-0 mt-0.5">{i + 1}.</span>
                              <div>
                                <span className="text-gray-700 font-medium">{step.action}</span>
                                {step.detail && (
                                  <p className="text-gray-500 mt-0.5">{step.detail}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Step 2: DNS records */}
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">2</div>
            <div className="flex-1">
              <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">Добавьте DNS-записи</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">A-запись направляет ваш домен на наш сервер. CNAME — чтобы сайт открывался и по www.</p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mb-2">
                <p className="text-[11px] text-yellow-700">
                  <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                  <span className="font-medium">Важно:</span> если у вас уже есть A-запись для <span className="font-mono">@</span> (от старого хостинга или регистратора) — сначала удалите её, потом добавляйте новую. Две A-записи одновременно вызовут проблемы.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                      <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Тип</th>
                      <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Имя</th>
                      <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Значение</th>
                      <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium hidden sm:table-cell">TTL</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-50">
                      <td className="px-2 sm:px-3 py-2 font-mono font-semibold text-gray-800 dark:text-gray-100">A</td>
                      <td className="px-2 sm:px-3 py-2">
                        <span className="font-mono text-gray-700 dark:text-gray-200">@</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5 hidden sm:block">Где-то нужно оставить пустым, где-то ввести @</span>
                      </td>
                      <td className="px-2 sm:px-3 py-2 font-mono text-emerald-600 font-semibold">{SERVER_IP}</td>
                      <td className="px-2 sm:px-3 py-2 text-gray-500 hidden sm:table-cell">3600</td>
                      <td className="px-1 py-2">
                        <button
                          onClick={() => copyToClipboard(SERVER_IP, `a-${domain.id}`)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Скопировать IP"
                        >
                          {copied === `a-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 sm:px-3 py-2 font-mono font-semibold text-gray-800 dark:text-gray-100">CNAME</td>
                      <td className="px-2 sm:px-3 py-2 font-mono text-gray-700 dark:text-gray-200">www</td>
                      <td className="px-2 sm:px-3 py-2 font-mono text-emerald-600 font-semibold break-all">{domain.hostname}</td>
                      <td className="px-2 sm:px-3 py-2 text-gray-500 hidden sm:table-cell">3600</td>
                      <td className="px-1 py-2">
                        <button
                          onClick={() => copyToClipboard(domain.hostname, `cname-${domain.id}`)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Скопировать домен"
                        >
                          {copied === `cname-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 space-y-0.5">
                <span className="block"><span className="font-medium">@</span> — это ваш основной домен ({domain.hostname}), без www.</span>
                <span className="block"><span className="font-medium">www</span> — чтобы сайт работал и по www.{domain.hostname}.</span>
                <span className="block"><span className="font-medium">TTL</span> — время обновления (3600 = 1 час). Если нет такого поля — пропустите, регистратор поставит сам.</span>
                <span className="block">Если регистратор просит точку в конце значения CNAME — добавьте: <span className="font-mono">{domain.hostname}.</span></span>
              </p>
            </div>
          </div>

          {/* Step 3: TXT record */}
          {domain.verifyToken && (
            <div className="flex gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">3</div>
              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">Добавьте TXT-запись для проверки</p>
                <p className="text-xs text-gray-500 mt-1 mb-2">Эта запись подтверждает, что домен принадлежит вам. В поле «Имя» введите <span className="font-mono font-medium">_vibe-verify</span>, в поле «Значение» — код ниже.</p>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                        <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Тип</th>
                        <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Имя</th>
                        <th className="text-left px-2 sm:px-3 py-1.5 text-gray-400 font-medium">Значение</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 sm:px-3 py-2 font-mono font-semibold text-gray-800 dark:text-gray-100">TXT</td>
                        <td className="px-2 sm:px-3 py-2 font-mono text-gray-700 dark:text-gray-200 break-all">_vibe-verify</td>
                        <td className="px-2 sm:px-3 py-2 font-mono text-emerald-600 font-semibold break-all">{domain.verifyToken}</td>
                        <td className="px-1 py-2">
                          <button
                            onClick={() => copyToClipboard(domain.verifyToken!, `txt-${domain.id}`)}
                            className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
                            title="Скопировать токен"
                          >
                            {copied === `txt-${domain.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Wait and verify */}
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">{domain.verifyToken ? '4' : '3'}</div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">Подождите и нажмите «Проверить»</p>
              <p className="text-xs text-gray-500 mt-1">
                После сохранения записей подождите <span className="font-medium text-gray-700">5–30 минут</span> (обычно хватает 10). Можете проверить готовность на{' '}
                <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">dnschecker.org</a>.
                Когда DNS обновится — нажмите кнопку
                {' '}<span className="inline-flex items-center gap-0.5 font-medium text-emerald-600"><CheckCircle className="w-3 h-3" /> Проверить</span> выше.
                Мы автоматически выпустим бесплатный SSL-сертификат.
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Если регистратор показывает «Изменения применены» — можно проверять сразу. У некоторых провайдеров обновление DNS занимает до 48 часов, но это редкость.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">Частые вопросы</p>
          <div className="space-y-2 text-[11px] text-gray-500">
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Что если уже есть A-запись?</span> Удалите старую и добавьте новую с нашим IP. Две A-записи на @ одновременно вызовут проблемы — сайт будет открываться через раз.</p>
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Обязательно ли добавлять CNAME для www?</span> Рекомендуем — иначе www.{domain.hostname} покажет ошибку. Если вам точно не нужен www, можно пропустить.</p>
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Я использую Cloudflare. Что делать?</span> Добавьте записи как обычно, но обязательно отключите Proxy (оранжевое облако → переключите на серое «DNS only»). С включённым прокси SSL-сертификат не выпустится.</p>
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Как проверить, что DNS обновился?</span> Откройте <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">dnschecker.org</a>, введите ваш домен и проверьте A-запись. Если везде показывает {SERVER_IP} — DNS обновился, можно нажимать «Проверить».</p>
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Прошло больше часа, но не работает.</span> Убедитесь: 1) записи сохранились в панели регистратора, 2) нет старых A-записей, 3) если Cloudflare — отключён Proxy. Попробуйте нажать «Проверить» ещё раз.</p>
            <p><span className="font-medium text-gray-600 dark:text-gray-300">Мне нужно платить за SSL?</span> Нет. Мы автоматически выпускаем бесплатный SSL-сертификат Let&apos;s Encrypt после подтверждения домена.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DomainsPage() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [hostname, setHostname] = useState('');
  const [projectId, setProjectId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [domainsData, projectsData] = await Promise.all([
        api.getDomains(),
        api.getProjects(),
      ]);
      setDomains(domainsData);
      setProjects(projectsData);
    } catch {
      showToast('Не удалось загрузить данные доменов', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      await api.addDomain(hostname, projectId);
      setHostname('');
      setProjectId('');
      setShowAdd(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    setVerifyMsg(null);
    try {
      const result = await api.verifyDomain(id);
      setVerifyMsg({ id, ok: result.verified, text: result.message });
      if (result.verified) await loadData();
    } catch (err) {
      setVerifyMsg({ id, ok: false, text: err instanceof Error ? err.message : 'Ошибка' });
    } finally {
      setVerifying(null);
    }
  };

  const handleRetrySSL = async (id: string) => {
    setRetrying(id);
    setVerifyMsg(null);
    try {
      const result = await api.verifyDomain(id);
      setVerifyMsg({ id, ok: result.sslStatus === 'ACTIVE', text: result.message });
      await loadData();
    } catch (err) {
      setVerifyMsg({ id, ok: false, text: err instanceof Error ? err.message : 'Ошибка' });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDomain(id);
      await loadData();
    } catch {
      showToast('Не удалось удалить домен', 'error');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const isPro = user?.isAdmin || user?.plan === 'PRO';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Домены</h1>
        {isPro && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? 'Отмена' : 'Добавить домен'}
          </button>
        )}
      </div>

      {!isPro && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Кастомные домены — PRO</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Подключите свой домен к проекту. CNAME или TXT верификация, автоматический SSL.
              </p>
              <a href="/billing" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">
                Перейти на PRO — 386 ₽/мес
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add domain form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Новый домен</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="hostname" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Домен
              </label>
              <input
                id="hostname"
                type="text"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, ''))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
                placeholder="example.com"
              />
              <p className="text-[10px] text-gray-400 mt-1">Введите домен без http:// и www. Например: mysite.ru</p>
            </div>

            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Проект
              </label>
              <select
                id="project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
              >
                <option value="">Выберите проект</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} ({p.slug})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={adding}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Добавить
            </button>
          </form>
        </div>
      )}

      {/* Domains list */}
      {domains.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
          <Globe className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isPro ? 'У вас пока нет кастомных доменов' : 'Доступно на плане PRO'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white truncate">{domain.hostname}</span>
                    {domain.verified ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Подтверждён
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-600">
                        <Clock className="w-3.5 h-3.5" />
                        Ожидает DNS
                      </span>
                    )}
                  </div>

                  {domain.project && (
                    <p className="text-xs text-gray-400 ml-6">
                      Проект: {domain.project.title} ({domain.project.slug})
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 ml-6">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sslBadge[domain.sslStatus]?.color || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {sslBadge[domain.sslStatus]?.label || domain.sslStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!domain.verified && (
                    <button
                      onClick={() => handleVerify(domain.id)}
                      disabled={verifying === domain.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {verifying === domain.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Проверить
                    </button>
                  )}
                  {domain.verified && domain.sslStatus !== 'ACTIVE' && (
                    <button
                      onClick={() => handleRetrySSL(domain.id)}
                      disabled={retrying === domain.id}
                      className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-medium hover:bg-yellow-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {retrying === domain.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                      Повторить SSL
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(domain.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Verify message */}
              {verifyMsg && verifyMsg.id === domain.id && (
                <div className={`mt-3 ml-6 p-2.5 rounded-lg text-xs ${
                  verifyMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {verifyMsg.ok ? (
                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  )}
                  {verifyMsg.text}
                </div>
              )}

              {/* SSL error help for verified domains with failed SSL */}
              {domain.verified && domain.sslStatus === 'FAILED' && !verifyMsg?.id && (
                <div className="mt-3 ml-6 p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 space-y-1.5">
                  <p className="font-medium">SSL-сертификат не удалось выпустить. Частые причины:</p>
                  <ul className="list-disc ml-4 space-y-1 text-red-600">
                    <li>DNS ещё не обновился — подождите 10–30 минут после настройки</li>
                    <li>Если домен на Cloudflare — убедитесь, что Proxy отключён (серое облако, «DNS only»)</li>
                    <li>Проверьте A-запись на <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="underline">dnschecker.org</a> — должна быть {SERVER_IP}</li>
                  </ul>
                  <p className="text-red-500">Исправьте проблему и нажмите «Повторить SSL» выше.</p>
                </div>
              )}

              {/* DNS instructions for unverified domains */}
              {!domain.verified && <DnsGuide domain={domain} copied={copied} copyToClipboard={copyToClipboard} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
