import express from 'express';
import { apiLimiter, siteGateLimiter } from '../middleware/rateLimit';
import { optionalAuth } from '../middleware/auth';
import authRoutes from '../routes/auth';
import analyticsRoutes, { publicTrackRouter } from '../routes/analytics';
import formsRoutes from '../routes/forms';
import galleryRoutes from '../routes/gallery';
import healthRoutes from '../routes/health';
import pixelRoutes from '../routes/pixel';
import publicAssetRoutes from '../routes/public-assets';
import reportRoutes from '../routes/report';
import slugRoutes from '../routes/slug-check';
import unsubscribeRoutes from '../routes/unsubscribe';
import { siteAuthHandler, siteContextGet, siteGateGet, siteGatePost } from '../routes/site-gate';
import editRoutes, { publicPatchesRouter as publicPatchesRoutes } from '../routes/edit';
import blogRoutes from '../routes/blog';

type AppInstance = ReturnType<typeof express>;

export function registerPublicRoutes(app: AppInstance): void {
  app.use('/api', healthRoutes);
  app.use('/api', slugRoutes);
  app.use('/api', pixelRoutes);
  app.post('/api/track', apiLimiter, publicTrackRouter);
  app.use('/api', publicAssetRoutes);
  app.get('/api/site-context', apiLimiter, siteContextGet);
  app.use('/api/forms', apiLimiter, formsRoutes);
  app.use('/api/patches', apiLimiter, publicPatchesRoutes);
  app.use('/api/report', apiLimiter, reportRoutes);
  app.use('/api/gallery', apiLimiter, galleryRoutes);
  app.use('/api/blog', apiLimiter, blogRoutes);
  app.get('/api/unsubscribe', apiLimiter, unsubscribeRoutes);
  // Auth: per-endpoint limiters applied inside authRoutes; apiLimiter here protects /me and reads
  app.use('/api/auth', apiLimiter, optionalAuth, authRoutes);
  app.get('/api/site-auth', siteAuthHandler);
  app.get('/api/site-gate/:slug', siteGateGet);
  app.post('/api/site-gate/:slug', siteGateLimiter, siteGatePost);
  // Preview route mounted in create-app.ts BEFORE Helmet
}
