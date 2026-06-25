import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { webhookRouter as billingWebhookRouter } from '../routes/billing';
import { errorHandler } from './error-handler';
import { registerProtectedRoutes } from './protected-routes';
import { registerPublicRoutes } from './public-routes';
import { requestIdMiddleware } from './request-id';
import { configureSecurity } from './security';
import internalPreviewRoutes from '../routes/internal-preview';
import webhookBlogRoutes from '../routes/webhook-blog';
import { apiLimiter } from '../middleware/rateLimit';
import { maintenanceMiddleware } from '../middleware/maintenance';
import logger from '../services/logger';

type AppInstance = ReturnType<typeof express>;

export function createApp(): AppInstance {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(maintenanceMiddleware);

  // Preview route BEFORE Helmet — editor iframe needs no CSP
  app.use('/api', apiLimiter, internalPreviewRoutes);

  configureSecurity(app);

  // Diagnostic middleware — collect webhook metadata before any parser consumes the stream.
  // Enabled via PRODAMUS_DIAG=1 env var. Does NOT parse body — only reads raw chunks for metadata.
  app.use('/api/billing/webhook', (req: Request, _res: Response, next: () => void) => {
    if (process.env.PRODAMUS_DIAG !== '1') return next();
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      logger.info('Webhook diagnostic (pre-parser)', {
        contentType: req.headers['content-type'],
        headerNames: Object.keys(req.headers),
        signPresent: !!req.headers['sign'],
        signLength: typeof req.headers['sign'] === 'string' ? req.headers['sign'].length : 0,
        bodySize: raw.length,
        bodyHash: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16),
      });
    });
    next();
  });

  // Webhook must be mounted before global JSON parser to preserve the raw body for HMAC verification.
  app.use('/api/billing/webhook', express.json({
    limit: '100kb',
    verify: (req: Request, _res: Response, buf: Buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf); },
  }));
  // Also parse urlencoded (Prodamus may send application/x-www-form-urlencoded)
  app.use('/api/billing/webhook', express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/api/billing/webhook', billingWebhookRouter);

  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  registerPublicRoutes(app);

  // Blog webhook — no auth, uses X-Webhook-Secret
  app.use('/api/webhook', webhookBlogRoutes);

  registerProtectedRoutes(app);

  // Catch-all for unmatched /api/* routes — return 404 instead of falling through
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  app.use(errorHandler);

  return app;
}
