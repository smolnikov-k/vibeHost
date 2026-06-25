'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Globe, Clock, HardDrive, ExternalLink, Loader2, Zap } from 'lucide-react';
import { animate } from 'animejs';
import { api, type Project } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showToast } from '@/lib/toast';
import { formatBytes, timeAgo } from '@/lib/utils';
import { OnboardingModal } from '@/components/onboarding-modal';

const statusLabels: Record<string, { label: string; color: string }> = {
  LIVE: { label: 'Онлайн', color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' },
  PROCESSING: { label: 'Загрузка...', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  UPLOADING: { label: 'Загрузка...', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  ERROR: { label: 'Ошибка', color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  SUSPENDED: { label: 'Заморожен', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
};

function ProjectsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const slugParam = searchParams.get('slug');
  const planParam = searchParams.get('plan');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getProjects()
      .then((data) => setProjects(data))
      .catch(() => { showToast('Не удалось загрузить проекты', 'error'); })
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

  const maxProjects = user?.isAdmin ? 100 : user?.plan === 'PRO' ? 3 : 1;
  const canCreate = projects.length < maxProjects;

  const newProjectUrl = () => {
    const params = new URLSearchParams();
    if (slugParam) params.set('slug', slugParam);
    if (planParam) params.set('plan', planParam);
    const qs = params.toString();
    return `/projects/new${qs ? `?${qs}` : ''}`;
  };

  return (
    <div>
      <OnboardingModal show={isWelcome} slug={slugParam} plan={planParam} userId={user?.id} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Мои проекты</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {projects.length} из {maxProjects} сайтов
          </p>
        </div>
        {canCreate ? (
          <Link
            href={newProjectUrl()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </Link>
        ) : (
          <Link
            href={user?.plan === 'PRO' ? '#' : '/billing'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              user?.plan === 'PRO'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5'
            }`}
          >
            {user?.plan === 'PRO' ? (
              <Plus className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {user?.plan === 'PRO' ? `Лимит ${maxProjects} проектов` : 'Апгрейд для новых сайтов'}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
                  </div>
                  <div className="h-4 w-52 bg-gray-100 dark:bg-gray-700 rounded mt-2" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="h-3.5 w-16 bg-gray-100 dark:bg-gray-700 rounded" />
                <div className="h-3.5 w-24 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
            <Globe className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Нет проектов</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Создай первый проект и загрузи свой сайт
          </p>
          <Link
            href={newProjectUrl()}
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
                className="project-card opacity-0 block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 hover:scale-[1.01] transition-all duration-200 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {project.title}
                      </h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      <span className="font-mono">{project.customDomain || `${project.slug}.hostingvibe.ru`}</span>
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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>}>
      <ProjectsContent />
    </Suspense>
  );
}
