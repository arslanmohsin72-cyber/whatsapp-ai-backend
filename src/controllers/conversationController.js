import { Conversation } from '../models/Conversation.js';
import { Customer } from '../models/Customer.js';
import { Message } from '../models/Message.js';
import socketService from '../services/socketService.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

export const getConversations = async (req, res, next) => {
  try {
    const { filter = 'all', search, page = 1, limit = 30 } = req.query;
    const query = { businessId: req.businessId };

    if (filter === 'unread') query.unreadCount = { $gt: 0 };
    else if (filter === 'active') query.status = { $in: ['active', 'unread', 'booking_in_progress'] };
    else if (filter === 'booking') query.status = 'booking_in_progress';
    else if (filter === 'human') query.isHumanTakeover = true;
    else if (filter === 'resolved') query.status = 'resolved';

    if (search) {
      const matchedCustomers = await Customer.find({
        businessId: req.businessId,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { whatsappNumber: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const customerIds = matchedCustomers.map((c) => c._id);
      query.$or = [
        { customerId: { $in: customerIds } },
        { whatsappNumber: { $regex: search, $options: 'i' } },
        { lastMessageText: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Conversation.countDocuments(query);
    const conversations = await Conversation.find(query)
      .populate('customerId', 'name whatsappNumber detectedLanguage totalBookings status')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    return sendPaginated(res, conversations, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOne({ _id: id, businessId: req.businessId })
      .populate('customerId')
      .populate('assignedUser', 'name email');

    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    // Reset unread count when opened
    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
      socketService.emitConversationUpdate(req.businessId, conversation);
    }

    return sendSuccess(res, conversation);
  } catch (error) {
    next(error);
  }
};

export const toggleHumanTakeover = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { takeover, reason } = req.body;

    const conversation = await Conversation.findOne({ _id: id, businessId: req.businessId });
    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    conversation.isHumanTakeover = Boolean(takeover);
    conversation.isAiEnabled = !takeover;
    conversation.status = takeover ? 'human_takeover' : 'active';
    if (reason) conversation.humanTakeoverReason = reason;

    await conversation.save();

    logger.info(`Human Takeover for conversation ${id} set to: ${conversation.isHumanTakeover} by User ${req.user.id}`);

    socketService.emitConversationUpdate(req.businessId, conversation);

    return sendSuccess(res, conversation, `Human takeover ${conversation.isHumanTakeover ? 'enabled' : 'disabled'}`);
  } catch (error) {
    next(error);
  }
};

export const resolveConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: { status: 'resolved', isHumanTakeover: false, isAiEnabled: true, unreadCount: 0 } },
      { new: true }
    );

    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    socketService.emitConversationUpdate(req.businessId, conversation);
    return sendSuccess(res, conversation, 'Conversation marked as resolved');
  } catch (error) {
    next(error);
  }
};

export default { getConversations, getConversationById, toggleHumanTakeover, resolveConversation };
