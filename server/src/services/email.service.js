import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
};

export const ESSENTIAL_EMAIL_TYPES = [
  'temporary_password',
  'new_account',
  'password_reset',
  'login_security_alert',
  'account_changed',
];

/**
 * Send an email notification or alert.
 * If SMTP is unconfigured, gracefully skips and logs a debug notice.
 *
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plaintext body
 * @param {string} [options.html] - HTML body
 * @param {string} [options.type] - Email category/type
 * @param {boolean} [options.isEssential] - Explicit essential override
 * @param {Array<object>} [options.attachments] - Optional attachments
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  type = null,
  isEssential = false,
  attachments = [],
}) => {
  const isAccountEssential = isEssential || (type && ESSENTIAL_EMAIL_TYPES.includes(type));

  // Go-live safety switch: When automationEnabled is false, do not send outbound emails unless essential
  try {
    const { getCompanyPolicy } = await import('./dayStatus.service.js');
    const policy = await getCompanyPolicy();
    if ((!policy || policy.automationEnabled === false) && !isAccountEssential) {
      logger.info({ to, subject, type }, 'Go-live safety switch is OFF; outbound non-essential email suppressed.');
      return { success: true, skipped: true, reason: 'Automation is OFF (Go-live safety switch is disabled)' };
    }
  } catch (err) {
    if (!isAccountEssential) {
      return { success: true, skipped: true, reason: 'Automation check suppressed email' };
    }
  }

  const mailer = getTransporter();

  if (!mailer) {
    logger.info(
      { to, subject, isAccountEssential, type },
      'SMTP credentials not configured in server/.env; skipping outbound email dispatch.'
    );
    return {
      success: true,
      skipped: true,
      message: 'SMTP not configured',
      isEssential: isAccountEssential,
      type,
    };
  }

  try {
    const from = process.env.FROM_EMAIL || '"Illusory ERP" <notifications@illusorydesignstudios.com>';
    const info = await mailer.sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments,
    });

    logger.info({ messageId: info.messageId, to, subject, isAccountEssential, type }, 'Email sent successfully');
    return { success: true, messageId: info.messageId, isEssential: isAccountEssential, type };
  } catch (err) {
    logger.error({ err: err.message, to, subject, isAccountEssential, type }, 'Failed to send outbound email');
    return { success: false, error: err.message, isEssential: isAccountEssential, type };
  }
};

export default {
  sendEmail,
};
