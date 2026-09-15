import { Notification } from '../models/Notification.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ businessId: req.businessId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ businessId: req.businessId, isRead: false });

    return sendSuccess(res, {
      notifications,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) return sendError(res, 'Notification not found', 404);
    return sendSuccess(res, notification);
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ businessId: req.businessId, isRead: false }, { $set: { isRead: true } });
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

export default { getNotifications, markAsRead, markAllAsRead };
