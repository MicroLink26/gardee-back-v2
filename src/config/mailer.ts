import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: 'ssl0.ovh.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? 'Gardee <noreply@gardee.fr>',
    to,
    subject,
    html,
    headers: {
      'Reply-To': 'info@gardee.fr',
      'X-Mailer': 'Gardee',
      'X-Priority': '3',
      'Importance': 'normal',
      'X-MSMail-Priority': 'Normal',
    },
  });
}
