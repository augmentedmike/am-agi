import nodemailer from 'nodemailer';

export type SmtpSettings = {
  smtp_host: string;
  smtp_port?: string;
  smtp_secure?: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
};

export type SendEmailOpts = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(settings: SmtpSettings, opts: SendEmailOpts): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port) || 587,
    secure: settings.smtp_secure === 'true',
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });

  await transporter.sendMail({
    from: settings.smtp_from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
