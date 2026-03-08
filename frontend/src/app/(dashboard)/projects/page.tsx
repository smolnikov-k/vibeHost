'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Globe, Clock, HardDrive, ExternalLink, Loader2 } from 'lucide-react';
import { animate } from 'animejs';
import { api, type Project } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatBytes, timeAgo } from '@/lib/utils';
import { OnboardingModal } from '@/components/onboarding-modal';

const statusLabels: Record<string, { label: string; color: string }> = {
  LIVE: { label: 'Онлайн', color: 'bg-emerald-100 text-emerald-700' },
  PROCESSING: { label: 'Загрузка...', color: 'bg-yellow-100 text-yellow-700' },
  UPLOADING: { label: 'Загрузка...', color: 'bg-yellow-100 text-yellow-700' },
  ERROR: { label: 'Ошибка', color: 'bg-red-100 text-red-700' },
  SUSPENDED: { label: 'Заморожен', color: 'bg-gray-100 text-gray-500' },
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getProjects()
      .then((data) => setProjects(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && listRef.current) {
      const cards = listRef.current!.querySelectorAll('.project-card');
      if (cards.length > 0) {
        animate(Array.from(cards) as HTMLElement[], {
          opacity: [0, 1],
          translateY: ['20px', '0px'],
          duration: 500,
          delay: (_el: unknown, i: number) => i * 80,
          ease: 'outExpo',
        });
      }
    }
  }, [loading, projects.length]);

  const maxProjects = user?.plan === 'PRO' ? 3 : 1;
  const canCreate = projects.length < maxProjects;

  return (
    <div>
      <OnboardingModal show={isWelcome} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои проекты</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} из {maxProjects} сайтов
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Globe className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Нет проектов</h2>
          <p className="text-sm text-gray-500 mb-6">
            Создай первый проект и загрузи свой сайт
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Создать проект
          </Link>
        </div>
      ) : (
        <div ref={listRef} className="grid gap-4">
          {projects.map((project) => {
            const status = statusLabels[project.status] || statusLabels.ERROR;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="project-card opacity-0 block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                        {project.title}
                      </h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {project.customDomain || `${project.slug}.hostingvibe.ru`}
                    </p>
                  </div>

                  {project.status === 'LIVE' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(`https://${project.customDomain || `${project.slug}.hostingvibe.ru`}`, '_blank');
                      }}
                      className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-600 ml-4"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Открыть
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    {formatBytes(Number(project.sizeBytes))}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {timeAgo(project.updatedAt)}
                  </span>
                  {project.currentVersion > 0 && (
                    <span>v{project.currentVersion}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
