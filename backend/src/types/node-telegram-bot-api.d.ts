declare module 'node-telegram-bot-api' {
  export interface Message {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    date: number;
    text?: string;
  }

  interface SendMessageOptions {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    reply_markup?: unknown;
  }

  interface ConstructorOptions {
    polling?: boolean;
    webhook?: boolean;
  }

  class TelegramBot {
    constructor(token: string, options?: ConstructorOptions);
    onText(regexp: RegExp, callback: (msg: Message, match: RegExpExecArray | null) => void): void;
    sendMessage(chatId: number | string, text: string, options?: SendMessageOptions): Promise<Message>;
  }

  export default TelegramBot;
  export { Message };
}
