import type { Metadata } from 'next';
import { AiPageContent } from './AiPageContent';

export const metadata: Metadata = {
  title: 'Запусти сайт через AI — VibeHosting',
  description: 'Скопируйте готовый промпт и отправьте его вашей нейросети. AI сам создаст сайт и опубликует его на VibeHosting — без ручной работы.',
  openGraph: {
    title: 'Запусти сайт через AI — VibeHosting',
    description: 'Готовый промпт для Claude, ChatGPT и Cursor. AI создаст и задеплоит сайт автоматически.',
    url: 'https://hostingvibe.ru/ai',
  },
};

export default function AiPage() {
  return <AiPageContent />;
}
