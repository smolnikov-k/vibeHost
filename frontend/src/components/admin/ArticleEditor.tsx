'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Eye, EyeOff, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, Columns } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';

interface ArticleData {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string[];
  metaTitle: string;
  metaDesc: string;
  ogImage: string;
  status?: string;
}

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  initial?: Partial<ArticleData>;
}

type ViewMode = 'split' | 'editor' | 'preview';

export default function ArticleEditor({ mode, initial }: ArticleEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [uploading, setUploading] = useState(false);

  const [data, setData] = useState<ArticleData>({
    title: initial?.title || '',
    slug: initial?.slug || '',
    excerpt: initial?.excerpt || '',
    content: initial?.content || '',
    coverImage: initial?.coverImage || '',
    tags: initial?.tags || [],
    metaTitle: initial?.metaTitle || '',
    metaDesc: initial?.metaDesc || '',
    ogImage: initial?.ogImage || '',
    status: initial?.status,
  });

  const [tagsInput, setTagsInput] = useState((initial?.tags || []).join(', '));

  const slugify = (text: string) =>
    text.toLowerCase()
      .replace(/[а-яё]/g, (ch) => {
        const map: Record<string, string> = {
          'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
          'ж':'zh','з':'z','и':'i','й':'j','к':'k','л':'l','м':'m',
          'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
          'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
          'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
        };
        return map[ch] ?? ch;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);

  const handleTitleChange = (title: string) => {
    setData(prev => ({
      ...prev,
      title,
      slug: mode === 'create' || !initial?.slug ? slugify(title) : prev.slug,
    }));
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    setData(prev => ({
      ...prev,
      tags: value.split(',').map(t => t.trim()).filter(Boolean),
    }));
  };

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await api.uploadBlogImage(file);
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const before = data.content.slice(0, start);
          const after = data.content.slice(textarea.selectionEnd);
          const insertion = `![${file.name}](${result.url})`;
          setData(prev => ({ ...prev, content: before + insertion + after }));
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
            textarea.focus();
          }, 0);
        }
      } catch { /* */ }
      setUploading(false);
    };
    input.click();
  };

  const handleCoverUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await api.uploadBlogImage(file);
        setData(prev => ({ ...prev, coverImage: result.url }));
      } catch { /* */ }
      setUploading(false);
    };
    input.click();
  };

  const handleSave = async (publish?: boolean) => {
    if (!data.title || !data.content) {
      alert('Заголовок и содержание обязательны');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt || undefined,
        coverImage: data.coverImage || undefined,
        tags: data.tags,
        metaTitle: data.metaTitle || undefined,
        metaDesc: data.metaDesc || undefined,
        ogImage: data.ogImage || undefined,
      };

      let articleId = initial?.id;

      if (mode === 'create') {
        const result = await api.createAdminArticle(payload);
        articleId = result.id;
      } else if (articleId) {
        await api.updateAdminArticle(articleId, payload);
      }

      if (publish && articleId) {
        await api.publishAdminArticle(articleId);
      }

      router.push('/admin/blog');
    } catch { /* */ }
    setSaving(false);
  };

  const handleUnpublish = async () => {
    if (!initial?.id) return;
    setSaving(true);
    try {
      await api.unpublishAdminArticle(initial.id);
      router.push('/admin/blog');
    } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Fields */}
      <div className="space-y-3 mb-4 shrink-0">
        <input
          type="text"
          value={data.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Заголовок статьи"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-lg font-bold focus:border-emerald-500 outline-none"
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Slug</label>
            <input
              type="text"
              value={data.slug}
              onChange={(e) => setData(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-mono focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Теги (через запятую)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="nextjs, react, hosting"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
        <textarea
          value={data.excerpt}
          onChange={(e) => setData(prev => ({ ...prev, excerpt: e.target.value }))}
          placeholder="Краткое описание (excerpt)..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none resize-none"
        />
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Обложка</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={data.coverImage}
                onChange={(e) => setData(prev => ({ ...prev, coverImage: e.target.value }))}
                placeholder="URL изображения"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
              />
              <button
                onClick={handleCoverUpload}
                disabled={uploading}
                className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Загрузить
              </button>
            </div>
          </div>
        </div>

        {/* SEO */}
        <button
          onClick={() => setSeoOpen(!seoOpen)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          {seoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          SEO-настройки
        </button>
        {seoOpen && (
          <div className="space-y-3 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meta Title</label>
              <input
                type="text"
                value={data.metaTitle}
                onChange={(e) => setData(prev => ({ ...prev, metaTitle: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meta Description</label>
              <textarea
                value={data.metaDesc}
                onChange={(e) => setData(prev => ({ ...prev, metaDesc: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">OG Image URL</label>
              <input
                type="text"
                value={data.ogImage}
                onChange={(e) => setData(prev => ({ ...prev, ogImage: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleImageUpload}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 text-xs hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {uploading ? 'Загрузка...' : 'Изображение'}
          </button>
        </div>
        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('editor')}
            className={`px-2 py-1 rounded-md text-xs transition-colors ${viewMode === 'editor' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            Редактор
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 rounded-md text-xs transition-colors ${viewMode === 'split' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <Columns className="w-3.5 h-3.5 inline" /> Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-2 py-1 rounded-md text-xs transition-colors ${viewMode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            Превью
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 min-h-0 flex gap-3">
        {viewMode !== 'preview' && (
          <div className={viewMode === 'split' ? 'w-1/2' : 'w-full'}>
            <textarea
              ref={textareaRef}
              value={data.content}
              onChange={(e) => setData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Markdown-содержание статьи..."
              className="w-full h-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 text-sm font-mono focus:border-emerald-500 outline-none resize-none"
            />
          </div>
        )}
        {viewMode !== 'editor' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto rounded-lg bg-gray-900 border border-gray-700 px-6 py-4`}>
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-a:text-emerald-400 prose-code:text-emerald-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.content || '*Начните писать...*'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700 mt-4 shrink-0">
        <button
          onClick={() => router.push('/admin/blog')}
          className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          Отмена
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить черновик
          </button>
          {(!data.status || data.status === 'DRAFT') && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Опубликовать
            </button>
          )}
          {data.status === 'PUBLISHED' && (
            <button
              onClick={handleUnpublish}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="w-4 h-4" />
              Снять с публикации
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
