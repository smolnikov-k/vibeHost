declare module 'nodemailer' {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }

  interface MailOptions {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<{ messageId: string }>;
    verify(): Promise<true>;
  }

  function createTransport(options: TransportOptions): Transporter;

  export default { createTransport };
}
