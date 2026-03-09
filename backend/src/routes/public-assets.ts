import path from 'path';
import { Router, Request, Response } from 'express';

const router = Router();

function sendPublicScript(res: Response, fileName: string, options: { allowAllOrigins?: boolean } = {}): void {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (options.allowAllOrigins) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.sendFile(path.join(__dirname, '..', 'public', fileName));
}

router.get('/vibe-forms.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-forms.js', { allowAllOrigins: true });
});

router.get('/vibe-editor-bridge.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-editor-bridge.js');
});

router.get('/vibe-patches.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-patches.js', { allowAllOrigins: true });
});

export default router;
