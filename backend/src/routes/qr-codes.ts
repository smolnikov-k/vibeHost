import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getPlanLimits } from '../utils/limits';
import logger from '../services/logger';

const router = Router();

const VALID_DOT_STYLES = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
const VALID_CORNER_SQUARE_STYLES = ['square', 'dot', 'extra-rounded'];
const VALID_CORNER_DOT_STYLES = ['square', 'dot'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function validateColor(value: unknown): boolean {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

function sanitizeUtm(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  // Strip dangerous chars, keep alphanumeric + common UTM chars
  return value.trim().slice(0, 200).replace(/[<>"';&]/g, '');
}

// List QR codes for project
router.get('/:id/qr-codes', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { user: { select: { plan: true, isAdmin: true } } },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const qrCodes = await prisma.qrCode.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });

    const limits = getPlanLimits(project.user.plan, project.user.isAdmin);

    res.json({
      qrCodes,
      maxQrCodes: limits.maxQrCodes,
      plan: project.user.plan,
    });
  } catch (err) {
    logger.error('List QR codes error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create QR code
router.post('/:id/qr-codes', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { user: { select: { plan: true, isAdmin: true } } },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const limits = getPlanLimits(project.user.plan, project.user.isAdmin);
    const count = await prisma.qrCode.count({ where: { projectId: project.id } });
    if (count >= limits.maxQrCodes) {
      res.status(403).json({
        error: `Лимит QR-кодов: ${limits.maxQrCodes}. ${project.user.plan === 'FREE' ? 'Перейдите на PRO для создания до 30 QR-кодов.' : 'Достигнут максимум.'}`,
        code: 'QR_LIMIT',
      });
      return;
    }

    const { name, utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
            fgColor, bgColor, dotStyle, cornerSquareStyle, cornerDotStyle } = req.body;

    // Validate style fields
    if (fgColor !== undefined && !validateColor(fgColor)) {
      res.status(400).json({ error: 'Некорректный цвет точек (формат #RRGGBB)' });
      return;
    }
    if (bgColor !== undefined && !validateColor(bgColor)) {
      res.status(400).json({ error: 'Некорректный цвет фона (формат #RRGGBB)' });
      return;
    }
    if (dotStyle !== undefined && !VALID_DOT_STYLES.includes(dotStyle)) {
      res.status(400).json({ error: `dotStyle: ${VALID_DOT_STYLES.join(', ')}` });
      return;
    }
    if (cornerSquareStyle !== undefined && !VALID_CORNER_SQUARE_STYLES.includes(cornerSquareStyle)) {
      res.status(400).json({ error: `cornerSquareStyle: ${VALID_CORNER_SQUARE_STYLES.join(', ')}` });
      return;
    }
    if (cornerDotStyle !== undefined && !VALID_CORNER_DOT_STYLES.includes(cornerDotStyle)) {
      res.status(400).json({ error: `cornerDotStyle: ${VALID_CORNER_DOT_STYLES.join(', ')}` });
      return;
    }

    const qrCode = await prisma.qrCode.create({
      data: {
        projectId: project.id,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : 'QR-код',
        utmSource: sanitizeUtm(utmSource),
        utmMedium: sanitizeUtm(utmMedium),
        utmCampaign: sanitizeUtm(utmCampaign),
        utmContent: sanitizeUtm(utmContent),
        utmTerm: sanitizeUtm(utmTerm),
        fgColor: fgColor || '#000000',
        bgColor: bgColor || '#ffffff',
        dotStyle: dotStyle || 'square',
        cornerSquareStyle: cornerSquareStyle || 'square',
        cornerDotStyle: cornerDotStyle || 'square',
      },
    });

    res.status(201).json({ qrCode });
  } catch (err) {
    logger.error('Create QR code error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update QR code
router.put('/:id/qr-codes/:qrId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const existing = await prisma.qrCode.findFirst({
      where: { id: req.params.qrId, projectId: project.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'QR-код не найден' });
      return;
    }

    const { name, utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
            fgColor, bgColor, dotStyle, cornerSquareStyle, cornerDotStyle } = req.body;

    if (fgColor !== undefined && !validateColor(fgColor)) {
      res.status(400).json({ error: 'Некорректный цвет точек (формат #RRGGBB)' });
      return;
    }
    if (bgColor !== undefined && !validateColor(bgColor)) {
      res.status(400).json({ error: 'Некорректный цвет фона (формат #RRGGBB)' });
      return;
    }
    if (dotStyle !== undefined && !VALID_DOT_STYLES.includes(dotStyle)) {
      res.status(400).json({ error: `dotStyle: ${VALID_DOT_STYLES.join(', ')}` });
      return;
    }
    if (cornerSquareStyle !== undefined && !VALID_CORNER_SQUARE_STYLES.includes(cornerSquareStyle)) {
      res.status(400).json({ error: `cornerSquareStyle: ${VALID_CORNER_SQUARE_STYLES.join(', ')}` });
      return;
    }
    if (cornerDotStyle !== undefined && !VALID_CORNER_DOT_STYLES.includes(cornerDotStyle)) {
      res.status(400).json({ error: `cornerDotStyle: ${VALID_CORNER_DOT_STYLES.join(', ')}` });
      return;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : existing.name;
    if (utmSource !== undefined) data.utmSource = sanitizeUtm(utmSource);
    if (utmMedium !== undefined) data.utmMedium = sanitizeUtm(utmMedium);
    if (utmCampaign !== undefined) data.utmCampaign = sanitizeUtm(utmCampaign);
    if (utmContent !== undefined) data.utmContent = sanitizeUtm(utmContent);
    if (utmTerm !== undefined) data.utmTerm = sanitizeUtm(utmTerm);
    if (fgColor !== undefined) data.fgColor = fgColor;
    if (bgColor !== undefined) data.bgColor = bgColor;
    if (dotStyle !== undefined) data.dotStyle = dotStyle;
    if (cornerSquareStyle !== undefined) data.cornerSquareStyle = cornerSquareStyle;
    if (cornerDotStyle !== undefined) data.cornerDotStyle = cornerDotStyle;

    const qrCode = await prisma.qrCode.update({
      where: { id: existing.id },
      data,
    });

    res.json({ qrCode });
  } catch (err) {
    logger.error('Update QR code error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete QR code
router.delete('/:id/qr-codes/:qrId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    const existing = await prisma.qrCode.findFirst({
      where: { id: req.params.qrId, projectId: project.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'QR-код не найден' });
      return;
    }

    await prisma.qrCode.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete QR code error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
