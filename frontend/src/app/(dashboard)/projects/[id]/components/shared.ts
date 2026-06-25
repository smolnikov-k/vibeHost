import type { Project, Deployment, FileEntry } from '@/lib/api';

export function formatDate(date: string) {
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const statusColors: Record<string, string> = {
  LIVE: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
  PENDING: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  EXTRACTING: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  BUILDING: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  PREVIEW: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  FAILED: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  SUPERSEDED: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

export type { Project, Deployment, FileEntry };
