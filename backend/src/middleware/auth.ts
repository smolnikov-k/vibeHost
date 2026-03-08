import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from '../services/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

type JwtPayload = { userId: string; email: string };

function readCookie(req: Request, name: string): string | undefined {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return undefined;

  const pairs = rawCookie.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey || rest.length === 0) continue;
    if (rawKey !== name) continue;
    const rawValue = rest.join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return undefined;
}

function readBearerToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return undefined;
}

function readLegacyQueryToken(req: Request): string | undefined {
  return typeof req.query.token === 'string' ? req.query.token : undefined;
}

function verifyAndAttach(token: string, req: AuthRequest): void {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  req.userId = payload.userId;
  req.userEmail = payload.email;
}

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

const TRUSTED_ORIGINS = new Set(
  [...config.corsOrigins, config.frontendUrl]
    .map(normalizeOrigin)
    .filter((v): v is string => Boolean(v)),
);

function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function validateCookieOrigin(req: Request, res: Response): boolean {
  if (!isMutatingMethod(req.method)) return true;

  const originHeader = req.headers.origin;
  if (!originHeader || typeof originHeader !== 'string') {
    // Keep backward compatibility for non-browser clients and same-origin edge cases.
    return true;
  }

  const origin = normalizeOrigin(originHeader);
  if (!origin || !TRUSTED_ORIGINS.has(origin)) {
    res.status(403).json({ error: 'Запрос отклонён политикой безопасности Origin' });
    return false;
  }
  return true;
}

// Optional auth — sets userId if token is valid, continues regardless
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = readBearerToken(req) || readCookie(req, 'vibe_token');
  if (token) {
    try {
      verifyAndAttach(token, req);
    } catch {
      // Invalid token — continue as anonymous
    }
  }
  next();
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Priority for browser auth: cookie -> Authorization header -> legacy query token
  const cookieToken = readCookie(req, 'vibe_token');
  const bearerToken = readBearerToken(req);
  const queryToken = readLegacyQueryToken(req);

  const token = cookieToken || bearerToken || queryToken;

  if (!token) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  // For mutating browser flows using cookie auth, enforce Origin allowlist.
  if (cookieToken && !bearerToken && !queryToken && !validateCookieOrigin(req, res)) {
    return;
  }

  if (queryToken) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
    logger.warn('Legacy query token auth used', {
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
    });
  }

  try {
    verifyAndAttach(token, req);
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}
