import { prisma } from '../lib/prisma';
import { createHash } from 'crypto';
import logger from './logger';

function anonymizeIp(ip: string): string {
  if (ip.includes('.')) return ip.replace(/\.\d+$/, '.0');
  if (ip.includes(':')) return ip.replace(/:[\da-f]+:[\da-f]+:[\da-f]+:[\da-f]+:[\da-f]+$/i, '::');
  return ip;
}

const IP_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per IP per project
const MAX_MAP_SIZE = 10_000;
const recentViews = new Map<string, number>(); // key: "projectId:ip" -> timestamp

// Cleanup old entries every 30 min + enforce size limit
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentViews) {
    if (now - ts > IP_COOLDOWN_MS) recentViews.delete(key);
  }
  // Hard limit: if still over, drop oldest half
  if (recentViews.size > MAX_MAP_SIZE) {
    const entries = [...recentViews.entries()].sort((a, b) => a[1] - b[1]);
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    for (const [key] of toDelete) recentViews.delete(key);
  }
}, 5 * 60 * 1000); // cleanup every 5 min

export async function trackPageView(params: {
  slug: string;
  path: string;
  ip: string;
  userAgent?: string;
  referrer?: string;
}): Promise<boolean> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });
    if (!project || project.status !== 'LIVE') return false;

    // Anonymize IP: zero last octet (IPv4) or last 80 bits (IPv6)
    const anonIp = anonymizeIp(params.ip);

    // IP cooldown dedupe
    const key = `${project.id}:${anonIp}`;
    const lastSeen = recentViews.get(key);
    if (lastSeen && Date.now() - lastSeen < IP_COOLDOWN_MS) return false;
    recentViews.set(key, Date.now());

    // Insert page view
    await prisma.pageView.create({
      data: {
        projectId: project.id,
        path: params.path || '/',
        ip: hashIp(anonIp),
        userAgent: params.userAgent?.slice(0, 512),
        referrer: params.referrer?.slice(0, 1024),
      },
    });

    // Increment project views counter
    await prisma.project.update({
      where: { id: project.id },
      data: { views: { increment: 1 } },
    });

    return true;
  } catch (err) {
    logger.error('Analytics track error', { error: (err as Error).message });
    return false;
  }
}

function hashIp(ip: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}:${day}`).digest('hex').slice(0, 16);
}

export interface AnalyticsSummary {
  views: { total: number; today: number; week: number; month: number };
  topPages: { path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  viewsByDay: { date: string; count: number }[];
}

export async function getProjectAnalytics(
  projectId: string,
  days: number = 30
): Promise<AnalyticsSummary> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [total, today, week, month] = await Promise.all([
    prisma.pageView.count({ where: { projectId } }),
    prisma.pageView.count({ where: { projectId, createdAt: { gte: todayStart } } }),
    prisma.pageView.count({ where: { projectId, createdAt: { gte: weekAgo } } }),
    prisma.pageView.count({ where: { projectId, createdAt: { gte: monthAgo } } }),
  ]);

  // Top pages
  const topPagesRaw = await prisma.pageView.groupBy({
    by: ['path'],
    where: { projectId, createdAt: { gte: monthAgo } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const topPages = topPagesRaw.map(r => ({ path: r.path, count: r._count.id }));

  // Top referrers
  const topReferrersRaw = await prisma.pageView.groupBy({
    by: ['referrer'],
    where: { projectId, createdAt: { gte: monthAgo }, referrer: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const topReferrers = topReferrersRaw
    .filter(r => r.referrer)
    .map(r => ({ referrer: r.referrer!, count: r._count.id }));

  // Views by day (last N days)
  const viewsByDayRaw: { date: string; count: bigint }[] = await prisma.$queryRaw`
    SELECT DATE(created_at) as date, COUNT(*)::bigint as count
    FROM page_views
    WHERE project_id = ${projectId} AND created_at >= ${monthAgo}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  const viewsByDay = viewsByDayRaw.map(r => ({
    date: String(r.date).slice(0, 10),
    count: Number(r.count),
  }));

  return { views: { total, today, week, month }, topPages, topReferrers, viewsByDay };
}
