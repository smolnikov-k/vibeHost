'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, Plus, Trash2, CheckCircle, Clock, AlertTriangle,
  Loader2, Shield, Copy, Check, X, ChevronDown,
} from 'lucide-react';
import { api, type Domain, type Project } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const sslBadge: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'bg-gray-100 text-gray-500', label: 'Ожидание' },
  PROVISIONING: { color: 'bg-yellow-100 text-yellow-700', label: 'Выпуск SSL' },
  ACTIVE: { color: 'bg-emerald-100 text-emerald-700', label: 'SSL активен' },
  FAILED: { color: 'bg-red-100 text-red-700', label: 'SSL ошибка' },
  EXPIRED: { color: 'bg-orange-100 text-orange-700', label: 'SSL истёк' },
};

const SERVER_IP = '213.139.229.139';

const registrarGuides = [
  {
    name: 'REG.RU',
    steps: [
      'Войдите в личный кабинет reg.ru',
      'Перейдите в раздел «Мои домены» → выберите домен',
      'Нажмите «DNS-серверы и управление зоной»',
      'Если DNS-серверы не ns1.reg.ru / ns2.reg.ru — переключите на «Бесплатные DNS REG.RU»',
      'Нажмите «Управление зоной» → «Добавить запись»',
      'Добавьте записи из таблицы ниже',
    ],
  },
  {
    name: 'Timeweb',
    steps: [
      'Войдите в панель управления timeweb.cloud',
      'Перейдите в раздел «Домены» → выберите домен',
      'Откройте вкладку «DNS-записи»',
      'Удалите старые A-записи (если есть)',
      'Нажмите «Добавить запись» и добавьте записи из таблицы ниже',
    ],
  },
  {
    name: 'Beget',
    steps: [
      'Войдите в панель beget.com → «Домены»',
      'Нажмите на шестерёнку рядом с доменом',
      'Выберите «DNS» → «Управление DNS-записями»',
      'Добавьте записи из таблицы ниже',
    ],
  },
  {
    name: 'Другой',
    steps: [
      'Войдите в панель управления регистратора',
      'Найдите раздел «DNS», «DNS-записи» или «Управление зоной»',
      'Добавьте записи из таблицы ниже',
    ],
  },
];

