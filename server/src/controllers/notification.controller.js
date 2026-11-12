import { Notification } from '../models/Notification.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const listNotifications = async (req, res, next) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return sendSuccess(res, {
      notifications,
      total,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });
    return sendSuccess(res, { unreadCount });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { isRead: true } }
    );
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};
