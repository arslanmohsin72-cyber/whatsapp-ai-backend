import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    sender: {
      type: String,
      enum: ['customer', 'ai', 'human_agent', 'system'],
      required: true
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'document', 'audio', 'location', 'template'],
      default: 'text'
    },
    text: {
      type: String,
      default: '',
      trim: true
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    isAiGenerated: {
      type: Boolean,
      default: false
    },
    aiMeta: {
      model: String,
      language: String,
      intent: String,
      confidence: Number,
      latencyMs: Number
    },
    whatsappMessageId: {
      type: String,
      default: '',
      index: true
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ businessId: 1, conversationId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;
