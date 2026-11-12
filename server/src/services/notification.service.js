import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { sendEmail } from '../utils/mailer.js';

export const notifyUser = async ({ userId, title, message, link = '', type = 'system', email = null }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      link,
      type,
    });

    // If email provided or user lookup requested
    let targetEmail = email;
    if (!targetEmail && userId) {
      const user = await User.findById(userId).select('email');
      targetEmail = user?.email;
    }

    if (targetEmail) {
      await sendEmail({
        to: targetEmail,
        subject: `[Illusory ERP] ${title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #6366f1; margin-top: 0;">Illusory ERP Notification</h2>
            <h3 style="color: #1e293b;">${title}</h3>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">${message}</p>
            ${
              link
                ? `<a href="${process.env.CLIENT_URL || 'http://localhost:5173'}${link}" style="display: inline-block; padding: 10px 18px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px;">View in ERP</a>`
                : ''
            }
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 11px;">Illusory Design Studios Pvt. Ltd. • Bhubaneswar, Odisha</p>
          </div>
        `,
      });
    }

    return notification;
  } catch (err) {
    console.warn(`[Notification Warning] Could not notify user ${userId}:`, err.message);
  }
};
