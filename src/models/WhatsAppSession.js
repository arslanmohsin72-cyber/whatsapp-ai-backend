import mongoose from 'mongoose';

const whatsAppSessionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['disconnected', 'connecting', 'qr_required', 'connected', 'reconnecting', 'error'],
      default: 'disconnected'
    },
    qrCodeString: {
      type: String,
      default: ''
    },
    qrGeneratedAt: {
      type: Date
    },
    connectedPhone: {
      type: String,
      default: ''
    },
    connectedName: {
      type: String,
      default: ''
    },
    platform: {
      type: String,
      default: 'baileys_qr'
    },
    lastConnectedAt: {
      type: Date
    },
    lastDisconnectedAt: {
      type: Date
    },
    lastErrorMessage: {
      type: String,
      default: ''
    },
    pairingCode: {
      type: String,
      default: ''
    },
    pairingPhone: {
      type: String,
      default: ''
    },
    pairingGeneratedAt: {
      type: Date
    },
    autoReconnect: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const WhatsAppSession = mongoose.model('WhatsAppSession', whatsAppSessionSchema);
export default WhatsAppSession;
