import { Customer } from '../models/Customer.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Booking } from '../models/Booking.js';
import { sendSuccess } from '../utils/responseHelper.js';

export const getOverviewMetrics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const businessId = req.businessId;

    let startDate = new Date(0);
    const now = new Date();

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const dateFilter = { businessId, createdAt: { $gte: startDate } };

    const [
      totalCustomers,
      newCustomersInPeriod,
      activeConversations,
      totalMessages,
      aiReplies,
      totalBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      recentBookings,
      recentConversations
    ] = await Promise.all([
      Customer.countDocuments({ businessId }),
      Customer.countDocuments(dateFilter),
      Conversation.countDocuments({ businessId, status: { $in: ['active', 'unread', 'booking_in_progress'] } }),
      Message.countDocuments(dateFilter),
      Message.countDocuments({ ...dateFilter, isAiGenerated: true }),
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ ...dateFilter, status: 'confirmed' }),
      Booking.countDocuments({ ...dateFilter, status: 'completed' }),
      Booking.countDocuments({ ...dateFilter, status: 'cancelled' }),
      Booking.find({ businessId }).sort({ createdAt: -1 }).limit(5).lean(),
      Conversation.find({ businessId }).populate('customerId', 'name whatsappNumber').sort({ lastMessageAt: -1 }).limit(5).lean()
    ]);

    const conversionRate = totalCustomers > 0 
      ? Number(((totalBookings / totalCustomers) * 100).toFixed(1)) 
      : 0;

    return sendSuccess(res, {
      period,
      metrics: {
        totalCustomers,
        newCustomers: newCustomersInPeriod,
        activeConversations,
        totalMessages,
        aiReplies,
        totalBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        conversionRate
      },
      recentBookings,
      recentConversations
    });
  } catch (error) {
    next(error);
  }
};

export default { getOverviewMetrics };
