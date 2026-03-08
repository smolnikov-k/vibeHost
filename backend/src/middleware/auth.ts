import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';

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

function verifyAndAttach(token: string, req: AuthRequest): void {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  req.userId = payload.userId;
  req.userEmail = payload.email;
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
  // Priority for SSE/browser auth: cookie -> Authorization header -> legacy query token
  const token =
    readCookie(req, 'vibe_token') ||
    readBearerToken(req) ||
    (typeof req.query.token === 'string' ? req.query.token : undefined);

  if (!token) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
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
