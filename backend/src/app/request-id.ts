import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawRequestId = req.headers['x-request-id'];
  const incomingRequestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
  const requestId = incomingRequestId && incomingRequestId.trim()
    ? incomingRequestId.trim().slice(0, 64)
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
