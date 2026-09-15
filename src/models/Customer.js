import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    whatsappNumber: {
      type: String,
      required: [true, 'WhatsApp number is required'],
      trim: true
    },
    name: {
      type: String,
      default: 'Unknown Customer',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    preferredLanguage: {
      type: String,
      default: 'en'
    },
    detectedLanguage: {
      type: String,
      default: 'English'
    },
    address: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    area: {
      type: String,
      default: ''
    },
    postcode: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'lead', 'customer', 'blocked', 'archived'],
      default: 'active'
    },
    notes: {
      type: String,
      default: ''
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    lastContactAt: {
      type: Date,
      default: Date.now
    },
    lastInboundMessageAt: {
      type: Date,
      default: Date.now
    },
    lastOutboundMessageAt: {
      type: Date,
      default: null
    },
    totalInteractions: {
      type: Number,
      default: 0
    },
    totalBookings: {
      type: Number,
      default: 0
    },
    // Persistent Long-Term Customer Memory Profile across hours, days, or months
    memoryProfile: {
      lastInteractionSummary: {
        type: String,
        default: ''
      },
      preferredServices: [{ type: String, trim: true }],
      airconUnits: [
        {
          hp: String,
          count: { type: Number, default: 1 },
          brand: String,
          location: String
        }
      ],
      mentionedLocations: [{ type: String, trim: true }],
      pendingQuotes: [
        {
          service: String,
          hp: String,
          quantity: { type: Number, default: 1 },
          estimatedPrice: String,
          quotedAt: { type: Date, default: Date.now }
        }
      ],
      keyNotes: {
        type: String,
        default: ''
      }
    }
  },
  {
    timestamps: true
  }
);

customerSchema.index({ businessId: 1, whatsappNumber: 1 }, { unique: true });
customerSchema.index({ businessId: 1, lastContactAt: -1 });

export const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
