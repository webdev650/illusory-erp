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
 * Whitelist of essential account-related email types that must ALWAYS send
 * even when the go-live safety switch (automationEnabled) is OFF.
 */
export const ESSENTIAL_EMAIL_TYPES = [
  'temporary_password',
  'new_account',
  'password_reset',
  'login_security_alert',
  'account_changed',
];

/**
 * Sends an email notification if SMTP is configured.
 * Safely skips without crashing if SMTP is unconfigured.
 */
export const sendEmail = async ({ to, subject, html, text, type = null, isEssential = false }) => {
  const isAccountEssential = isEssential || (type && ESSENTIAL_EMAIL_TYPES.includes(type));

  // Go-live safety switch: When automationEnabled is false, block all NON-essential outbound emails
  try {
    const { getCompanyPolicy } = await import('../services/dayStatus.service.js');
    const policy = await getCompanyPolicy();
    if ((!policy || policy.automationEnabled === false) && !isAccountEssential) {
      return { success: true, skipped: true, reason: 'Automation is OFF (Go-live safety switch is disabled)' };
    }
  } catch (err) {
    // Policy fetch error fallback: skip email unless essential
    if (!isAccountEssential) {
      return { success: true, skipped: true, reason: 'Automation check skipped email' };
    }
  }

  if (!transporter) {
    // Optional SMTP: skip quietly in development
    return {
      success: true,
      skipped: true,
      reason: 'SMTP not configured',
      isEssential: isAccountEssential,
      type,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || '"Illusory ERP" <no-reply@illusorydesignstudios.com>',
      to,
      subject,
      text: text || '',
      html: html || text,
    });
    return { success: true, messageId: info.messageId, isEssential: isAccountEssential, type };
  } catch (err) {
    console.warn(`[Mailer Warning] Failed to deliver email to ${to}: ${err.message}`);
    return { success: false, error: err.message, isEssential: isAccountEssential, type };
  }
};

