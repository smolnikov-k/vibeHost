'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, VisualPatch } from '@/lib/api';
import StyleEditor from './StyleEditor';
import {
  ArrowLeft, ExternalLink, Save, ChevronDown, Loader2,
  Type, Image, EyeOff, Paintbrush, Trash2, ToggleLeft, ToggleRight,
  MousePointerClick, Undo2, Redo2, Upload, FileImage, PanelRight, X,
} from 'lucide-react';

interface VibeEditorProps {
  projectId: string;
  projectSlug: string;
  customDomain?: string | null;
  onBack: () => void;
}

interface SelectedElement {
  selector: string;
  tag: string;
  elementType: 'text' | 'image' | 'media';
  text: string;
  src: string;
  computedStyles?: Record<string, string>;
}

type PatchTab = 'text' | 'image' | 'hide' | 'style';

function rgbToHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const normalized = color.trim().toLowerCase();
  if (normalized.startsWith('#')) return normalized;

  const match = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!match) return undefined;

  const toHex = (value: string) => Number(value).toString(16).padStart(2, '0');
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function normalizeComputedStyles(styles?: Record<string, string>): Record<string, string> {
  if (!styles) return {};

  const next = { ...styles };
  if (styles.color) {
    next.color = rgbToHex(styles.color) || styles.color;
  }
  if (styles.backgroundColor) {
    next.backgroundColor = rgbToHex(styles.backgroundColor) || styles.backgroundColor;
  }

  return next;
}

