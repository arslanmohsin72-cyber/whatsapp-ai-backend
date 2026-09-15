import { AISettings } from '../models/AISettings.js';
import { GeminiProvider } from '../providers/ai/GeminiProvider.js';
import { getBusinessContext } from '../services/businessContextService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

const aiProvider = new GeminiProvider();

export const getAISettings = async (req, res, next) => {
  try {
    let settings = await AISettings.findOne({ businessId: req.businessId });
    if (!settings) {
      settings = await AISettings.create({
        businessId: req.businessId,
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        responseStyle: 'short',
        defaultTone: 'friendly',
        useEmojis: true,
        businessOnlyMode: true,
        humanHandoverEnabled: true
      });
    }

    const responseData = settings.toObject();
    // Mask API key: never expose raw key to client
    responseData.apiKeyMasked = settings.hasCustomApiKey ? '••••••••••••••••' : '';

    return sendSuccess(res, responseData);
  } catch (error) {
    next(error);
  }
};

export const updateAISettings = async (req, res, next) => {
  try {
    const {
      provider,
      model,
      apiKey,
      responseStyle,
      defaultTone,
      useEmojis,
      businessOnlyMode,
      humanHandoverEnabled,
      masterKnowledgeBase,
      customInstructions,
      welcomeMessage,
      businessOnlyRejectionMessage
    } = req.body;

    const updates = {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(responseStyle ? { responseStyle } : {}),
      ...(defaultTone ? { defaultTone } : {}),
      ...(useEmojis !== undefined ? { useEmojis } : {}),
      ...(businessOnlyMode !== undefined ? { businessOnlyMode } : {}),
      ...(humanHandoverEnabled !== undefined ? { humanHandoverEnabled } : {}),
      ...(masterKnowledgeBase !== undefined ? { masterKnowledgeBase } : {}),
      ...(customInstructions !== undefined ? { customInstructions } : {}),
      ...(welcomeMessage !== undefined ? { welcomeMessage } : {}),
      ...(businessOnlyRejectionMessage !== undefined ? { businessOnlyRejectionMessage } : {})
    };

    if (apiKey && apiKey.trim() && !apiKey.includes('•••')) {
      updates.apiKeyEncrypted = apiKey.trim();
      updates.hasCustomApiKey = true;
    }

    const settings = await AISettings.findOneAndUpdate(
      { businessId: req.businessId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    const responseData = settings.toObject();
    responseData.apiKeyMasked = settings.hasCustomApiKey ? '••••••••••••••••' : '';

    return sendSuccess(res, responseData, 'AI settings updated successfully');
  } catch (error) {
    next(error);
  }
};

export const testConsole = async (req, res, next) => {
  try {
    const { message, conversationDraft = {} } = req.body;
    if (!message || !message.trim()) {
      return sendError(res, 'Test message cannot be empty', 400);
    }

    const businessContext = await getBusinessContext(req.businessId);

    const result = await aiProvider.generateResponse({
      businessContext,
      customerMessage: message.trim(),
      conversationDraft,
      customApiKey: null
    });

    return sendSuccess(res, {
      customerMessage: message.trim(),
      aiReply: result.text,
      language: result.language,
      intent: result.intent,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      bookingDraft: result.bookingDraft || null,
      isRejection: result.isRejection || false,
      triggerHandover: result.triggerHandover || false
    });
  } catch (error) {
    next(error);
  }
};

export default { getAISettings, updateAISettings, testConsole };
