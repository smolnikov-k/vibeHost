import express from 'express';
import logger from '../services/logger';

export function errorHandler(err: Error & { type?: string; status?: number }, req: express.Request, res: express.Response, _next: express.NextFunction): void {
  const requestId = req.requestId || 'unknown';

  // Malformed JSON body (express.json() SyntaxError)
  if (err instanceof SyntaxError && 'body' in err && err.status === 400) {
    res.status(400).json({ error: 'Некорректный JSON', requestId });
    return;
  }

  // Payload too large (express.json() limit exceeded)
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Превышен допустимый размер запроса', requestId });
    return;
  }

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
