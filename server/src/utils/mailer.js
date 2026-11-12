import nodemailer from 'nodemailer';

let transporter = null;

const initTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('📧 SMTP Mailer configured successfully');
    } catch (err) {
      console.warn('⚠️ SMTP Mailer initialization failed:', err.message);
      transporter = null;
    }
  }
};

initTransporter();

/**
 * Sends an email notification if SMTP is configured.
 * Safely skips without crashing if SMTP is unconfigured.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    // Optional SMTP: skip quietly in development
    return { skipped: true, reason: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || '"Illusory ERP" <no-reply@illusorydesignstudios.com>',
      to,
      subject,
      text: text || '',
      html: html || text,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[Mailer Warning] Failed to deliver email to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};
