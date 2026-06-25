import jwt from 'jsonwebtoken';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { config } from '../config';

const router = Router();

router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).send('Неверная ссылка');
      return;
    }

    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { email: string; action: string };
    if (payload.action !== 'unsubscribe') {
      res.status(400).send('Неверная ссылка');
      return;
    }

    await prisma.user.updateMany({
      where: { email: payload.email },
      data: { emailOptOut: true },
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Отписка</title></head><body style="font-family:sans-serif;text-align:center;padding:80px 20px"><h2>Вы отписались от рассылки</h2><p>Вы больше не будете получать маркетинговые письма от VibeHosting.</p><p style="margin-top:24px"><a href="${config.frontendUrl}" style="color:#10b981">Вернуться на сайт</a></p></body></html>`);
  } catch {
    res.status(400).send('Ссылка недействительна или просрочена');
  }
});

export default router;
