import mongoose from 'mongoose';

const aiSettingsSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['gemini', 'openai', 'claude'],
      default: 'gemini'
    },
    model: {
      type: String,
      default: 'gemini-3.6-flash'
    },
    apiKeyEncrypted: {
      type: String,
      default: '',
      select: false // Never return plain API key
    },
    hasCustomApiKey: {
      type: Boolean,
      default: false
    },
    responseStyle: {
      type: String,
      enum: ['short', 'normal', 'detailed'],
      default: 'short'
    },
    defaultTone: {
      type: String,
      enum: ['friendly', 'professional', 'casual', 'formal'],
      default: 'friendly'
    },
    useEmojis: {
      type: Boolean,
      default: true
    },
    businessOnlyMode: {
      type: Boolean,
      default: true
    },
    humanHandoverEnabled: {
      type: Boolean,
      default: true
    },
    autoDetectLanguage: {
      type: Boolean,
      default: true
    },
    masterKnowledgeBase: {
      type: String,
      default: '',
      maxlength: 30000 // Comprehensive all-in-one business knowledge base
    },
    customInstructions: {
      type: String,
      default: '',
      maxlength: 10000
    },
    welcomeMessage: {
      type: String,
      default: 'Hello! Welcome to our service. How can we help you today?'
    },
    businessOnlyRejectionMessage: {
      type: String,
      default: 'Sorry, I can only help with our services, business information, and bookings.'
    }
  },
  {
    timestamps: true
  }
);

export const AISettings = mongoose.model('AISettings', aiSettingsSchema);
export default AISettings;
