import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Галерея проектов',
  description: 'Смотрите публичные сайты, созданные на VibeHosting. Вдохновляйтесь проектами других пользователей.',
  alternates: {
    canonical: '/gallery',
  },
  openGraph: {
    title: 'Галерея проектов',
    description: 'Публичные сайты, созданные на VibeHosting. Ищите по тегам, ставьте лайки.',
    url: 'https://hostingvibe.ru/gallery',
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
