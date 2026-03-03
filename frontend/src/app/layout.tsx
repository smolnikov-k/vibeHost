import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hostingvibe.ru'),
  title: {
    default: 'VibeHosting — Твой сайт в интернете за 5 минут',
    template: '%s | VibeHosting',
  },
  description: 'Перетащи файлы — получи ссылку. Твой сайт в интернете за 5 минут. Бесплатно. Без программиста. Без настроек.',
  keywords: ['хостинг', 'запустить сайт', 'бесплатный хостинг', 'сайт за 5 минут', 'опубликовать сайт', 'хостинг для лендинга', 'простой хостинг', 'загрузить сайт'],
  authors: [{ name: 'VibeHosting' }],
  openGraph: {
    title: 'VibeHosting — Сайт в интернете за 5 минут',
    description: 'Перетащи файлы — получи ссылку. Бесплатно. Без программиста.',
    url: 'https://hostingvibe.ru',
    siteName: 'VibeHosting',
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'VibeHosting — простейший хостинг для сайтов' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeHosting — Сайт в интернете за 5 минут',
    description: 'Перетащи файлы — получи ссылку. Бесплатно. Без программиста.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://hostingvibe.ru',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <body className="bg-white text-gray-900 antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'VibeHosting',
              url: 'https://hostingvibe.ru',
              description: 'Запусти свой сайт за 5 минут. Перетащи файлы — получи ссылку. Бесплатно. Без программиста.',
              applicationCategory: 'WebApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'RUB',
                description: 'Бесплатный тариф: 1 сайт, 50 МБ',
              },
              author: {
                '@type': 'Organization',
                name: 'VibeHosting',
                url: 'https://hostingvibe.ru',
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
