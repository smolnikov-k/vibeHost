const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Load .env if exists (prod uses .env file, not PM2 env)
try { require('dotenv').config({ path: path.join(__dirname, '.env'), override: true }); } catch { /* dotenv optional */ }

const TOKEN = process.env.SUPPORT_BOT_TOKEN;
if (!TOKEN) { console.error('SUPPORT_BOT_TOKEN env var is required'); process.exit(1); }
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) { console.error('ADMIN_SECRET env var is required'); process.exit(1); }

// ─── Data persistence ───────────────────────────────────────

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load data:', err.message);
  }
  return { adminChatId: null, nextTicketId: 1, tickets: {}, forwardMap: {} };
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save data:', err.message);
  }
}

const data = loadData();

// ─── Bot init ───────────────────────────────────────────────

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('Support bot started');

// ─── Admin registration ─────────────────────────────────────

bot.onText(/\/admin (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const secret = match[1].trim();

  if (secret !== ADMIN_SECRET) {
    bot.sendMessage(chatId, '❌ Неверный код.');
    return;
  }

  data.adminChatId = String(chatId);
  saveData();

  bot.sendMessage(chatId,
    '✅ Вы зарегистрированы как администратор поддержки.\n\n' +
    'Теперь сообщения пользователей будут приходить сюда.\n' +
    'Чтобы ответить — сделайте reply на пересланное сообщение.\n\n' +
    'Команды:\n' +
    '/tickets — список открытых тикетов\n' +
    '/close ID — закрыть тикет\n' +
    '/reopen ID — открыть тикет\n' +
    '/stats — статистика'
  );

  console.log(`Admin registered: chatId=${chatId}`);
});

// ─── /start for users ───────────────────────────────────────

bot.onText(/\/start$/, (msg) => {
  const chatId = msg.chat.id;

  // Don't show user welcome to admin
  if (String(chatId) === data.adminChatId) return;

  const ticket = getOrCreateTicket(msg);

  bot.sendMessage(chatId,
    `👋 Здравствуйте! Это поддержка VibeHosting.\n\n` +
    `Ваш тикет: #${ticket.id}\n\n` +
    `Опишите ваш вопрос или проблему — мы ответим в ближайшее время.\n\n` +
    `💡 Вы также можете отправлять скриншоты и файлы.`
  );
});

// ─── /help ──────────────────────────────────────────────────

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  if (String(chatId) === data.adminChatId) {
    bot.sendMessage(chatId,
      '📋 Команды администратора:\n\n' +
      '/tickets — открытые тикеты\n' +
      '/all — все тикеты\n' +
      '/close ID — закрыть тикет\n' +
      '/reopen ID — открыть тикет\n' +
      '/stats — статистика\n' +
      '/broadcast ТЕКСТ — отправить всем\n\n' +
      'Чтобы ответить пользователю — reply на его сообщение.'
    );
  } else {
    bot.sendMessage(chatId,
      '📋 Команды:\n\n' +
      '/start — начать диалог\n' +
      '/ticket — номер вашего тикета\n' +
      '/help — справка\n\n' +
      'Просто напишите сообщение — мы ответим!'
    );
  }
});

// ─── /ticket — show ticket number ───────────────────────────

bot.onText(/\/ticket$/, (msg) => {
  const chatId = String(msg.chat.id);
  const ticket = data.tickets[chatId];

  if (!ticket) {
    bot.sendMessage(msg.chat.id, 'У вас пока нет тикета. Просто напишите сообщение.');
    return;
  }

  bot.sendMessage(msg.chat.id,
    `🎫 Ваш тикет: #${ticket.id}\n` +
    `Статус: ${ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт'}\n` +
    `Создан: ${new Date(ticket.createdAt).toLocaleDateString('ru-RU')}`
  );
});

// ─── Admin: /tickets — list open tickets ────────────────────

bot.onText(/\/tickets$/, (msg) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const open = Object.values(data.tickets).filter(t => t.status === 'open');

  if (open.length === 0) {
    bot.sendMessage(msg.chat.id, '✅ Нет открытых тикетов.');
    return;
  }

  const list = open
    .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
    .map(t => {
      const name = t.name || 'Без имени';
      const user = t.username ? `@${t.username}` : '';
      const date = new Date(t.lastMessageAt || t.createdAt).toLocaleDateString('ru-RU');
      return `#${t.id} | ${name} ${user} | ${date} | ${t.messageCount || 0} сообщ.`;
    })
    .join('\n');

  bot.sendMessage(msg.chat.id, `📬 Открытые тикеты (${open.length}):\n\n${list}`);
});

