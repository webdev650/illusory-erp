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

/**
 * Send an email notification or alert.
 * If SMTP is unconfigured, gracefully skips and logs a debug notice.
 *
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plaintext body
 * @param {string} [options.html] - HTML body
 * @param {Array<object>} [options.attachments] - Optional attachments
 */
export const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  // Go-live safety switch: When automationEnabled is false, do not send outbound emails
  try {
    const { getCompanyPolicy } = await import('./dayStatus.service.js');
    const policy = await getCompanyPolicy();
    if (!policy || policy.automationEnabled === false) {
      logger.info({ to, subject }, 'Go-live safety switch is OFF; outbound email suppressed.');
      return { success: true, skipped: true, reason: 'Automation is OFF (Go-live safety switch is disabled)' };
    }
  } catch (err) {
    return { success: true, skipped: true, reason: 'Automation check suppressed email' };
  }

  const mailer = getTransporter();

  if (!mailer) {
    logger.info(
      { to, subject },
      'SMTP credentials not configured in server/.env; skipping outbound email dispatch.'
    );
    return { success: true, skipped: true, message: 'SMTP not configured' };
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

    logger.info({ messageId: info.messageId, to, subject }, 'Email sent successfully');
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ err: err.message, to, subject }, 'Failed to send outbound email');
    return { success: false, error: err.message };
  }
};

export default {
  sendEmail,
};
