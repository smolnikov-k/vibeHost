import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Блог',
  description: 'Статьи о веб-разработке, хостинге и создании сайтов — VibeHosting',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Блог VibeHosting',
    description: 'Статьи о веб-разработке, хостинге и создании сайтов',
    url: 'https://hostingvibe.ru/blog',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
