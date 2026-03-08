import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { deleteProjectFiles } from '../services/deploy.service';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.service';
import { sendEmailOnce } from '../services/email-events.service';
import logger from '../services/logger';

const router = Router();

function sendError(res: Response, status: number, error: string, requestId: string, extra: Record<string, unknown> = {}): void {
  res.status(status).json({ error, ...extra, requestId });
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      sendError(res, 400, 'Email и пароль обязательны', requestId);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 400, 'Некорректный формат email', requestId);
      return;
    }
    if (password.length < 6) {
      sendError(res, 400, 'Пароль минимум 6 символов', requestId);
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendError(res, 409, 'Email уже зарегистрирован', requestId);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: displayName || null },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

    // Welcome email (idempotent fire-and-forget)
    sendEmailOnce({
      dedupeKey: `welcome:user:${user.id}`,
      eventType: 'welcome',
      recipientEmail: email,
      userId: user.id,
      category: 'lifecycle',
      payload: { displayName: displayName || null },
    }, () => sendWelcomeEmail(email, displayName || email.split('@')[0])).catch((err) => {
      logger.warn('Welcome email send failed', {
        requestId,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
    } });
  } catch (err) {
    logger.error('Register error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, 400, 'Email и пароль обязательны', requestId);
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      sendError(res, 401, 'Неверный email или пароль', requestId);
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      sendError(res, 401, 'Неверный email или пароль', requestId);
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

    // Update last active timestamp (fire-and-forget)
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch((err) => {
      logger.warn('Failed to update lastActiveAt', {
        requestId,
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
    } });
  } catch (err) {
    logger.error('Login error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    if (!req.userId) {
      sendError(res, 401, 'Требуется авторизация', requestId);
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        plan: true,
        isAdmin: true,
        storageUsed: true,
        storageLimit: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    });
    if (!user) {
      sendError(res, 404, 'Пользователь не найден', requestId);
      return;
    }
    res.json({
      ...user,
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
    });
  } catch (err) {
    logger.error('Me error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Forgot password — generate reset token
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email } = req.body;
    if (!email) {
      sendError(res, 400, 'Email обязателен', requestId);
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'Если аккаунт с таким email существует, ссылка для сброса отправлена' });
      return;
    }

    // Invalidate previous tokens
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate secure token (URL-safe); store hash in DB, send raw token in email
    const tokenRaw = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const resetRecord = await prisma.passwordReset.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    // Send reset email with raw token (idempotent fire-and-forget, don't leak success/failure)
    sendEmailOnce({
      dedupeKey: `password_reset:reset:${resetRecord.id}`,
      eventType: 'password_reset',
      recipientEmail: email,
      userId: user.id,
      category: 'transactional',
      payload: { resetId: resetRecord.id },
    }, () => sendPasswordResetEmail(email, tokenRaw)).catch((err) => {
      logger.warn('Password reset email send failed', {
        requestId,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.json({ message: 'Если аккаунт с таким email существует, ссылка для сброса отправлена' });
  } catch (err) {
    logger.error('Forgot password error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Reset password with token
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      sendError(res, 400, 'Токен и новый пароль обязательны', requestId);
      return;
    }
    if (password.length < 6) {
      sendError(res, 400, 'Пароль минимум 6 символов', requestId);
      return;
    }

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      sendError(res, 400, 'Недействительная или просроченная ссылка', requestId);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and mark token as used
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    logger.error('Reset password error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Change password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    if (!req.userId) {
      sendError(res, 401, 'Требуется авторизация', requestId);
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      sendError(res, 400, 'Текущий и новый пароль обязательны', requestId);
      return;
    }
    if (newPassword.length < 6) {
      sendError(res, 400, 'Новый пароль минимум 6 символов', requestId);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      sendError(res, 404, 'Пользователь не найден', requestId);
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      sendError(res, 401, 'Неверный текущий пароль', requestId);
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    logger.error('Change password error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Update profile
router.put('/profile', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    if (!req.userId) {
      sendError(res, 401, 'Требуется авторизация', requestId);
      return;
    }

    const { displayName } = req.body;
    if (displayName !== undefined && typeof displayName !== 'string') {
      sendError(res, 400, 'Некорректное имя', requestId);
      return;
    }

    const trimmed = displayName?.trim() || null;
    if (trimmed && trimmed.length > 50) {
      sendError(res, 400, 'Имя не более 50 символов', requestId);
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { displayName: trimmed },
      select: { id: true, email: true, displayName: true, plan: true, isAdmin: true, storageUsed: true, storageLimit: true, createdAt: true },
    });

    res.json({
      ...user,
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
    });
  } catch (err) {
    logger.error('Update profile error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Delete account (152-ФЗ compliance)
router.delete('/account', async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    if (!req.userId) {
      sendError(res, 401, 'Требуется авторизация', requestId);
      return;
    }

    const { password } = req.body;
    if (!password) {
      sendError(res, 400, 'Введите пароль для подтверждения', requestId);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { projects: true },
    });
    if (!user) {
      sendError(res, 404, 'Пользователь не найден', requestId);
      return;
    }

    // Verify password
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      sendError(res, 401, 'Неверный пароль', requestId);
      return;
    }

    // Delete all project files from disk (best-effort)
    for (const project of user.projects) {
      try {
        deleteProjectFiles(project.slug);
      } catch (err) {
        logger.error('Delete account file cleanup failed', {
          requestId,
          projectId: project.id,
          slug: project.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Delete user (cascades: projects, deployments, domains, passwordResets)
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: 'Аккаунт удалён' });
  } catch (err) {
    logger.error('Delete account error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

export default router;
