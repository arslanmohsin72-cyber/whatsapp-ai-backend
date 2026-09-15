import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['booking_created', 'human_requested', 'whatsapp_disconnected', 'ai_error', 'customer_new', 'system'],
      default: 'system'
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ businessId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
