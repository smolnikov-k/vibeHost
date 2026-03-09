import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { webhookRouter as billingWebhookRouter } from '../routes/billing';
import { errorHandler } from './error-handler';
import { registerProtectedRoutes } from './protected-routes';
import { registerPublicRoutes } from './public-routes';
import { requestIdMiddleware } from './request-id';
import { configureSecurity } from './security';

type AppInstance = ReturnType<typeof express>;

export function createApp(): AppInstance {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  configureSecurity(app);

  // Webhook must be mounted before global JSON parser to preserve the raw body for HMAC verification.
  app.use('/api/billing/webhook', express.json({
    limit: '100kb',
    verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = Buffer.from(buf); },
  }));
  app.use('/api/billing/webhook', billingWebhookRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  registerPublicRoutes(app);

  app.use('/api', authMiddleware);
  registerProtectedRoutes(app);
  app.use(errorHandler);

  return app;
}