export default function VibeEditor({ projectId, projectSlug, customDomain, onBack }: VibeEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State
  const [pages, setPages] = useState<{ path: string; size: number }[]>([]);
  const [currentPath, setCurrentPath] = useState('index.html');
  const [patches, setPatches] = useState<VisualPatch[]>([]);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [activeTab, setActiveTab] = useState<PatchTab>('text');
  const [bridgeReady, setBridgeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPageSelect, setShowPageSelect] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const skipResetOnNextDeselectRef = useRef(false);

  // Redo stack
  const [redoStack, setRedoStack] = useState<VisualPatch[]>([]);

  // Style cache: selector -> original computed styles
  const stylesCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  // Edit fields
  const [editText, setEditText] = useState('');
  const [editSrc, setEditSrc] = useState('');
  const [editStyles, setEditStyles] = useState<Record<string, string>>({});

  // Load pages and patches
  useEffect(() => {
    async function load() {
      try {
        const [pagesRes, patchesRes] = await Promise.all([
          api.getEditPages(projectId),
          api.getEditPatches(projectId),
        ]);
        setPages(pagesRes.pages);
        setPatches(patchesRes.patches);
      } catch (err) {
        console.error('Failed to load editor data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Listen for bridge messages
  const expectedOrigin = `https://${projectSlug}.hostingvibe.ru`;
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Only accept messages from the preview subdomain
      if (e.origin !== expectedOrigin) return;
      const data = e.data;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'vibe-bridge:ready') {
        setBridgeReady(true);
      }

      if (data.type === 'vibe-bridge:select') {
        const selector = data.selector as string;
        // Cache computed styles on first selection
        if (data.computedStyles && !stylesCacheRef.current.has(selector)) {
          stylesCacheRef.current.set(selector, data.computedStyles);
        }
        const cachedStyles = stylesCacheRef.current.get(selector) || data.computedStyles;

        setSelected({
          selector,
          tag: data.tag,
          elementType: data.elementType,
          text: data.text || '',
          src: data.src || '',
          computedStyles: cachedStyles,
        });
        // Set appropriate tab based on element type
        if (data.elementType === 'image') {
          setActiveTab('image');
          setEditSrc(data.src || '');
        } else {
          setActiveTab('text');
          setEditText(data.text || '');
        }
        if (cachedStyles) {
          setEditStyles(normalizeComputedStyles(cachedStyles));
        }
        setSidebarOpen(true);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Init bridge when iframe loads
  const handleIframeLoad = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'vibe-bridge:init' }, expectedOrigin);
    }
  }, [expectedOrigin]);

  // Send preview to iframe
  const sendPreview = useCallback((selector: string, patchType: PatchTab, content: string) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 'vibe-bridge:preview',
      selector,
      patchType,
      content,
    }, expectedOrigin);
  }, [expectedOrigin]);

  // Deselect element
  const deselect = useCallback(() => {
    const shouldReset = !skipResetOnNextDeselectRef.current;
    skipResetOnNextDeselectRef.current = false;

    if (shouldReset && selected && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'vibe-bridge:reset',
        selector: selected.selector,
      }, expectedOrigin);
    }
    setSelected(null);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'vibe-bridge:deselect' }, expectedOrigin);
    }
  }, [expectedOrigin, selected]);

  // Save patch
  const savePatch = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      let content = '';
      if (activeTab === 'text') content = editText;
      else if (activeTab === 'image') content = editSrc;
      else if (activeTab === 'style') content = JSON.stringify(editStyles);

      const { patch } = await api.createEditPatch(projectId, {
        selector: selected.selector,
        type: activeTab,
        content: activeTab === 'hide' ? undefined : content,
      });

      setPatches(prev => [...prev, patch]);
      setRedoStack([]); // Clear redo stack on new action
      skipResetOnNextDeselectRef.current = true;
      deselect();
    } catch (err) {
      console.error('Failed to save patch', err);
    } finally {
      setSaving(false);
    }
  }, [selected, activeTab, editText, editSrc, editStyles, projectId, deselect]);

  // Toggle patch enabled/disabled
  const togglePatch = useCallback(async (patch: VisualPatch) => {
    try {
      const { patch: updated } = await api.updateEditPatch(projectId, patch.id, {
        enabled: !patch.enabled,
      });
      setPatches(prev => prev.map(p => p.id === updated.id ? updated : p));
      // Reload iframe to reflect changes
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.location.reload();
      }
    } catch (err) {
      console.error('Failed to toggle patch', err);
    }
  }, [projectId]);

  // Delete patch
  const deletePatch = useCallback(async (patchId: string) => {
    try {
      await api.deleteEditPatch(projectId, patchId);
      setPatches(prev => prev.filter(p => p.id !== patchId));
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete patch', err);
    }
  }, [projectId]);

  // Undo: move last patch to redo stack
  const undoPatch = useCallback(async () => {
    if (patches.length === 0) return;
    const last = patches[patches.length - 1];
    try {
      await api.deleteEditPatch(projectId, last.id);
      setPatches(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, last]);
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.location.reload();
      }
    } catch (err) {
      console.error('Failed to undo patch', err);
    }
  }, [patches, projectId]);

  // Redo: re-create patch from redo stack
  const redoPatch = useCallback(async () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    try {
      const { patch } = await api.createEditPatch(projectId, {
        selector: last.selector,
        type: last.type as PatchTab,
        content: last.type === 'hide' ? undefined : (last.content ?? undefined),
      });
      setRedoStack(prev => prev.slice(0, -1));
      setPatches(prev => [...prev, patch]);
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.location.reload();
      }
    } catch (err) {
      console.error('Failed to redo patch', err);
    }
  }, [redoStack, projectId]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Cmd+Shift+Z = redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.metaKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redoPatch();
        return;
      }
      // Undo: Ctrl+Z or Cmd+Z (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoPatch();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoPatch, redoPatch]);

  // Upload image asset
  const handleAssetUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAsset(true);
    try {
      const result = await api.uploadEditAsset(projectId, file);
      setEditSrc(result.src);
      if (selected) {
        sendPreview(selected.selector, 'image', result.src);
      }
    } catch (err) {
      console.error('Failed to upload asset', err);
    } finally {
      setUploadingAsset(false);
    }
  }, [projectId, selected, sendPreview]);

  // Switch page
  const switchPage = useCallback((pagePath: string) => {
    if (selected && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'vibe-bridge:reset',
        selector: selected.selector,
      }, expectedOrigin);
    }
    setCurrentPath(pagePath);
    setShowPageSelect(false);
    setSelected(null);
    setBridgeReady(false);
  }, [expectedOrigin, selected]);

  // Live preview on edit
  useEffect(() => {
    if (!selected || !bridgeReady) return;
    if (activeTab === 'text') {
      sendPreview(selected.selector, 'text', editText);
    } else if (activeTab === 'image') {
      sendPreview(selected.selector, 'image', editSrc);
    } else if (activeTab === 'style') {
      sendPreview(selected.selector, 'style', JSON.stringify(editStyles));
    }
  }, [editText, editSrc, editStyles, activeTab, selected, bridgeReady, sendPreview]);

  const previewUrl = api.getEditPreviewUrl(projectId, currentPath, projectSlug);

  const patchTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'Текст';
      case 'image': return 'Картинка';
      case 'hide': return 'Скрыт';
      case 'style': return 'Стиль';
      default: return type;
    }
  };

  const patchTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="w-3 h-3" />;
      case 'image': return <Image className="w-3 h-3" />;
      case 'hide': return <EyeOff className="w-3 h-3" />;
      case 'style': return <Paintbrush className="w-3 h-3" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>

          {/* Page selector */}
          {pages.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowPageSelect(!showPageSelect)}
                className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                {currentPath}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showPageSelect && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-48">
                  {pages.map(page => (
                    <button
                      key={page.path}
                      onClick={() => switchPage(page.path)}
                      className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950 ${
                        page.path === currentPath ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {page.path}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://${customDomain || `${projectSlug}.hostingvibe.ru`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            Открыть сайт
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            aria-label="Панель редактирования"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main area: iframe + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* iframe preview */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 relative">
          <iframe
            ref={iframeRef}
            key={currentPath}
            src={previewUrl}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
          {!bridgeReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Right panel */}
        <div className={`fixed md:static inset-y-0 right-0 z-40 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}>
          {/* Mobile close button */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Редактор</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Закрыть панель">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!selected ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-400 dark:text-gray-400">
              <MousePointerClick className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Кликните на элемент</p>
              <p className="text-xs mt-1">Выберите текст, картинку или блок на сайте для редактирования</p>
              {patches.length > 0 && (
                <div className="text-xs text-emerald-600 mt-4">
                  {patches.length} {patches.length === 1 ? 'изменение' : patches.length < 5 ? 'изменения' : 'изменений'} применено
                </div>
              )}
            </div>
          ) : (
            /* Selected element editor */
            <div className="flex flex-col">
              {/* Selected element info */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Выбранный элемент</div>
                    <div className="text-xs text-emerald-600 font-mono mt-0.5 break-all">
                      &lt;{selected.tag}&gt;
                    </div>
                  </div>
                  <button
                    onClick={deselect}
                    aria-label="Снять выделение"
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-1 break-all leading-tight">
                  {selected.selector.length > 60 ? selected.selector.slice(0, 60) + '...' : selected.selector}
                </div>
              </div>

              {/* Type tabs */}
              <div className="flex border-b border-gray-100 dark:border-gray-700">
                {(['text', 'image', 'hide', 'style'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      if (selected && activeTab === 'hide' && tab !== 'hide' && iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage({
                          type: 'vibe-bridge:reset',
                          selector: selected.selector,
                        }, expectedOrigin);
                      }
                      setActiveTab(tab);
                      if (tab === 'hide' && selected) {
                        sendPreview(selected.selector, 'hide', '');
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                      activeTab === tab
                        ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                        : 'text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab === 'text' && <Type className="w-3 h-3" />}
                    {tab === 'image' && <Image className="w-3 h-3" />}
                    {tab === 'hide' && <EyeOff className="w-3 h-3" />}
                    {tab === 'style' && <Paintbrush className="w-3 h-3" />}
                    {patchTypeLabel(tab)}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-4 py-3 flex-1">
                {activeTab === 'text' && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5">Новый текст</label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y"
                      placeholder="Введите новый текст..."
                    />
                    <p className="text-[10px] text-gray-400 mt-1">HTML-теги сохраняются: &lt;b&gt;, &lt;a&gt;, &lt;span&gt;</p>
                  </div>
                )}

                {activeTab === 'image' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1.5">URL картинки</label>
                      <input
                        type="text"
                        value={editSrc}
                        onChange={(e) => setEditSrc(e.target.value)}
                        className="w-full text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400">или</span>
                    </div>
                    <label className={`flex items-center justify-center gap-2 w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm cursor-pointer hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
                      uploadingAsset ? 'opacity-50 pointer-events-none' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {uploadingAsset ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Загрузить файл
                      <input type="file" accept="image/*" onChange={handleAssetUpload} className="hidden" />
                    </label>
                    {editSrc && (
                      <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-2">
                        <img
                          src={editSrc}
                          alt="preview"
                          className="w-full h-24 object-contain rounded"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'hide' && (
                  <div className="text-center py-4">
                    <EyeOff className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Скрыть элемент</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Элемент будет скрыт на вашем сайте. Можно отменить в любой момент.
                    </p>
                  </div>
                )}

                {activeTab === 'style' && (
                  <StyleEditor
                    styles={editStyles}
                    onChange={setEditStyles}
                  />
                )}
              </div>

              {/* Save button */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={savePatch}
                  disabled={saving || (activeTab === 'text' && !editText) || (activeTab === 'image' && !editSrc) || (activeTab === 'style' && Object.keys(editStyles).length === 0)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить изменение
                </button>
              </div>
            </div>
          )}

          {/* Patches list */}
          {patches.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Изменения ({patches.length})
                </span>
                <div className="flex items-center gap-1">
                  {patches.length > 0 && (
                    <button
                      onClick={undoPatch}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                      title="Отменить последнее (Ctrl+Z)"
                    >
                      <Undo2 className="w-3 h-3" />
                    </button>
                  )}
                  {redoStack.length > 0 && (
                    <button
                      onClick={redoPatch}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-500 transition-colors"
                      title="Повторить (Ctrl+Y)"
                    >
                      <Redo2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {patches.map(patch => (
                  <div
                    key={patch.id}
                    className={`px-4 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 group ${
                      !patch.enabled ? 'opacity-50' : ''
                    }`}
                    onMouseEnter={() => {
                      if (iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage({
                          type: 'vibe-bridge:highlight',
                          selector: patch.selector,
                        }, expectedOrigin);
                      }
                    }}
                  >
                    <span className="text-gray-400">{patchTypeIcon(patch.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                        {patch.type === 'hide'
                          ? 'Скрыт'
                          : patch.type === 'style'
                            ? 'Стили'
                            : (patch.content || '').slice(0, 40)
                        }
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">{patch.selector}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePatch(patch)}
                        className="text-gray-400 hover:text-emerald-500"
                        title={patch.enabled ? 'Выключить' : 'Включить'}
                        aria-label={patch.enabled ? 'Выключить патч' : 'Включить патч'}
                        role="switch"
                        aria-checked={patch.enabled}
                      >
                        {patch.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deletePatch(patch.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Удалить"
                        aria-label="Удалить патч"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
