import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { deleteProjectFiles } from '../services/deploy.service';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.service';
import logger from '../services/logger';

const router = Router();

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email и пароль обязательны' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Некорректный формат email' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль минимум 6 символов' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email уже зарегистрирован' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: displayName || null },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    // Welcome email (fire-and-forget)
    sendWelcomeEmail(email, displayName || email.split('@')[0]).catch(() => {});

    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
    } });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email и пароль обязательны' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({ token, user: {
      id: user.id, email: user.email, displayName: user.displayName, plan: user.plan,
      isAdmin: user.isAdmin, storageUsed: Number(user.storageUsed), storageLimit: Number(user.storageLimit), createdAt: user.createdAt,
    } });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Требуется авторизация' });
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
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json({
      ...user,
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
    });
  } catch (err) {
    logger.error('Me error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Forgot password — generate reset token
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email обязателен' });
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

    await prisma.passwordReset.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    // Send reset email with raw token (fire-and-forget, don't leak success/failure)
    sendPasswordResetEmail(email, tokenRaw).catch(() => {});

    res.json({ message: 'Если аккаунт с таким email существует, ссылка для сброса отправлена' });
  } catch (err) {
    logger.error('Forgot password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Reset password with token
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Токен и новый пароль обязательны' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Пароль минимум 6 символов' });
      return;
    }

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      res.status(400).json({ error: 'Недействительная или просроченная ссылка' });
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
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Change password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Текущий и новый пароль обязательны' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Новый пароль минимум 6 символов' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Неверный текущий пароль' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    logger.error('Change password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update profile
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }

    const { displayName } = req.body;
    if (displayName !== undefined && typeof displayName !== 'string') {
      res.status(400).json({ error: 'Некорректное имя' });
      return;
    }

    const trimmed = displayName?.trim() || null;
    if (trimmed && trimmed.length > 50) {
      res.status(400).json({ error: 'Имя не более 50 символов' });
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
    logger.error('Update profile error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Delete account (152-ФЗ compliance)
router.delete('/account', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }

    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Введите пароль для подтверждения' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { projects: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Verify password
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Неверный пароль' });
      return;
    }

    // Delete all project files from disk
    for (const project of user.projects) {
      deleteProjectFiles(project.slug);
    }

    // Delete user (cascades: projects, deployments, domains, passwordResets)
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: 'Аккаунт удалён' });
  } catch (err) {
    logger.error('Delete account error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
