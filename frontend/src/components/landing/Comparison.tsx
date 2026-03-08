'use client';

import { useScrollReveal } from '@/lib/useAnimate';
import { Check, X, Minus } from 'lucide-react';

const rows = [
  { feature: 'Бесплатный тариф', vibe: true, tilda: false, wordpress: true, tiiny: true },
  { feature: 'Публикация за 30 сек', vibe: true, tilda: false, wordpress: false, tiiny: true },
  { feature: 'Свой домен + SSL', vibe: true, tilda: true, wordpress: true, tiiny: true },
  { feature: 'Визуальный редактор', vibe: true, tilda: true, wordpress: true, tiiny: false },
  { feature: 'React / Vue / Vite', vibe: true, tilda: false, wordpress: false, tiiny: false },
  { feature: 'Формы → Telegram', vibe: true, tilda: false, wordpress: false, tiiny: false },
  { feature: 'Серверы в России', vibe: true, tilda: true, wordpress: false, tiiny: false },
  { feature: 'Оплата в рублях', vibe: true, tilda: true, wordpress: false, tiiny: false },
  { feature: 'Без кода', vibe: true, tilda: true, wordpress: false, tiiny: true },
  { feature: 'Аналитика', vibe: true, tilda: true, wordpress: true, tiiny: 'partial' },
  { feature: 'Яндекс.Метрика + цели', vibe: true, tilda: 'partial', wordpress: false, tiiny: false },
];

function CellIcon({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500" />;
  if (value === 'partial') return <Minus className="w-4 h-4 text-amber-400" />;
  return <X className="w-4 h-4 text-gray-300" />;
}

export function Comparison() {
  const ref = useScrollReveal();

  return (
    <section className="py-24 bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Сравните сами
        </h2>
        <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
          VibeHosting vs популярные платформы
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 sm:py-4 px-3 sm:px-5 font-medium text-gray-500 text-xs sm:text-sm">Функция</th>
                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center">
                    <span className="font-bold text-emerald-600 text-xs sm:text-sm">VibeHosting</span>
                  </th>
                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center font-medium text-gray-500 text-xs sm:text-sm">Tilda</th>
                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center font-medium text-gray-500 text-xs sm:text-sm">WordPress</th>
                  <th className="py-3 sm:py-4 px-2 sm:px-3 text-center font-medium text-gray-500 text-xs sm:text-sm">tiiny.host</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 sm:py-3.5 px-3 sm:px-5 text-gray-700 text-xs sm:text-sm">{row.feature}</td>
                    <td className="py-3 sm:py-3.5 px-2 sm:px-3 text-center"><div className="flex justify-center"><CellIcon value={row.vibe} /></div></td>
                    <td className="py-3 sm:py-3.5 px-2 sm:px-3 text-center"><div className="flex justify-center"><CellIcon value={row.tilda} /></div></td>
                    <td className="py-3 sm:py-3.5 px-2 sm:px-3 text-center"><div className="flex justify-center"><CellIcon value={row.wordpress} /></div></td>
                    <td className="py-3 sm:py-3.5 px-2 sm:px-3 text-center"><div className="flex justify-center"><CellIcon value={row.tiiny} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
