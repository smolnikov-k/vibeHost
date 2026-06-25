import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import adminRoutes from '../routes/admin';
import adminBackupRoutes from '../routes/admin-backup';
import adminBlogRoutes from '../routes/admin-blog';
import analyticsRoutes from '../routes/analytics';
import billingRoutes from '../routes/billing';
import deployRoutes from '../routes/deploy';
import domainRoutes from '../routes/domains';
import editRoutes from '../routes/edit';
import projectRoutes from '../routes/projects';
import qrCodeRoutes from '../routes/qr-codes';
import telegramRoutes from '../routes/telegram';

type AppInstance = ReturnType<typeof express>;

export function registerProtectedRoutes(app: AppInstance): void {
  // Apply auth + rate limit once for /api/projects, then mount sub-routers
  app.use('/api/projects', authMiddleware, apiLimiter);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', deployRoutes);
  app.use('/api/projects', analyticsRoutes);
  app.use('/api/projects', editRoutes);
  app.use('/api/projects', qrCodeRoutes);

  app.use('/api/domains', authMiddleware, apiLimiter, domainRoutes);
  app.use('/api/billing', authMiddleware, apiLimiter, billingRoutes);
  app.use('/api/telegram', authMiddleware, apiLimiter, telegramRoutes);
  app.use('/api/admin', authMiddleware, adminMiddleware, apiLimiter, adminRoutes);
  app.use('/api/admin/backups', authMiddleware, adminMiddleware, apiLimiter, adminBackupRoutes);
  app.use('/api/admin/blog', authMiddleware, adminMiddleware, apiLimiter, adminBlogRoutes);
}
