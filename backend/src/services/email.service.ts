import nodemailer from 'nodemailer';
import { config } from '../config';

/** Escape HTML to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
  <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #f3f4f6">
    <div style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#34d399,#22c55e);text-align:center;line-height:36px;font-size:18px;color:#fff">⚡</div>
    <div style="margin-top:8px;font-size:16px;font-weight:700;color:#111827">Vibe<span style="color:#10b981">Hosting</span></div>
  </td></tr>
  <tr><td style="padding:32px 40px">${content}</td></tr>
  <tr><td style="padding:20px 40px;text-align:center;background:#f9fafb;border-top:1px solid #f3f4f6">
    <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} VibeHosting — hostingvibe.ru</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buttonHtml(text: string, url: string): string {
  return `<div style="text-align:center;margin:28px 0">
    <a href="${url}" style="display:inline-block;padding:12px 32px;background:#10b981;color:#fff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none">${text}</a>
  </div>`;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Сброс пароля</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6">
      Вы запросили сброс пароля для вашего аккаунта VibeHosting.
      Нажмите кнопку ниже, чтобы установить новый пароль.
    </p>
    ${buttonHtml('Сбросить пароль', resetUrl)}
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
      Ссылка действительна 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
    </p>
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Сброс пароля — VibeHosting',
    html,
  });
}

export async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Добро пожаловать, ${escapeHtml(displayName)}! 🎉</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6">
      Ваш аккаунт на VibeHosting создан. Загрузите ZIP-архив или HTML-файл — и ваш сайт будет в сети за 30 секунд.
    </p>
    ${buttonHtml('Создать первый сайт', `${config.frontendUrl}/projects/new`)}
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
      Бесплатный тариф: 1 сайт, 50 МБ хранилища. Нужно больше? Переходите на PRO.
    </p>
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Добро пожаловать в VibeHosting!',
    html,
  });
}

export async function sendDeployNotification(email: string, projectTitle: string, slug: string): Promise<void> {
  const siteUrl = `https://${slug}.hostingvibe.ru`;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Деплой завершён ✅</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6">
      Проект <strong>${escapeHtml(projectTitle)}</strong> успешно задеплоен и доступен по ссылке:
    </p>
    ${buttonHtml('Открыть сайт', siteUrl)}
    <p style="margin:0;font-size:12px;color:#9ca3af">Ссылка: ${siteUrl}</p>
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `Деплой завершён: ${projectTitle} — VibeHosting`,
    html,
  });
}

export async function verifySmtpConnection(): Promise<boolean> {
  if (!config.smtp.user) return false;
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
