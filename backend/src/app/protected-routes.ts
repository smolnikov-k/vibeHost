import express from 'express';
import { adminMiddleware } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import adminRoutes from '../routes/admin';
import analyticsRoutes from '../routes/analytics';
import billingRoutes from '../routes/billing';
import deployRoutes from '../routes/deploy';
import domainRoutes from '../routes/domains';
import editRoutes from '../routes/edit';
import projectRoutes from '../routes/projects';
import telegramRoutes from '../routes/telegram';

type AppInstance = ReturnType<typeof express>;

export function registerProtectedRoutes(app: AppInstance): void {
  app.use('/api/projects', apiLimiter, projectRoutes);
  app.use('/api/projects', apiLimiter, deployRoutes);
  app.use('/api/projects', apiLimiter, analyticsRoutes);
  app.use('/api/domains', apiLimiter, domainRoutes);
  app.use('/api/billing', apiLimiter, billingRoutes);
  app.use('/api/telegram', apiLimiter, telegramRoutes);
  app.use('/api/projects', apiLimiter, editRoutes);
  app.use('/api/admin', adminMiddleware, adminRoutes);
}
