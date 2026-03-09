import express from 'express';
import logger from '../services/logger';

export function errorHandler(err: Error, req: express.Request, res: express.Response, _next: express.NextFunction): void {
  const requestId = req.requestId || 'unknown';

  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  if (err.message === 'Только ZIP или TAR.GZ архивы') {
    res.status(400).json({ error: err.message, requestId });
    return;
  }

  res.status(500).json({ error: 'Внутренняя ошибка сервера', requestId });
}
