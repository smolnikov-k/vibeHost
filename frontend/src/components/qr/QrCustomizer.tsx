'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Plus, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { api, type QrCodeStyle, type QrCodeInput, type Project } from '@/lib/api';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const DOT_STYLES = [
  { value: 'square', label: 'Квадрат' },
  { value: 'dots', label: 'Круги' },
  { value: 'rounded', label: 'Скруглённые' },
  { value: 'extra-rounded', label: 'Овальные' },
  { value: 'classy', label: 'Классика' },
  { value: 'classy-rounded', label: 'Классика+' },
] as const;

const CORNER_SQUARE_STYLES = [
  { value: 'square', label: 'Квадрат' },
  { value: 'dot', label: 'Круг' },
  { value: 'extra-rounded', label: 'Скруглённый' },
] as const;

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Квадрат' },
  { value: 'dot', label: 'Круг' },
] as const;

interface QrCustomizerProps {
  project: Project;
  projectId: string;
  onClose: () => void;
}

type QrCodeStylingType = import('qr-code-styling').default;

export function QrCustomizer({ project, projectId, onClose }: QrCustomizerProps) {
  const [qrCodes, setQrCodes] = useState<QrCodeStyle[]>([]);
  const [maxQrCodes, setMaxQrCodes] = useState(1);
  const [plan, setPlan] = useState('FREE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);

  // Form state
  const [name, setName] = useState('QR-код');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [dotStyle, setDotStyle] = useState('square');
  const [cornerSquareStyle, setCornerSquareStyle] = useState('square');
  const [cornerDotStyle, setCornerDotStyle] = useState('square');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QrCodeStylingType | null>(null);
  const QrCodeStylingRef = useRef<typeof import('qr-code-styling').default | null>(null);

  const siteUrl = `https://${project.customDomain || `${project.slug}.hostingvibe.ru`}`;

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (utmSource) params.set('utm_source', utmSource);
    if (utmMedium) params.set('utm_medium', utmMedium);
    if (utmCampaign) params.set('utm_campaign', utmCampaign);
    if (utmContent) params.set('utm_content', utmContent);
    if (utmTerm) params.set('utm_term', utmTerm);
    const qs = params.toString();
    return qs ? `${siteUrl}?${qs}` : siteUrl;
  }, [siteUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm]);

  // Load QR codes
  useEffect(() => {
    api.getQrCodes(projectId).then(data => {
      setQrCodes(data.qrCodes);
      setMaxQrCodes(data.maxQrCodes);
      setPlan(data.plan);
      if (data.qrCodes.length > 0) {
        selectQr(data.qrCodes[0]);
      }
    }).catch(() => {});
  }, [projectId]);

  function selectQr(qr: QrCodeStyle) {
    setSelectedId(qr.id);
    setName(qr.name);
    setFgColor(qr.fgColor);
    setBgColor(qr.bgColor);
    setDotStyle(qr.dotStyle);
    setCornerSquareStyle(qr.cornerSquareStyle);
    setCornerDotStyle(qr.cornerDotStyle);
    setUtmSource(qr.utmSource || '');
    setUtmMedium(qr.utmMedium || '');
    setUtmCampaign(qr.utmCampaign || '');
    setUtmContent(qr.utmContent || '');
    setUtmTerm(qr.utmTerm || '');
    const hasUtm = qr.utmSource || qr.utmMedium || qr.utmCampaign || qr.utmContent || qr.utmTerm;
    if (hasUtm) setUtmOpen(true);
  }

  // Dynamic import qr-code-styling (browser only)
  useEffect(() => {
    import('qr-code-styling').then(mod => {
      QrCodeStylingRef.current = mod.default;
    });
  }, []);

  // Render/update QR
  useEffect(() => {
    const QrCodeStyling = QrCodeStylingRef.current;
    if (!QrCodeStyling || !qrRef.current) return;

    const options = {
      width: 260,
      height: 260,
      data: buildUrl(),
      margin: 8,
      dotsOptions: {
        color: fgColor,
        type: dotStyle as any,
      },
      cornersSquareOptions: {
        color: fgColor,
        type: cornerSquareStyle as any,
      },
      cornersDotOptions: {
        color: fgColor,
        type: cornerDotStyle as any,
      },
      backgroundOptions: {
        color: bgColor,
      },
      qrOptions: {
        errorCorrectionLevel: 'M' as const,
      },
    };

    if (qrInstanceRef.current) {
      qrInstanceRef.current.update(options);
    } else {
      const qr = new QrCodeStyling(options);
      qrRef.current.innerHTML = '';
      qr.append(qrRef.current);
      qrInstanceRef.current = qr;
    }
  }, [fgColor, bgColor, dotStyle, cornerSquareStyle, cornerDotStyle, buildUrl]);

  const handleDownload = async (format: 'png' | 'svg') => {
    if (!qrInstanceRef.current) return;
    await qrInstanceRef.current.download({
      name: `${project.slug}-qr`,
      extension: format,
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(buildUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const data: QrCodeInput = {
        name: 'QR-код ' + (qrCodes.length + 1),
        fgColor: '#000000',
        bgColor: '#ffffff',
        dotStyle: 'square',
        cornerSquareStyle: 'square',
        cornerDotStyle: 'square',
      };
      const { qrCode } = await api.createQrCode(projectId, data);
      setQrCodes(prev => [...prev, qrCode]);
      selectQr(qrCode);
    } catch (err: any) {
      alert(err.message || 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const data: QrCodeInput = {
        name, fgColor, bgColor, dotStyle, cornerSquareStyle, cornerDotStyle,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
      };
      const { qrCode } = await api.updateQrCode(projectId, selectedId, data);
      setQrCodes(prev => prev.map(q => q.id === qrCode.id ? qrCode : q));
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteQrCode(projectId, id);
      const remaining = qrCodes.filter(q => q.id !== id);
      setQrCodes(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) {
          selectQr(remaining[0]);
        } else {
          setSelectedId(null);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">QR-коды</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{qrCodes.length}/{maxQrCodes} QR</span>
            <button onClick={onClose} aria-label="Закрыть" className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Left: QR list */}
            <div className="md:w-48 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 p-4 shrink-0">
              <div className="space-y-1.5">
                {qrCodes.map(qr => (
                  <div
                    key={qr.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                      selectedId === qr.id ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => selectQr(qr)}
                  >
                    <span className="truncate">{qr.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(qr.id); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 shrink-0 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {qrCodes.length < maxQrCodes && (
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Создать
                </button>
              )}
              {qrCodes.length >= maxQrCodes && plan === 'FREE' && (
                <p className="mt-3 text-xs text-gray-400 text-center">
                  На PRO — до 30 QR
                </p>
              )}
            </div>

            {/* Right: Editor */}
            {selectedId ? (
              <div className="flex-1 p-5 space-y-5">
                {/* Preview */}
                <div className="flex justify-center">
                  <div ref={qrRef} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 inline-block" />
                </div>

                <p className="text-xs text-gray-400 text-center break-all">{buildUrl()}</p>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Название</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Цвет точек</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={e => setFgColor(e.target.value)}
                        className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={fgColor}
                        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setFgColor(e.target.value); }}
                        maxLength={7}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Цвет фона</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={e => setBgColor(e.target.value)}
                        className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer p-0"
                      />
                      <input
                        type="text"
                        value={bgColor}
                        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }}
                        maxLength={7}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Dot style */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Форма точек</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DOT_STYLES.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDotStyle(opt.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          dotStyle === opt.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corner styles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Угловые квадраты</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CORNER_SQUARE_STYLES.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setCornerSquareStyle(opt.value)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            cornerSquareStyle === opt.value
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Угловые точки</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CORNER_DOT_STYLES.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setCornerDotStyle(opt.value)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            cornerDotStyle === opt.value
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* UTM */}
                <div>
                  <button
                    onClick={() => setUtmOpen(!utmOpen)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    {utmOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    UTM-метки
                  </button>
                  {utmOpen && (
                    <div className="mt-2 space-y-2">
                      {[
                        { label: 'utm_source', value: utmSource, set: setUtmSource, placeholder: 'qr_code' },
                        { label: 'utm_medium', value: utmMedium, set: setUtmMedium, placeholder: 'offline' },
                        { label: 'utm_campaign', value: utmCampaign, set: setUtmCampaign, placeholder: 'flyer_march' },
                        { label: 'utm_content', value: utmContent, set: setUtmContent, placeholder: 'header_banner' },
                        { label: 'utm_term', value: utmTerm, set: setUtmTerm, placeholder: '' },
                      ].map(field => (
                        <div key={field.label} className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 font-mono">{field.label}</label>
                          <input
                            type="text"
                            value={field.value}
                            onChange={e => field.set(e.target.value)}
                            placeholder={field.placeholder}
                            maxLength={200}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => handleDownload('png')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PNG
                  </button>
                  <button
                    onClick={() => handleDownload('svg')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    SVG
                  </button>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-10">
                <div className="text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-400 mb-3">Нет QR-кодов</p>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                  >
                    Создать первый QR-код
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        title="Удалить QR-код"
        message="Вы уверены, что хотите удалить этот QR-код?"
        confirmLabel="Удалить"
        variant="danger"
      />
    </div>
  );
}
