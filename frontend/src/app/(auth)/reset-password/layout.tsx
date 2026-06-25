import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Сброс пароля',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
