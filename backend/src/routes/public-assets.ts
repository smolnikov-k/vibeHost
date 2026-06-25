import path from 'path';
import { Router, Request, Response } from 'express';

const router = Router();
const publicDir = path.resolve(__dirname, '..', '..', 'public');

function sendPublicScript(res: Response, fileName: string, options: { allowAllOrigins?: boolean } = {}): void {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (options.allowAllOrigins) {
    // Override Helmet headers — these scripts are loaded by user sites from any origin
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.sendFile(path.join(publicDir, fileName));
}

router.get('/vibe-forms.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-forms.js', { allowAllOrigins: true });
});

router.get('/vibe-editor-bridge.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-editor-bridge.js', { allowAllOrigins: true });
});

router.get('/vibe-patches.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-patches.js', { allowAllOrigins: true });
});

router.get('/vibe-analytics.js', (_req: Request, res: Response) => {
  sendPublicScript(res, 'vibe-analytics.js', { allowAllOrigins: true });
});

export default router;
