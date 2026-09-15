import { Customer } from '../models/Customer.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Booking } from '../models/Booking.js';
import { Notification } from '../models/Notification.js';
import { WhatsAppSession } from '../models/WhatsAppSession.js';
import { getBusinessContext } from './businessContextService.js';
import { GeminiProvider } from '../providers/ai/GeminiProvider.js';
import { formatTimeGap, extractCustomerInsights, buildCustomerMemoryContext } from './customerMemoryService.js';
import socketService from './socketService.js';
import logger from '../utils/logger.js';

const aiProvider = new GeminiProvider();

/**
 * Main Message Processor Hub
 * Handles the end-to-end lifecycle of an incoming WhatsApp message with Long-Term Chat Memory
 */
export const processIncomingWhatsAppMessage = async ({ businessId, from, rawFrom = null, text, messageId, whatsappConnector = null }) => {
  try {
    const cleanFrom = (from || '').toString().replace(/[^0-9]/g, '');
    if (!cleanFrom || !text || !text.trim()) {
      return { success: false, reason: 'empty_payload' };
    }

    // 0. Deduplication check: Do not re-process the exact same WhatsApp message ID
    if (messageId) {
      const existingMessage = await Message.findOne({
        businessId,
        whatsappMessageId: messageId
      });
      if (existingMessage) {
        logger.info(`[Deduplication] Message ${messageId} already processed in DB. Skipping.`);
        return { success: true, duplicate: true };
      }
    }

    // 0.1 Self-message protection: Do not process messages from the business's own connected phone
    const session = await WhatsAppSession.findOne({ businessId }).lean();
    if (session && session.connectedPhone) {
      const cleanConnected = session.connectedPhone.replace(/[^0-9]/g, '');
      if (cleanConnected && cleanFrom === cleanConnected) {
        logger.info(`[Self-Filter] Skipping message from business own connected phone (+${cleanFrom})`);
        return { success: true, skipped: true, reason: 'self_message' };
      }
    }

    logger.info(`Processing WhatsApp message for business ${businessId} from ${cleanFrom} (Raw: ${rawFrom || cleanFrom}): "${text}"`);

    // 1. Find or create Customer with Memory Profile
    let customer = await Customer.findOne({ businessId, whatsappNumber: cleanFrom });
    const isFirstTime = !customer;
    const previousLastContact = customer ? (customer.lastInboundMessageAt || customer.lastContactAt) : null;
    const timeGapStr = formatTimeGap(previousLastContact);

    if (!customer) {
      customer = await Customer.create({
        businessId,
        whatsappNumber: cleanFrom,
        name: `Customer +${cleanFrom}`,
        lastContactAt: new Date(),
        lastInboundMessageAt: new Date(),
        totalInteractions: 1,
        memoryProfile: extractCustomerInsights(text, {})
      });
      
      // Emit notification for new customer
      const newCustNotification = await Notification.create({
        businessId,
        title: 'New Customer',
        message: `New customer message received from +${cleanFrom}`,
        type: 'customer_new',
        relatedId: customer._id
      });
      socketService.emitNotification(businessId, newCustNotification);
    } else {
      customer.lastContactAt = new Date();
      customer.lastInboundMessageAt = new Date();
      customer.totalInteractions = (customer.totalInteractions || 0) + 1;
      customer.memoryProfile = extractCustomerInsights(text, customer.memoryProfile || {});
      await customer.save();
    }

    // 2. Find or create active Conversation
    let conversation = await Conversation.findOne({ businessId, customerId: customer._id });
    const nowTime = new Date();
    const timeDiffMs = previousLastContact ? Math.max(0, nowTime.getTime() - new Date(previousLastContact).getTime()) : 0;

    if (!conversation) {
      conversation = await Conversation.create({
        businessId,
        customerId: customer._id,
        whatsappNumber: cleanFrom,
        status: 'unread',
        lastMessageText: text,
        lastMessageAt: nowTime,
        lastInboundAt: nowTime,
        lastMessageDirection: 'inbound',
        unreadCount: 1,
        timeSinceLastMessageMs: timeDiffMs
      });
    } else {
      conversation.lastMessageText = text;
      conversation.lastMessageAt = nowTime;
      conversation.lastInboundAt = nowTime;
      conversation.lastMessageDirection = 'inbound';
      conversation.unreadCount += 1;
      conversation.timeSinceLastMessageMs = timeDiffMs;
      await conversation.save();
    }

    // 3. Save incoming customer message
    const inboundMessage = await Message.create({
      businessId,
      conversationId: conversation._id,
      customerId: customer._id,
      direction: 'inbound',
      sender: 'customer',
      text,
      whatsappMessageId: messageId,
      deliveryStatus: 'delivered'
    });

    // Real-time broadcast to dashboard
    socketService.emitNewMessage(businessId, inboundMessage);
    socketService.emitConversationUpdate(businessId, conversation);

    // 4. Check Human Takeover / AI Disabled Status
    if (conversation.isHumanTakeover || !conversation.isAiEnabled) {
      logger.info(`Human takeover active for conversation ${conversation._id}. Skipping automated AI reply.`);
      return { success: true, aiReplied: false, reason: 'human_takeover' };
    }

    // 5. Load Business Context & Knowledge Base
    const businessContext = await getBusinessContext(businessId);

    // 5.1 Fetch chronological conversation history (up to 16 messages) so AI knows ongoing and past context
    const recentMessages = await Message.find({ 
      conversationId: conversation._id,
      _id: { $ne: inboundMessage._id }
    })
      .sort({ createdAt: -1 })
      .limit(16)
      .lean();

    const messageHistory = recentMessages.reverse().map((m) => ({
      role: m.sender === 'customer' ? 'user' : 'assistant',
      text: m.text,
      time: m.createdAt
    }));

    // 5.2 Build structured Long-Term Memory Context
    const customerMemoryContext = buildCustomerMemoryContext({
      customer,
      conversation,
      timeSinceLastContactStr: timeGapStr,
      messageHistory
    });

    // 6. Generate AI Response via Gemini with Full Memory Integration
    const aiResult = await aiProvider.generateResponse({
      businessContext,
      customerMessage: text,
      conversationDraft: conversation.bookingDraft || {},
      messageHistory,
      customerMemoryContext,
      customerProfile: customer.memoryProfile || {},
      timeSinceLastContactStr: timeGapStr,
      customApiKey: null
    });

    logger.info(`AI generated response for ${cleanFrom}: "${aiResult.text}" (Intent: ${aiResult.intent}, Lang: ${aiResult.language})`);

    // Update customer's detected language
    if (aiResult.language && customer.detectedLanguage !== aiResult.language) {
      customer.detectedLanguage = aiResult.language;
      await customer.save();
    }

    // 7. Handle Human Handover Trigger
    if (aiResult.triggerHandover) {
      conversation.isHumanTakeover = true;
      conversation.status = 'human_takeover';
      conversation.humanTakeoverReason = 'Customer requested human assistance';
      await conversation.save();

      const takeoverNotification = await Notification.create({
        businessId,
        title: 'Human Handover Requested',
        message: `Customer +${cleanFrom} requested human support.`,
        type: 'human_requested',
        relatedId: conversation._id
      });
      socketService.emitNotification(businessId, takeoverNotification);
    }

    // 8. Handle Booking Draft Updates and Completion
    if (aiResult.bookingDraft) {
      conversation.bookingDraft = aiResult.bookingDraft;
      
      // If booking draft is complete, create the actual Booking record!
      if (aiResult.bookingDraft.isComplete) {
        const newBooking = await Booking.create({
          businessId,
          customerId: customer._id,
          conversationId: conversation._id,
          customerName: customer.name,
          whatsappNumber: cleanFrom,
          serviceName: aiResult.bookingDraft.service || 'General Service',
          unitType: aiResult.bookingDraft.unitType || 'Standard',
          quantity: aiResult.bookingDraft.quantity || 1,
          bookingDate: aiResult.bookingDraft.date,
          preferredTime: aiResult.bookingDraft.time,
          fullAddress: aiResult.bookingDraft.address,
          city: customer.city || '',
          area: customer.area || '',
          status: 'pending',
          source: 'whatsapp_ai'
        });

        customer.totalBookings += 1;
        await customer.save();

        conversation.status = 'booking_in_progress';
        await conversation.save();

        const bookingNotification = await Notification.create({
          businessId,
          title: 'New Booking Request',
          message: `New booking received from ${customer.name} for ${newBooking.serviceName} on ${newBooking.bookingDate}`,
          type: 'booking_created',
          relatedId: newBooking._id
        });

        socketService.emitBookingUpdate(businessId, newBooking, 'booking:created');
        socketService.emitNotification(businessId, bookingNotification);
      } else {
        await conversation.save();
      }
    }

    // 9. Send reply through WhatsApp Connector
    let connector = whatsappConnector;
    const bIdStr = businessId.toString();

    if (!connector && global.whatsappConnectors) {
      connector = global.whatsappConnectors[bIdStr] || global.whatsappConnectors[businessId];
    }

    let sentMsgId = null;
    if (connector) {
      const targetRecipient = rawFrom || cleanFrom;
      const sendRes = await connector.sendMessage(targetRecipient, aiResult.text);
      if (sendRes && !sendRes.success) {
        logger.warn(`WhatsApp dispatch returned failure for ${targetRecipient}: ${sendRes.error}`);
      } else {
        sentMsgId = sendRes?.messageId;
        logger.info(`WhatsApp reply successfully delivered to ${targetRecipient}`);
      }
    } else {
      logger.warn(`No active WhatsApp connector found for business ${bIdStr} to send reply to ${cleanFrom}`);
    }

    // 10. Save AI Response in Database
    const outboundMessage = await Message.create({
      businessId,
      conversationId: conversation._id,
      customerId: customer._id,
      direction: 'outbound',
      sender: 'ai',
      text: aiResult.text,
      isAiGenerated: true,
      whatsappMessageId: sentMsgId || `ai_${Date.now()}`,
      aiMeta: {
        model: businessContext.aiSettings?.model || 'gemini-3.6-flash',
        language: aiResult.language,
        intent: aiResult.intent,
        confidence: aiResult.confidence,
        latencyMs: aiResult.latencyMs
      },
      deliveryStatus: 'sent'
    });

    // Update conversation metadata
    conversation.lastMessageText = aiResult.text;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageDirection = 'outbound';
    await conversation.save();

    // 11. Broadcast AI reply to dashboard in real-time
    socketService.emitNewMessage(businessId, outboundMessage);
    socketService.emitConversationUpdate(businessId, conversation);

    return {
      success: true,
      aiReplied: true,
      replyText: aiResult.text,
      intent: aiResult.intent,
      language: aiResult.language
    };
  } catch (error) {
    logger.error(`Error processing WhatsApp message for business ${businessId}:`, error);
    return { success: false, error: error.message };
  }
};

export default { processIncomingWhatsAppMessage };
