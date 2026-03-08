import TelegramBot, { Message } from 'node-telegram-bot-api';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from './logger';

let bot: TelegramBot | null = null;

export function initTelegramBot(): void {
  const token = config.telegram.botToken;
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start (.+)/, async (msg: Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id;
    const linkCode = match?.[1];

    if (!linkCode) {
      bot!.sendMessage(chatId, '❌ Неверная ссылка. Перейдите в дашборд VibeHosting и нажмите «Подключить Telegram».');
      return;
    }

    try {
      // Find pending link by code
      const link = await prisma.telegramLink.findUnique({
        where: { linkCode },
        include: { user: { select: { email: true, displayName: true } } },
      });

      if (!link) {
        bot!.sendMessage(chatId, '❌ Код не найден или уже использован. Сгенерируйте новый в дашборде.');
        return;
      }

      if (link.chatId && link.chatId !== '') {
        bot!.sendMessage(chatId, '✅ Этот аккаунт уже привязан. Заявки с ваших сайтов будут приходить сюда.');
        return;
      }

      // Link the chat
      await prisma.telegramLink.update({
        where: { id: link.id },
        data: {
          chatId: String(chatId),
          username: msg.from?.username || null,
        },
      });

      const name = link.user.displayName || link.user.email;
      bot!.sendMessage(chatId,
        `✅ Telegram привязан к аккаунту ${name}!\n\n` +
        `Теперь заявки с ваших сайтов на VibeHosting будут приходить в этот чат.\n\n` +
        `Чтобы отвязать — зайдите в Настройки → Telegram в дашборде.`
      );

      logger.info('Telegram linked', { userId: link.userId, chatId });
    } catch (err) {
      logger.error('Telegram link error', { error: (err as Error).message });
      bot!.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  });

  bot.onText(/\/start$/, (msg: Message) => {
    bot!.sendMessage(msg.chat.id,
      `👋 Привет! Я бот VibeHosting.\n\n` +
      `Я отправляю вам заявки с форм на ваших сайтах.\n\n` +
      `Чтобы подключить:\n` +
      `1. Войдите в дашборд hostingvibe.ru\n` +
      `2. Настройки → Telegram → «Подключить»\n` +
      `3. Нажмите на сгенерированную ссылку\n\n` +
      `И всё — заявки будут приходить сюда!`
    );
  });

  bot.onText(/\/help/, (msg: Message) => {
    bot!.sendMessage(msg.chat.id,
      `📋 Команды:\n\n` +
      `/start — начало работы\n` +
      `/status — проверить привязку\n` +
      `/help — эта справка`
    );
  });

  bot.onText(/\/status/, async (msg: Message) => {
    const chatId = String(msg.chat.id);
    try {
      const link = await prisma.telegramLink.findFirst({
        where: { chatId },
        include: {
          user: {
            select: {
              email: true,
              displayName: true,
              projects: {
                where: { status: 'LIVE' },
                select: {
                  slug: true,
                  title: true,
                  domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 },
                },
              },
            },
          },
        },
      });

      if (!link) {
        bot!.sendMessage(msg.chat.id, '❌ Telegram не привязан к аккаунту VibeHosting.');
        return;
      }

      const projects = link.user.projects;
      const projectList = projects.length > 0
        ? projects.map(p => {
            const host = p.domains[0]?.hostname || `${p.slug}.hostingvibe.ru`;
            return `• ${p.title} (${host})`;
          }).join('\n')
        : 'Нет активных проектов';

      bot!.sendMessage(msg.chat.id,
        `✅ Привязан к: ${link.user.displayName || link.user.email}\n\n` +
        `Сайты:\n${projectList}\n\n` +
        `Заявки с форм на этих сайтах будут приходить сюда.`
      );
    } catch {
      bot!.sendMessage(msg.chat.id, '❌ Ошибка. Попробуйте позже.');
    }
  });

  // node-telegram-bot-api emits 'polling_error' but types don't expose .on()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bot as any).on('polling_error', (err: Error) => {
    logger.error('Telegram polling error', { error: err.message });
  });

  logger.info('Telegram bot started (polling)');
}

// Send form submission to user's Telegram
export async function sendFormToTelegram(
  chatId: string,
  projectSlug: string,
  formData: Record<string, string>,
  formName?: string | null,
  customDomain?: string | null,
): Promise<boolean> {
  if (!bot) return false;

  const fields = Object.entries(formData)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => `<b>${escapeHtml(key)}:</b> ${escapeHtml(String(value))}`)
    .join('\n');

  const formLabel = formName ? `\n📋 Форма: ${escapeHtml(formName)}` : '';
  const siteHost = customDomain || `${projectSlug}.hostingvibe.ru`;

  const message =
    `📩 <b>Новая заявка</b>\n` +
    `🌐 Сайт: ${escapeHtml(siteHost)}` +
    `${formLabel}\n\n` +
    `${fields}`;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    return true;
  } catch (err) {
    logger.error('Failed to send TG message', { chatId, error: (err as Error).message });
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getTelegramBot(): TelegramBot | null {
  return bot;
}
