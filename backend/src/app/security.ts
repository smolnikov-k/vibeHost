import cors from 'cors';
import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';
import { config } from '../config';

type AppInstance = ReturnType<typeof express>;

const allowedCorsOrigins: string[] = (() => {
  const origins = [...config.corsOrigins];
  // In development, include localhost origins
  if (process.env.NODE_ENV !== 'production') {
    const devOrigins = ['http://localhost:3000', 'http://localhost:7002'];
    for (const o of devOrigins) {
      if (!origins.includes(o)) origins.push(o);
    }
  }
  return origins;
})();

// Paths that serve cross-origin content (user sites load these scripts/data)
const PUBLIC_CROSS_ORIGIN_PREFIXES = ['/api/vibe-', '/api/patches/', '/api/track', '/api/pixel'];

export function configureSecurity(app: AppInstance): void {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.hostingvibe.ru', 'wss:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameAncestors: ["'self'", 'https://hostingvibe.ru'],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });

  // Skip Helmet for public cross-origin routes — they need Access-Control-Allow-Origin: *
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (PUBLIC_CROSS_ORIGIN_PREFIXES.some(p => req.path.startsWith(p))) {
      return next();
    }
    helmetMiddleware(req, res, next);
  });

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  }));
}
