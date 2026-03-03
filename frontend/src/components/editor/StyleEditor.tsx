'use client';

import { useCallback } from 'react';
import { Type, Palette, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';

interface StyleEditorProps {
  styles: Record<string, string>;
  onChange: (styles: Record<string, string>) => void;
}

const FONT_WEIGHTS = [
  { value: '400', label: 'Обычный' },
  { value: '500', label: 'Средний' },
  { value: '600', label: 'Полужирный' },
  { value: '700', label: 'Жирный' },
  { value: '800', label: 'Сверхжирный' },
];

export default function StyleEditor({ styles, onChange }: StyleEditorProps) {
  const update = useCallback((prop: string, value: string) => {
    onChange({ ...styles, [prop]: value });
  }, [styles, onChange]);

  const remove = useCallback((prop: string) => {
    const next = { ...styles };
    delete next[prop];
    onChange(next);
  }, [styles, onChange]);

  return (
    <div className="space-y-4">
      {/* Типографика */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase mb-2">
          <Type className="w-3 h-3" />
          Типографика
        </div>
        <div className="space-y-2">
          {/* Color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Цвет</label>
            <input
              type="color"
              value={styles.color || '#000000'}
              onChange={(e) => update('color', e.target.value)}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0"
            />
            {styles.color && (
              <button onClick={() => remove('color')} className="text-xs text-gray-400 hover:text-red-500">✕</button>
            )}
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Размер</label>
            <input
              type="range"
              min={10}
              max={72}
              value={parseInt(styles.fontSize || '16')}
              onChange={(e) => update('fontSize', e.target.value + 'px')}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{styles.fontSize || '16px'}</span>
          </div>

          {/* Font Weight */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0 flex items-center gap-1">
              <Bold className="w-3 h-3" />Жирность
            </label>
            <select
              value={styles.fontWeight || '400'}
              onChange={(e) => update('fontWeight', e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {FONT_WEIGHTS.map(fw => (
                <option key={fw.value} value={fw.value}>{fw.label}</option>
              ))}
            </select>
          </div>

          {/* Text Align */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Выравн.</label>
            <div className="flex gap-1">
              {[
                { value: 'left', icon: AlignLeft },
                { value: 'center', icon: AlignCenter },
                { value: 'right', icon: AlignRight },
              ].map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => update('textAlign', value)}
                  className={`p-1.5 rounded ${
                    styles.textAlign === value
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Оформление */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase mb-2">
          <Palette className="w-3 h-3" />
          Оформление
        </div>
        <div className="space-y-2">
          {/* Background Color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Фон</label>
            <input
              type="color"
              value={styles.backgroundColor || '#ffffff'}
              onChange={(e) => update('backgroundColor', e.target.value)}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0"
            />
            {styles.backgroundColor && (
              <button onClick={() => remove('backgroundColor')} className="text-xs text-gray-400 hover:text-red-500">✕</button>
            )}
          </div>

          {/* Border Radius */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Скругл.</label>
            <input
              type="range"
              min={0}
              max={50}
              value={parseInt(styles.borderRadius || '0')}
              onChange={(e) => update('borderRadius', e.target.value + 'px')}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{styles.borderRadius || '0px'}</span>
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Прозрач.</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(parseFloat(styles.opacity || '1') * 100)}
              onChange={(e) => update('opacity', String(parseInt(e.target.value) / 100))}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{Math.round(parseFloat(styles.opacity || '1') * 100)}%</span>
          </div>

          {/* Padding */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Отступ вн.</label>
            <input
              type="text"
              value={styles.padding || ''}
              onChange={(e) => update('padding', e.target.value)}
              placeholder="10px"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
            />
          </div>

          {/* Margin */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-20 shrink-0">Отступ вн.</label>
            <input
              type="text"
              value={styles.margin || ''}
              onChange={(e) => update('margin', e.target.value)}
              placeholder="10px"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
