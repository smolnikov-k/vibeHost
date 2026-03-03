import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Вход — VibeHosting',
  description: 'Войдите в VibeHosting для управления вашими сайтами. Бесплатный хостинг статических сайтов.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