function DnsGuide({ domain, copied, copyToClipboard }: {
  domain: Domain;
  copied: string;
  copyToClipboard: (text: string, key: string) => void;
}) {
  const [openRegistrar, setOpenRegistrar] = useState<string | null>(null);

  return (
    <div className="mt-4 ml-6 space-y-4">
      <div className="p-5 bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200">
        <p className="text-sm font-bold text-gray-900 mb-1">Подключение домена {domain.hostname}</p>
        <p className="text-xs text-gray-500 mb-4">Нужно добавить 2 записи в настройках DNS вашего домена. Это займёт 5 минут.</p>

        {/* Step 1: Where to go */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">1</div>
            <div className="flex-1">
              <p className="text-sm text-gray-800 font-medium">Откройте настройки DNS у вашего регистратора</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">
                Зайдите на сайт, где вы покупали домен, и найдите раздел управления DNS-записями.
              </p>

              {/* Registrar tabs */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {registrarGuides.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => setOpenRegistrar(openRegistrar === r.name ? null : r.name)}
                    className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                      openRegistrar === r.name
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200 hover:text-emerald-600'
                    }`}
                  >
                    {r.name}
                    <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${openRegistrar === r.name ? 'rotate-180' : ''}`} />
                  </button>
                ))}
              </div>

              {/* Registrar-specific steps */}
              {openRegistrar && (
                <div className="bg-white rounded-lg border border-gray-100 p-3 mb-1">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-2">{openRegistrar}</p>
                  <ol className="space-y-1.5">
                    {registrarGuides.find(r => r.name === openRegistrar)?.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-gray-600">
                        <span className="text-gray-400 font-mono shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: A record */}
          <div className="flex gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">2</div>
            <div className="flex-1">
              <p className="text-sm text-gray-800 font-medium">Добавьте A-запись</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">Она направит ваш домен на наш сервер.</p>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Тип</th>
                      <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Имя (Host)</th>
                      <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Значение (Value)</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 font-mono font-semibold text-gray-800">A</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-gray-700">@</span>
                        <span className="text-gray-400 ml-1">(или пусто)</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-emerald-600 font-semibold">{SERVER_IP}</td>
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
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                <span className="font-medium">@</span> означает корневой домен ({domain.hostname}). В некоторых панелях нужно оставить поле «Имя» пустым.
              </p>
            </div>
          </div>

          {/* Step 3: TXT record */}
          {domain.verifyToken && (
            <div className="flex gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">3</div>
              <div className="flex-1">
                <p className="text-sm text-gray-800 font-medium">Добавьте TXT-запись для проверки</p>
                <p className="text-xs text-gray-500 mt-1 mb-2">Она подтвердит, что домен принадлежит вам.</p>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Тип</th>
                        <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Имя (Host)</th>
                        <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Значение (Value)</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-mono font-semibold text-gray-800">TXT</td>
                        <td className="px-3 py-2 font-mono text-gray-700">_vibe-verify</td>
                        <td className="px-3 py-2 font-mono text-emerald-600 font-semibold break-all">{domain.verifyToken}</td>
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
              <p className="text-sm text-gray-800 font-medium">Подождите и нажмите «Проверить»</p>
              <p className="text-xs text-gray-500 mt-1">
                После сохранения записей подождите <span className="font-medium text-gray-700">5–30 минут</span> (иногда до 48 часов) и нажмите кнопку
                {' '}<span className="inline-flex items-center gap-0.5 font-medium text-emerald-600"><CheckCircle className="w-3 h-3" /> Проверить</span> выше.
                Мы автоматически выпустим SSL-сертификат после подтверждения.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">Частые вопросы</p>
          <div className="space-y-1.5 text-[11px] text-gray-500">
            <p><span className="font-medium text-gray-600">Что если уже есть A-запись?</span> Удалите старую и добавьте новую с нашим IP.</p>
            <p><span className="font-medium text-gray-600">Можно ли использовать CNAME?</span> Да, для поддоменов (www.site.com). Для корневого домена (site.com) используйте A-запись.</p>
            <p><span className="font-medium text-gray-600">Нужен ли мне CDN или Cloudflare?</span> Нет, просто укажите A-запись на наш IP. SSL мы выпускаем автоматически.</p>
            <p><span className="font-medium text-gray-600">Не работает через час?</span> Проверьте, что записи сохранились в панели регистратора, и попробуйте снова.</p>
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

  const loadData = useCallback(async () => {
    try {
      const [domainsData, projectsData] = await Promise.all([
        api.getDomains(),
        api.getProjects(),
      ]);
      setDomains(domainsData);
      setProjects(projectsData);
    } catch {
      // silent
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

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDomain(id);
      await loadData();
    } catch {
      // silent
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const isPro = user?.plan === 'PRO';

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
        <h1 className="text-xl font-bold text-gray-900">Домены</h1>
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
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Кастомные домены — PRO</h3>
              <p className="text-sm text-gray-600 mb-3">
                Подключите свой домен к проекту. CNAME или TXT верификация, автоматический SSL.
              </p>
              <a href="/billing" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                Перейти на PRO — 386 ₽/мес
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add domain form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Новый домен</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="hostname" className="block text-sm font-medium text-gray-700 mb-1">
                Домен
              </label>
              <input
                id="hostname"
                type="text"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                placeholder="example.com"
              />
            </div>

            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
                Проект
              </label>
              <select
                id="project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white"
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Globe className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {isPro ? 'У вас пока нет кастомных доменов' : 'Доступно на плане PRO'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900 truncate">{domain.hostname}</span>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sslBadge[domain.sslStatus]?.color || 'bg-gray-100 text-gray-500'}`}>
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

              {/* DNS instructions for unverified domains */}
              {!domain.verified && <DnsGuide domain={domain} copied={copied} copyToClipboard={copyToClipboard} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
