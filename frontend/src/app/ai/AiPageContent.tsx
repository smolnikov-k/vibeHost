'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap, Copy, Check, Sparkles, Globe, Code2, MessageSquare,
  ClipboardCopy, ArrowRight, Bot,
} from 'lucide-react';
import { useScrollReveal, useStaggerReveal } from '@/lib/useAnimate';
import { AI_PROMPT } from '@/lib/ai-prompt';

const steps = [
  {
    icon: ClipboardCopy,
    title: 'Скопируйте промпт',
    description: 'Нажмите кнопку ниже — готовая инструкция скопируется в буфер обмена.',
    color: 'from-emerald-400 to-emerald-500',
  },
  {
    icon: MessageSquare,
    title: 'Отправьте AI',
    description: 'Вставьте промпт в чат с нейросетью и опишите, какой сайт вам нужен.',
    color: 'from-green-400 to-green-500',
  },
  {
    icon: Code2,
    title: 'AI создаст сайт',
    description: 'Нейросеть напишет HTML, CSS и JavaScript по вашему запросу.',
    color: 'from-emerald-500 to-green-500',
  },
  {
    icon: Globe,
    title: 'AI опубликует',
    description: 'Если у AI есть терминал — он сам задеплоит сайт через API.',
    color: 'from-green-500 to-emerald-600',
  },
];

const aiTools = [
  { name: 'Claude Code', icon: '🟠' },
  { name: 'Cursor', icon: '⚡' },
  { name: 'ChatGPT', icon: '🤖' },
  { name: 'Windsurf', icon: '🌊' },
  { name: 'Cline', icon: '🔧' },
];

export function AiPageContent() {
  const [copied, setCopied] = useState(false);

  const heroRef = useScrollReveal();
  const toolsRef = useStaggerReveal();
  const stepsRef = useStaggerReveal();
  const promptRef = useScrollReveal({ delay: 100 });
  const ctaRef = useScrollReveal({ delay: 200 });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = AI_PROMPT;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-xs text-gray-400 hover:text-emerald-500 transition-colors">
              Документация
            </Link>
            <Link
              href="https://hostingvibe.ru/login"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        {/* Hero */}
        <section ref={heroRef} className="py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI + Хостинг
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-5 leading-tight">
            Отправь это своей{' '}
            <span className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">
              нейросети
            </span>
          </h1>

          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Скопируйте готовый промпт и вставьте в чат с AI-ассистентом.
            Нейросеть сама создаст сайт и опубликует его на VibeHosting — без ручной работы.
          </p>

          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 ${
              copied
                ? 'bg-green-500 shadow-green-500/25 scale-105'
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Скопировано!' : 'Скопировать промпт'}
          </button>
        </section>

        {/* Supported AI tools */}
        <section className="pb-16">
          <p className="text-center text-sm text-gray-400 mb-4">Работает с любым AI-ассистентом</p>
          <div ref={toolsRef} className="flex flex-wrap justify-center gap-3">
            {aiTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 text-sm text-gray-700 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <span className="text-base">{tool.icon}</span>
                {tool.name}
              </div>
            ))}
          </div>
        </section>

        {/* How it works — 4 steps */}
        <section className="pb-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-4">
            Как это работает
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Четыре шага — и сайт готов
          </p>

          <div ref={stepsRef} className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-md">
                  {i + 1}
                </div>

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-base font-bold text-gray-900 mb-1.5">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>

                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 border-t-2 border-dashed border-emerald-200" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Prompt block */}
        <section ref={promptRef} className="pb-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-7 h-7 text-emerald-500" />
              Готовый промпт
            </h2>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                copied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Скопировано!' : 'Скопировать'}
            </button>
          </div>

          <div className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-gray-950/50">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-gray-500 font-mono">ai-prompt.md</span>
            </div>
            <pre className="p-5 md:p-6 font-mono text-sm text-gray-100 leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto">
              {AI_PROMPT}
            </pre>
          </div>
        </section>

        {/* What to do after */}
        <section className="pb-20">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-5">Что делать дальше?</h3>
            <div className="space-y-4">
              {[
                { n: '1', text: 'Скопируйте промпт кнопкой выше' },
                { n: '2', text: 'Откройте чат с AI (Claude Code, Cursor, ChatGPT) и вставьте промпт' },
                { n: '3', text: 'Напишите, какой сайт нужен — например: «Сделай лендинг для кофейни в Москве»' },
              ].map((item) => (
                <div key={item.n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.n}
                  </div>
                  <p className="text-gray-700">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-sm text-emerald-800">
                <strong>Совет:</strong> AI с доступом к терминалу (Claude Code, Cursor) может сам зарегистрироваться
                на VibeHosting и задеплоить сайт. В обычном чате (ChatGPT, YandexGPT) AI подготовит файлы,
                а вы загрузите их через{' '}
                <Link href="/register" className="underline font-medium">дашборд</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section ref={ctaRef} className="pb-20">
          <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl p-8 md:p-12 text-center text-white shadow-xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ещё нет аккаунта?</h2>
            <p className="text-emerald-100 mb-6 max-w-lg mx-auto">
              Зарегистрируйтесь бесплатно — и ваш AI-ассистент сможет опубликовать сайт через API.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-colors shadow-md"
              >
                Начать бесплатно
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 text-emerald-100 hover:text-white rounded-xl font-medium transition-colors"
              >
                Документация
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} VibeHosting</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-emerald-500 transition-colors">Документация</Link>
            <Link href="/llms.txt" className="hover:text-emerald-500 transition-colors">llms.txt</Link>
            <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Конфиденциальность</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
