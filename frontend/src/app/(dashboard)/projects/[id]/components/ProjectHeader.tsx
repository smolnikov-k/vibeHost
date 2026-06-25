'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe, ExternalLink, HardDrive, Clock, Pencil, BarChart3,
  QrCode, Lock,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { formatDate, statusColors, type Project } from './shared';
import { QrCustomizer } from '@/components/qr/QrCustomizer';

interface ProjectHeaderProps {
  project: Project;
  projectId: string;
}

export function ProjectHeader({ project, projectId }: ProjectHeaderProps) {
  const [showQR, setShowQR] = useState(false);

  const siteUrl = `https://${project.customDomain || `${project.slug}.hostingvibe.ru`}`;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1 break-words">{project.title}</h1>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-mono">{project.customDomain || `${project.slug}.hostingvibe.ru`}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {project.status === 'LIVE' && (
            <Link
              href={`/projects/${projectId}/edit`}
              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Редактировать
            </Link>
          )}
          <Link
            href={`/projects/${projectId}/analytics`}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Аналитика
          </Link>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            statusColors[project.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {project.status === 'LIVE' ? 'Онлайн' : project.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-400 flex-wrap">
        <span className="flex items-center gap-1">
          <HardDrive className="w-3.5 h-3.5" />
          {formatBytes(Number(project.sizeBytes))}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Обновлён {formatDate(project.updatedAt)}
        </span>
        {project.currentVersion > 0 && (
          <span>Версия {project.currentVersion}</span>
        )}
        {project.passwordEnabled && (
          <span className="flex items-center gap-1 text-amber-500">
            <Lock className="w-3.5 h-3.5" />
            Защищён паролем
          </span>
        )}
        <button
          onClick={() => setShowQR(true)}
          className="flex items-center gap-1 text-emerald-500 hover:text-emerald-600 transition-colors"
        >
          <QrCode className="w-3.5 h-3.5" />
          QR-код
        </button>
      </div>

      {showQR && (
        <QrCustomizer project={project} projectId={projectId} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}
