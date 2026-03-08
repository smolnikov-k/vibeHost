'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const VibeEditor = dynamic(
  () => import('@/components/editor/VibeEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    ),
  }
);

export default function EditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [slug, setSlug] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getProject(projectId);
        const project = (res as any).project || res;
        setSlug(project.slug);
        setCustomDomain(project.customDomain || null);
      } catch {
        setError('Проект не найден');
      }
    }
    load();
  }, [projectId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => router.push('/projects')}
            className="mt-3 text-sm text-emerald-600 hover:text-emerald-700"
          >
            К проектам
          </button>
        </div>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <VibeEditor
      projectId={projectId}
      projectSlug={slug}
      customDomain={customDomain}
      onBack={() => router.push(`/projects/${projectId}`)}
    />
  );
}
