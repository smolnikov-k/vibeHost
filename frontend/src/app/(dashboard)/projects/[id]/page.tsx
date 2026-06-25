'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, type Project, type Deployment } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { ProjectHeader } from './components/ProjectHeader';
import { DeployUploader } from './components/DeployUploader';
import { DeploymentHistory } from './components/DeploymentHistory';
import { VersionHistory } from './components/VersionHistory';
import { FileNavigator } from './components/FileNavigator';
import { ProjectSettings } from './components/ProjectSettings';
import { DangerZone } from './components/DangerZone';

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProject = useCallback(async () => {
    try {
      const p = await api.getProject(id);
      setProject(p);
    } catch {
      setError('Не удалось загрузить проект');
      showToast('Не удалось загрузить проект', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDeployments = useCallback(async () => {
    try {
      const data = await api.getDeployments(id);
      setDeployments(data);
    } catch {
      showToast('Не удалось загрузить историю деплоев', 'error');
    }
  }, [id]);

  const reload = useCallback(async () => {
    await Promise.all([loadProject(), loadDeployments()]);
  }, [loadProject, loadDeployments]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleDeployUpdate = useCallback(
    (deploymentId: string, data: { status: string; errorMessage?: string | null; buildLog?: string | null }) => {
      setDeployments((prev) =>
        prev.map((d) =>
          d.id === deploymentId
            ? { ...d, status: data.status as Deployment['status'], errorMessage: data.errorMessage || null, buildLog: data.buildLog ?? d.buildLog }
            : d
        )
      );
      if (data.status === 'LIVE' || data.status === 'PREVIEW') loadProject();
    },
    [loadProject]
  );

  const handlePublish = useCallback(
    async (deploymentId: string) => {
      setError('');
      try {
        await api.publishDeploy(id, deploymentId);
        showToast('Сайт опубликован', 'success');
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка публикации';
        setError(msg);
        showToast(msg, 'error');
      }
    },
    [id, reload]
  );

  const handleRollback = useCallback(
    async (version: number) => {
      setError('');
      try {
        await api.rollback(id, version);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка отката');
      }
    },
    [id, reload]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 text-sm">{error || 'Проект не найден'}</p>
        <Link href="/projects" className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-block">
          Назад к проектам
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Мои проекты
      </Link>

      <ProjectHeader project={project} projectId={id} />

      <DeployUploader
        projectId={id}
        onDeployUpdate={handleDeployUpdate}
        onReload={reload}
        error={error}
        setError={setError}
      />

      <DeploymentHistory deployments={deployments} onRollback={handleRollback} onPublish={handlePublish} />

      <VersionHistory projectId={id} onRollback={handleRollback} />

      {project.status === 'LIVE' && <FileNavigator projectId={id} />}

      <ProjectSettings
        key={project.updatedAt}
        project={project}
        projectId={id}
        onReload={reload}
        setError={setError}
      />

      <DangerZone
        projectId={id}
        projectSlug={project.slug}
        projectVersion={project.currentVersion}
        isLive={project.status === 'LIVE'}
        setError={setError}
      />
    </div>
  );
}
