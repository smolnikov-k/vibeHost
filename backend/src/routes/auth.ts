import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { deleteProjectFiles } from '../services/deploy.service';
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from '../services/email.service';
import { sendEmailOnce } from '../services/email-events.service';
import { forgotPasswordLimiter, loginLimiter, registerLimiter, resetPasswordLimiter, verifyEmailLimiter, resendVerificationLimiter } from '../middleware/rateLimit';
import logger from '../services/logger';

const router = Router();

function sendError(res: Response, status: number, error: string, requestId: string, extra: Record<string, unknown> = {}): void {
  res.status(status).json({ error, ...extra, requestId });
}

router.post('/register', registerLimiter, async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      sendError(res, 400, 'Email и пароль обязательны', requestId);
      return;
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      sendError(res, 400, 'Укажите имя (минимум 2 символа)', requestId);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 400, 'Некорректный формат email', requestId);
      return;
    }
    if (password.length < 8) {
      sendError(res, 400, 'Пароль должен содержать минимум 8 символов', requestId);
      return;
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      sendError(res, 400, 'Пароль должен содержать хотя бы одну букву и одну цифру', requestId);
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendError(res, 409, 'Email уже зарегистрирован', requestId);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Generate email verification code + token
    const verifyCode = String(crypto.randomInt(100000, 999999));
    const verifyToken = crypto.randomBytes(32).toString('hex');
    // Store code as "code:token" so we can verify both from one field
    const verifyExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName ? DOMPurify.sanitize(displayName, { ALLOWED_TAGS: [] }).trim() || null : null,
        emailVerifyCode: `${verifyCode}:${verifyToken}`,
        emailVerifyExpires: verifyExpires,
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

    // Verification email (idempotent fire-and-forget)
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${verifyToken}`;
    sendEmailOnce({
      dedupeKey: `verify:user:${user.id}`,
      eventType: 'email_verification',
      recipientEmail: email,
      userId: user.id,
      category: 'transactional',
      payload: { code: verifyCode },
    }, () => sendVerificationEmail(email, verifyCode, verifyUrl)).catch((err) => {
      logger.warn('Verification email send failed', {
        requestId,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    });

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

    res.cookie('vibe_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.hostingvibe.ru' : undefined,
    });

    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
      emailVerified: user.emailVerified,
    } });
  } catch (err) {
    logger.error('Register error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

router.post('/login', loginLimiter, async (req: AuthRequest, res: Response) => {
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

    if (user.isBanned) {
      sendError(res, 403, 'Аккаунт заблокирован', requestId);
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

    // Update last active timestamp (fire-and-forget)
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch((err) => {
      logger.warn('Failed to update lastActiveAt', {
        requestId,
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.cookie('vibe_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.hostingvibe.ru' : undefined,
    });

    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
      emailVerified: user.emailVerified,
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
        phone: true,
        plan: true,
        isAdmin: true,
        storageUsed: true,
        storageLimit: true,
        emailVerified: true,
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

// Verify email — by code or token
router.post('/verify-email', verifyEmailLimiter, async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { code, token: verifyToken } = req.body;

    if (!code && !verifyToken) {
      sendError(res, 400, 'Укажите код или токен подтверждения', requestId);
      return;
    }

    // Determine which user to look up
    let user;
    if (verifyToken && typeof verifyToken === 'string') {
      // Token-based verification (link click)
      user = await prisma.user.findFirst({
        where: {
          emailVerifyCode: { contains: `:${verifyToken}` },
          emailVerifyExpires: { gt: new Date() },
          emailVerified: false,
        },
      });
    } else if (code && typeof code === 'string') {
      // Code-based verification — need userId from auth
      if (!req.userId) {
        sendError(res, 401, 'Требуется авторизация для подтверждения по коду', requestId);
        return;
      }
      user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user || user.emailVerified) {
        res.json({ success: true });
        return;
      }
      // Validate code
      const storedCode = user.emailVerifyCode?.split(':')[0];
      if (storedCode !== code.trim() || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
        sendError(res, 400, 'Неверный или просроченный код', requestId);
        return;
      }
    }

    if (!user) {
      sendError(res, 400, 'Неверный или просроченный код/токен', requestId);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyCode: null, emailVerifyExpires: null },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Verify email error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Resend verification email
router.post('/resend-verification', resendVerificationLimiter, async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    if (!req.userId) {
      sendError(res, 401, 'Требуется авторизация', requestId);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      sendError(res, 404, 'Пользователь не найден', requestId);
      return;
    }

    if (user.emailVerified) {
      res.json({ success: true, message: 'Email уже подтверждён' });
      return;
    }

    // Generate new code + token
    const verifyCode = String(crypto.randomInt(100000, 999999));
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyCode: `${verifyCode}:${verifyToken}`,
        emailVerifyExpires: verifyExpires,
      },
    });

    const verifyUrl = `${config.frontendUrl}/verify-email?token=${verifyToken}`;
    sendVerificationEmail(user.email, verifyCode, verifyUrl).catch((err) => {
      logger.warn('Resend verification email failed', {
        requestId,
        email: user.email,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.json({ success: true, message: 'Код отправлен повторно' });
  } catch (err) {
    logger.error('Resend verification error', { requestId, error: err });
    res.status(500).json({ error: 'Ошибка сервера', requestId });
  }
});

// Forgot password — generate reset token
router.post('/forgot-password', forgotPasswordLimiter, async (req: AuthRequest, res: Response) => {
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
router.post('/reset-password', resetPasswordLimiter, async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId || 'unknown';
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      sendError(res, 400, 'Токен и новый пароль обязательны', requestId);
      return;
    }
    if (password.length < 8) {
      sendError(res, 400, 'Пароль должен содержать минимум 8 символов', requestId);
      return;
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      sendError(res, 400, 'Пароль должен содержать хотя бы одну букву и одну цифру', requestId);
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

    // Update password, increment tokenVersion and mark token as used
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
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
    if (newPassword.length < 8) {
      sendError(res, 400, 'Новый пароль должен содержать минимум 8 символов', requestId);
      return;
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(newPassword) || !/\d/.test(newPassword)) {
      sendError(res, 400, 'Новый пароль должен содержать хотя бы одну букву и одну цифру', requestId);
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
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

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

    const { displayName, phone } = req.body;
    if (displayName !== undefined && typeof displayName !== 'string') {
      sendError(res, 400, 'Некорректное имя', requestId);
      return;
    }
    if (phone !== undefined && typeof phone !== 'string') {
      sendError(res, 400, 'Некорректный телефон', requestId);
      return;
    }

    const trimmed = displayName ? DOMPurify.sanitize(displayName, { ALLOWED_TAGS: [] }).trim() || null : null;
    if (trimmed && trimmed.length > 50) {
      sendError(res, 400, 'Имя не более 50 символов', requestId);
      return;
    }

    const phoneTrimmed = phone?.replace(/[^+\d]/g, '') || null;
    if (phoneTrimmed && (phoneTrimmed.length < 10 || phoneTrimmed.length > 15)) {
      sendError(res, 400, 'Телефон должен содержать от 10 до 15 цифр', requestId);
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = trimmed;
    if (phone !== undefined) updateData.phone = phoneTrimmed;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: { id: true, email: true, displayName: true, phone: true, plan: true, isAdmin: true, storageUsed: true, storageLimit: true, createdAt: true },
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

// Logout — clear httpOnly auth cookie
router.post('/logout', (_req: AuthRequest, res: Response) => {
  res.cookie('vibe_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.hostingvibe.ru' : undefined,
  });
  res.json({ message: 'Вы вышли из системы' });
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
