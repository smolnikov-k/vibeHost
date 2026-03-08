import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
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

function baseLayout(content: string, footer?: string): string {
  const unsubFooter = footer || '';
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
    ${unsubFooter}
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

function stepCard(num: number, title: string, desc: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
    <tr>
      <td width="40" valign="top" style="padding-right:12px">
        <div style="width:32px;height:32px;border-radius:50%;background:#ecfdf5;text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#10b981">${num}</div>
      </td>
      <td valign="top">
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:2px">${title}</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.5">${desc}</div>
      </td>
    </tr>
  </table>`;
}

function unsubscribeFooter(email: string): string {
  const token = jwt.sign({ email, action: 'unsubscribe' }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '90d' });
  const url = `${config.frontendUrl}/api/unsubscribe?token=${token}`;
  return `<p style="margin:8px 0 0;font-size:11px;color:#d1d5db"><a href="${url}" style="color:#d1d5db;text-decoration:underline">Отписаться от рассылки</a></p>`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Group 1: Transactional ────────────────────────────────────────

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
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">Добро пожаловать, ${escapeHtml(displayName)}!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Начни с первого деплоя — без карты, сразу выдадим 1 сайт, 50 МБ и ссылку для предпросмотра.
    </p>

    ${stepCard(1, 'Создай проект', 'Задай название — получишь поддомен <b>ваш-сайт.hostingvibe.ru</b>')}
    ${stepCard(2, 'Загрузи архив', 'Поддерживаем ZIP с HTML/CSS/картинками или одиночный HTML-файл')}
    ${stepCard(3, 'Проверь сайт', 'Открывай ссылку, поделись с командой или подключи свой домен')}

    ${buttonHtml('Создать первый сайт', `${config.frontendUrl}/projects/new`)}

    <div style="background:#f0fdf4;border-radius:10px;padding:14px;margin:18px 0 0">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:6px">Бесплатный тариф</div>
      <div style="font-size:13px;color:#15803d;line-height:1.6">
        1 сайт · 50 МБ · 30 дней. Когда понадобится больше — включишь PRO за 386 ₽/мес в любой момент.
      </div>
    </div>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #f3f4f6">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        📖 <a href="${config.frontendUrl}/docs" style="color:#10b981;text-decoration:none">Документация</a> &nbsp;·&nbsp;
        ✉️ Ответь на письмо, если нужна помощь — мы читаем.
      </p>
    </div>
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Добро пожаловать в VibeHosting!',
    html,
  });
}

export async function sendDeployNotification(email: string, projectTitle: string, slug: string, customDomain?: string | null): Promise<void> {
  const siteUrl = `https://${customDomain || `${slug}.hostingvibe.ru`}`;
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

export async function sendProUpgradeEmail(email: string, displayName: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Подписка PRO активирована! 🚀</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      ${escapeHtml(displayName)}, спасибо за поддержку! Ваш аккаунт переведён на тариф PRO.
    </p>

    <div style="background:#f0fdf4;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:8px">Что вам теперь доступно:</div>
      <div style="font-size:13px;color:#15803d;line-height:1.8">
        ✅ До 3 сайтов одновременно<br>
        ✅ 500 МБ хранилища<br>
        ✅ Бессрочное размещение (без 30-дневного лимита)<br>
        ✅ Кастомные домены с бесплатным SSL
      </div>
    </div>

    ${buttonHtml('Перейти в панель', `${config.frontendUrl}/projects`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Подписка PRO активирована — VibeHosting',
    html,
  });
}

export async function sendSubscriptionCancelledEmail(email: string, periodEnd: Date | null): Promise<void> {
  const endStr = periodEnd ? formatDate(periodEnd) : 'конца текущего периода';
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Подписка PRO отменена</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Ваша подписка PRO отменена. Тариф PRO останется активным до <strong>${endStr}</strong>.
    </p>

    <div style="background:#fef3c7;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:6px">Что произойдёт после:</div>
      <div style="font-size:13px;color:#a16207;line-height:1.6">
        Аккаунт переведётся на бесплатный тариф: 1 сайт, 50 МБ. Дополнительные сайты будут приостановлены.
      </div>
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
      Передумали? Вы можете возобновить подписку в любой момент.
    </p>
    ${buttonHtml('Возобновить PRO', `${config.frontendUrl}/billing`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Подписка PRO отменена — VibeHosting',
    html,
  });
}

// ─── Group 2: Lifecycle ────────────────────────────────────────────

export async function sendSubscriptionExpiringEmail(email: string, daysLeft: number, periodEnd: Date): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Подписка PRO истекает через ${daysLeft} дн.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Ваша подписка PRO заканчивается <strong>${formatDate(periodEnd)}</strong>.
      Продлите подписку, чтобы сохранить все сайты и хранилище.
    </p>

    <div style="background:#fef3c7;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;color:#a16207;line-height:1.6">
        Без продления: аккаунт будет переведён на FREE (1 сайт, 50 МБ, 30 дней).
      </div>
    </div>

    ${buttonHtml('Продлить подписку', `${config.frontendUrl}/billing`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `Подписка PRO истекает через ${daysLeft} дн. — VibeHosting`,
    html,
  });
}

export async function sendSubscriptionExpiredEmail(email: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Подписка PRO закончилась</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Ваша подписка PRO истекла. Аккаунт переведён на бесплатный тариф.
    </p>

    <div style="background:#fef2f2;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:6px">Текущие ограничения:</div>
      <div style="font-size:13px;color:#b91c1c;line-height:1.6">
        1 сайт · 50 МБ · 30 дней размещения
      </div>
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
      Все ваши данные сохранены. Возобновите PRO, чтобы вернуть полный доступ.
    </p>
    ${buttonHtml('Возобновить PRO', `${config.frontendUrl}/billing`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Подписка PRO закончилась — VibeHosting',
    html,
  });
}

export async function sendProjectExpiringEmail(email: string, projectTitle: string, slug: string, daysLeft: number): Promise<void> {
  const siteUrl = `https://${slug}.hostingvibe.ru`;
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Сайт будет приостановлен через ${daysLeft} дн.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Проект <strong>${escapeHtml(projectTitle)}</strong> (<a href="${siteUrl}" style="color:#10b981">${siteUrl}</a>) будет приостановлен через ${daysLeft} дней — срок бесплатного размещения подходит к концу.
    </p>

    <div style="background:#f0fdf4;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:6px">Как сохранить сайт:</div>
      <div style="font-size:13px;color:#15803d;line-height:1.6">
        Перейдите на тариф PRO — бессрочное размещение, до 3 сайтов, 500 МБ.
      </div>
    </div>

    ${buttonHtml('Перейти на PRO — 386 ₽/мес', `${config.frontendUrl}/billing`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `Сайт «${projectTitle}» будет приостановлен — VibeHosting`,
    html,
  });
}

export async function sendProjectSuspendedEmail(email: string, projectTitle: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">Сайт приостановлен</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Проект <strong>${escapeHtml(projectTitle)}</strong> приостановлен — истёк срок бесплатного размещения (30 дней).
    </p>

    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Как восстановить:</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.8">
        1. Передеплойте проект — получите ещё 30 дней<br>
        2. Или перейдите на PRO — бессрочное размещение
      </div>
    </div>

    ${buttonHtml('Перейти в панель', `${config.frontendUrl}/projects`)}
  `);

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `Сайт «${projectTitle}» приостановлен — VibeHosting`,
    html,
  });
}

// ─── Group 3: Engagement (marketing, with unsubscribe) ─────────────

export async function sendOnboardingReminderEmail(email: string, displayName: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">${escapeHtml(displayName)}, запустите сайт за 10 минут</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">
      Вы уже внутри VibeHosting. Остался последний шаг до результата — первый сайт онлайн:
    </p>

    ${stepCard(1, 'Подготовьте файлы', 'HTML + CSS + картинки, или попросите нейросеть сделать за вас')}
    ${stepCard(2, 'Загрузите ZIP-архив', 'Перетащите файл в панель — мы сделаем остальное')}
    ${stepCard(3, 'Готово!', 'Ваш сайт доступен по ссылке ваш-сайт.hostingvibe.ru')}

    ${buttonHtml('Запустить первый сайт', `${config.frontendUrl}/projects/new`)}

    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5">
      💡 Совет: отправьте <a href="${config.frontendUrl}/ai" style="color:#10b981;text-decoration:none">AI-промпт</a> в Claude Code или Cursor — нейросеть создаст и задеплоит сайт за вас.
    </p>
  `, unsubscribeFooter(email));

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Сделай первый сайт онлайн за 10 минут — VibeHosting',
    html,
  });
}

