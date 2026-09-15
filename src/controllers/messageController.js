import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import socketService from '../services/socketService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

export const getMessagesByConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      businessId: req.businessId,
      conversationId
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(parseInt(limit, 10));

    return sendSuccess(res, messages);
  } catch (error) {
    next(error);
  }
};

export const sendAgentMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return sendError(res, 'Message text is required', 400);
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      businessId: req.businessId
    });

    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    // 1. Create Outbound Message
    const message = await Message.create({
      businessId: req.businessId,
      conversationId: conversation._id,
      customerId: conversation.customerId,
      direction: 'outbound',
      sender: 'human_agent',
      text: text.trim(),
      isAiGenerated: false,
      deliveryStatus: 'sent'
    });

    // 2. Update Conversation
    conversation.lastMessageText = text.trim();
    conversation.lastMessageAt = new Date();
    conversation.lastMessageDirection = 'outbound';
    await conversation.save();

    // 3. Dispatch to WhatsApp Connector if active
    const bIdStr = req.businessId.toString();
    const connector = global.whatsappConnectors && (global.whatsappConnectors[bIdStr] || global.whatsappConnectors[req.businessId]);
    if (connector) {
      const sendRes = await connector.sendMessage(conversation.whatsappNumber, text.trim());
      logger.info(`Agent message dispatched to WhatsApp for ${conversation.whatsappNumber}:`, sendRes);
    } else {
      logger.warn(`Cannot send agent WhatsApp message. No active connector for business ${bIdStr}`);
    }

    // 4. Emit real-time Socket.IO event
    socketService.emitNewMessage(req.businessId, message);
    socketService.emitConversationUpdate(req.businessId, conversation);

    return sendSuccess(res, message, 'Message sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

export default { getMessagesByConversation, sendAgentMessage };