// ─── Admin: /all — list all tickets ─────────────────────────

bot.onText(/\/all$/, (msg) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const all = Object.values(data.tickets);

  if (all.length === 0) {
    bot.sendMessage(msg.chat.id, 'Тикетов нет.');
    return;
  }

  const list = all
    .sort((a, b) => b.id - a.id)
    .slice(0, 30)
    .map(t => {
      const name = t.name || 'Без имени';
      const status = t.status === 'open' ? '🟢' : '🔴';
      return `${status} #${t.id} | ${name} | ${t.messageCount || 0} сообщ.`;
    })
    .join('\n');

  bot.sendMessage(msg.chat.id, `📋 Все тикеты (${all.length}):\n\n${list}`);
});

// ─── Admin: /close ID ───────────────────────────────────────

bot.onText(/\/close (\d+)/, (msg, match) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const ticketId = parseInt(match[1]);
  const entry = Object.entries(data.tickets).find(([, t]) => t.id === ticketId);

  if (!entry) {
    bot.sendMessage(msg.chat.id, `❌ Тикет #${ticketId} не найден.`);
    return;
  }

  const [userChatId, ticket] = entry;
  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  saveData();

  bot.sendMessage(msg.chat.id, `✅ Тикет #${ticketId} закрыт.`);
  bot.sendMessage(userChatId,
    `🔴 Тикет #${ticketId} закрыт.\n\n` +
    `Если у вас появятся новые вопросы — просто напишите, и мы откроем новый тикет.`
  );
});

// ─── Admin: /reopen ID ──────────────────────────────────────

bot.onText(/\/reopen (\d+)/, (msg, match) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const ticketId = parseInt(match[1]);
  const entry = Object.entries(data.tickets).find(([, t]) => t.id === ticketId);

  if (!entry) {
    bot.sendMessage(msg.chat.id, `❌ Тикет #${ticketId} не найден.`);
    return;
  }

  entry[1].status = 'open';
  entry[1].closedAt = null;
  saveData();

  bot.sendMessage(msg.chat.id, `🟢 Тикет #${ticketId} открыт заново.`);
});

// ─── Admin: /stats ──────────────────────────────────────────

bot.onText(/\/stats$/, (msg) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const all = Object.values(data.tickets);
  const open = all.filter(t => t.status === 'open').length;
  const closed = all.filter(t => t.status === 'closed').length;
  const totalMessages = all.reduce((sum, t) => sum + (t.messageCount || 0), 0);

  bot.sendMessage(msg.chat.id,
    `📊 Статистика поддержки:\n\n` +
    `Всего тикетов: ${all.length}\n` +
    `🟢 Открытых: ${open}\n` +
    `🔴 Закрытых: ${closed}\n` +
    `💬 Сообщений: ${totalMessages}`
  );
});

// ─── Admin: /broadcast TEXT ─────────────────────────────────

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== data.adminChatId) return;

  const text = match[1];
  const userChatIds = Object.keys(data.tickets);
  let sent = 0;

  for (const chatId of userChatIds) {
    try {
      await bot.sendMessage(chatId, `📢 ${text}`);
      sent++;
    } catch {
      // User may have blocked the bot
    }
  }

  bot.sendMessage(msg.chat.id, `✅ Рассылка отправлена: ${sent}/${userChatIds.length}`);
});

// ─── User messages → forward to admin ───────────────────────