export async function sendTipsEmail(email: string, displayName: string, slug: string): Promise<void> {
  const siteUrl = `https://${slug}.hostingvibe.ru`;
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">3 улучшения сайта за 15 минут</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">
      ${escapeHtml(displayName)}, сайт <a href="${siteUrl}" style="color:#10b981">${slug}.hostingvibe.ru</a> уже в онлайне — вот 3 действия, которые быстро поднимут пользу:
    </p>

    ${stepCard(1, 'Опубликуйте в галерее', 'Включите «Показать в галерее» — получайте просмотры и лайки от сообщества')}
    ${stepCard(2, 'Подключите аналитику', 'Яндекс.Метрика встроена — отслеживайте посещения в реальном времени')}
    ${stepCard(3, 'Свой домен', 'Подключите кастомный домен с бесплатным SSL (тариф PRO)')}

    ${buttonHtml('Открыть панель', `${config.frontendUrl}/projects`)}

    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5">
      🎨 Посмотрите <a href="${config.frontendUrl}/gallery" style="color:#10b981;text-decoration:none">галерею</a> — вдохновляйтесь работами других пользователей.
    </p>
  `, unsubscribeFooter(email));

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: '3 улучшения сайта за 15 минут — VibeHosting',
    html,
  });
}

export async function sendWinBackEmail(email: string, displayName: string): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">${escapeHtml(displayName)}, верните сайт в фокус за 10 минут</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6">
      Мы подготовили короткий путь, чтобы быстро вернуть пользу от сайта:
    </p>

    <div style="background:#f0fdf4;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;color:#15803d;line-height:1.8">
        🤖 AI-промпт — нейросеть создаёт и деплоит сайт за вас<br>
        🎨 Визуальный редактор — правьте тексты и картинки прямо в браузере<br>
        📊 Встроенная аналитика Яндекс.Метрики<br>
        📝 Приём заявок с форм сайта в Telegram
      </div>
    </div>

    ${buttonHtml('Вернуться в VibeHosting', `${config.frontendUrl}/projects`)}
  `, unsubscribeFooter(email));

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Вернём ваш сайт в фокус за 10 минут — VibeHosting',
    html,
  });
}

// ─── Utility ───────────────────────────────────────────────────────

export async function verifySmtpConnection(): Promise<boolean> {
  if (!config.smtp.user) return false;
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
