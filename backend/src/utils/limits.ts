import { Plan } from '@prisma/client';
import { config } from '../config';

const ADMIN_LIMITS = {
  maxProjects: 100,
  maxSiteSize: 10 * 1024 * 1024 * 1024,     // 10 GB
  maxTotalStorage: 10 * 1024 * 1024 * 1024,  // 10 GB
  maxVersions: 999,
  maxQrCodes: 999,
};

export function getPlanLimits(plan: Plan, isAdmin = false) {
  if (isAdmin) return ADMIN_LIMITS;
  return plan === 'PRO' ? config.pro : config.free;
}
