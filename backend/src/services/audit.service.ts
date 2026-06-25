import { prisma } from '../lib/prisma';
import logger from './logger';

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId: targetId ?? null,
        details: details ? (details as any) : undefined,
      },
    });
  } catch (err) {
    logger.error('Failed to log admin action', {
      adminId,
      action,
      targetType,
      targetId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