bot.on('message', async (msg) => {
  const chatId = String(msg.chat.id);

  // Skip commands
  if (msg.text && msg.text.startsWith('/')) return;

  // Skip admin's messages that aren't replies
  if (chatId === data.adminChatId) {
    // Admin reply to forwarded message → send back to user
    if (msg.reply_to_message) {
      handleAdminReply(msg);
    }
    return;
  }

  // No admin set yet
  if (!data.adminChatId) {
    bot.sendMessage(chatId, '⏳ Поддержка ещё не настроена. Попробуйте позже.');
    return;
  }

  // Get or create ticket
  const ticket = getOrCreateTicket(msg);
  const isNew = ticket.messageCount === 0;

  // Update ticket
  ticket.messageCount = (ticket.messageCount || 0) + 1;
  ticket.lastMessageAt = new Date().toISOString();

  // Auto-reopen closed tickets on new message
  if (ticket.status === 'closed') {
    ticket.status = 'open';
    ticket.closedAt = null;
  }

  saveData();

  // Build header
  const name = ticket.name || 'Без имени';
  const user = ticket.username ? `@${ticket.username}` : '';
  const header = `📩 #${ticket.id} | ${name} ${user}${isNew ? ' | 🆕 Новый' : ''}`;

  try {
    // Forward the message to admin
    const forwarded = await bot.forwardMessage(data.adminChatId, chatId, msg.message_id);

    // Send header as separate message (reply to forwarded)
    const headerMsg = await bot.sendMessage(data.adminChatId, header, {
      reply_to_message_id: forwarded.message_id,
    });

    // Store mapping: both the forwarded message and the header can be replied to
    data.forwardMap[String(forwarded.message_id)] = chatId;
    data.forwardMap[String(headerMsg.message_id)] = chatId;
    saveData();

    // Confirm to user (only on first message)
    if (isNew) {
      bot.sendMessage(chatId,
        `✅ Ваше сообщение получено!\n` +
        `Тикет #${ticket.id} создан. Мы ответим в ближайшее время.`
      );
    }
  } catch (err) {
    console.error('Forward error:', err.message);
    bot.sendMessage(chatId, '❌ Не удалось отправить сообщение. Попробуйте позже.');
  }
});

// ─── Admin reply handler ────────────────────────────────────

async function handleAdminReply(msg) {
  const replyToId = String(msg.reply_to_message.message_id);
  let userChatId = data.forwardMap[replyToId];

  // If replying to the header message, also check
  if (!userChatId && msg.reply_to_message.reply_to_message) {
    const parentId = String(msg.reply_to_message.reply_to_message.message_id);
    userChatId = data.forwardMap[parentId];
  }

  // Fallback: try to extract from forwarded message
  if (!userChatId && msg.reply_to_message.forward_from) {
    const fwdChatId = String(msg.reply_to_message.forward_from.id);
    if (data.tickets[fwdChatId]) {
      userChatId = fwdChatId;
    }
  }

  if (!userChatId) {
    bot.sendMessage(msg.chat.id, '❌ Не удалось определить пользователя. Ответьте reply на пересланное сообщение.');
    return;
  }

  const ticket = data.tickets[userChatId];
  const ticketLabel = ticket ? `#${ticket.id}` : '';

  try {
    // Send text response
    if (msg.text) {
      await bot.sendMessage(userChatId, `💬 Поддержка VibeHosting:\n\n${msg.text}`);
    }

    // Forward photos, documents, etc.
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      await bot.sendPhoto(userChatId, photo.file_id, {
        caption: msg.caption ? `💬 Поддержка: ${msg.caption}` : '💬 Поддержка VibeHosting',
      });
    }

    if (msg.document) {
      await bot.sendDocument(userChatId, msg.document.file_id, {
        caption: msg.caption ? `💬 Поддержка: ${msg.caption}` : '💬 Поддержка VibeHosting',
      });
    }

    if (msg.sticker) {
      await bot.sendSticker(userChatId, msg.sticker.file_id);
    }

    if (msg.voice) {
      await bot.sendVoice(userChatId, msg.voice.file_id);
    }

    if (msg.video) {
      await bot.sendVideo(userChatId, msg.video.file_id, {
        caption: msg.caption ? `💬 Поддержка: ${msg.caption}` : undefined,
      });
    }

    bot.sendMessage(msg.chat.id, `✅ Ответ отправлен ${ticketLabel}`);
  } catch (err) {
    console.error('Reply error:', err.message);
    bot.sendMessage(msg.chat.id, `❌ Не удалось отправить ответ: ${err.message}`);
  }
}

// ─── Helpers ────────────────────────────────────────────────

function getOrCreateTicket(msg) {
  const chatId = String(msg.chat.id);

  if (!data.tickets[chatId]) {
    data.tickets[chatId] = {
      id: data.nextTicketId++,
      name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || null,
      username: msg.from?.username || null,
      status: 'open',
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
      closedAt: null,
    };
    saveData();
  } else {
    // Update name/username in case user changed them
    const ticket = data.tickets[chatId];
    const newName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');
    if (newName) ticket.name = newName;
    if (msg.from?.username) ticket.username = msg.from.username;
  }

  return data.tickets[chatId];
}

// ─── Graceful shutdown ──────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('Support bot shutting down...');
  saveData();
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  saveData();
  bot.stopPolling();
  process.exit(0);
});

// ─── Polling error handler ──────────────────────────────────

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});
