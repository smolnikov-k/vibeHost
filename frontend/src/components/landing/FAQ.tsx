'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { animate } from 'animejs';
import { useScrollReveal } from '@/lib/useAnimate';

const faqs = [
  {
    q: 'Мне нужно что-то устанавливать?',
    a: 'Нет. Просто перетащите файлы вашего сайта в браузер — и он сразу появится в интернете. Никаких программ, терминалов или технических знаний.',
  },
  {
    q: 'Какие файлы можно загружать?',
    a: 'ZIP/TAR.GZ-архив с сайтом или ссылку на GitHub. Поддерживаем HTML, CSS, JS, React, Vue, Vite, Next.js, Svelte, Astro — всё, что можно собрать в статику.',
  },
  {
    q: 'Это правда бесплатно?',
    a: 'Да. Бесплатный тариф — 1 сайт до 50 МБ без привязки карты. Если проект долго не обновляется, он может быть приостановлен по правилам тарифа; перед этим отправляем напоминания.',
  },
  {
    q: 'Как подключить свой домен?',
    a: 'На тарифе PRO добавьте A-запись, указывающую на наш сервер. SSL-сертификат выпустится автоматически за несколько минут.',
  },
  {
    q: 'Как оплатить подписку?',
    a: 'Оплата через Prodamus — принимаем российские банковские карты (Visa, Mastercard, МИР). Автоматическое продление каждый месяц.',
  },
  {
    q: 'Мои данные в безопасности?',
    a: 'Серверы находятся в России. Мы соблюдаем 152-ФЗ о персональных данных. Все сайты работают через HTTPS с бесплатным SSL-сертификатом.',
  },
  {
    q: 'Что такое визуальный редактор?',
    a: 'Кликните на любой элемент своего сайта — измените текст, картинку или CSS-стиль прямо в браузере. Знать код не обязательно.',
  },
  {
    q: 'Что такое формы → Telegram?',
    a: 'Добавьте на сайт обычную HTML-форму. Когда посетитель отправит заявку, она мгновенно придёт вам в Telegram. Подключение занимает 2 минуты.',
  },
  {
    q: 'Можно скачать сайт обратно?',
    a: 'Конечно. В любой момент скачайте ZIP-архив со всеми файлами вашего сайта из панели управления.',
  },
  {
    q: 'Что будет если отменить подписку?',
    a: 'Аккаунт переключится на бесплатный тариф. Лишние сайты могут быть приостановлены, а возобновить подписку можно в любой момент в пару кликов.',
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [a]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && contentRef.current) {
        animate(contentRef.current, {
          opacity: [0, 1],
          duration: 300,
          ease: 'outExpo',
        });
      }
      return next;
    });
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={toggle}
        className="w-full py-5 flex items-center justify-between text-left group"
        aria-expanded={open}
        aria-controls={`faq-${index}`}
      >
        <span className="text-base font-medium text-gray-900 group-hover:text-emerald-600 transition-colors pr-4">
          {q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        id={`faq-${index}`}
        style={{ maxHeight: open ? height : 0 }}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      >
        <div ref={contentRef} className="pb-5 text-sm text-gray-500 leading-relaxed">
          {a}
        </div>
      </div>
    </div>
  );
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export function FAQ() {
  const sectionRef = useScrollReveal();

  return (
    <section id="faq" className="py-24 bg-gray-50/50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-2xl mx-auto px-6" ref={sectionRef}>
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Частые вопросы
        </h2>
        <p className="text-gray-500 text-center mb-12">
          Не нашли ответ? Напишите нам в Telegram
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6">
          {faqs.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
