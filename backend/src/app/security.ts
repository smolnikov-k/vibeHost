import cors from 'cors';
import helmet from 'helmet';
import express from 'express';
import { config } from '../config';

type AppInstance = ReturnType<typeof express>;

export function configureSecurity(app: AppInstance): void {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || origin.endsWith('.hostingvibe.ru') || origin.endsWith('.hostingvibe.ru/')) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  }));
}
