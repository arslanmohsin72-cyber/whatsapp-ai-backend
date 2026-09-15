import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    whatsappNumber: {
      type: String,
      required: [true, 'WhatsApp number is required'],
      trim: true
    },
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true
    },
    serviceCategory: {
      type: String,
      default: 'General'
    },
    unitType: {
      type: String,
      default: 'Standard'
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    bookingDate: {
      type: String, // YYYY-MM-DD
      required: [true, 'Booking date is required']
    },
    preferredTime: {
      type: String, // HH:MM or slot description
      required: [true, 'Preferred time is required']
    },
    alternateTime: {
      type: String,
      default: ''
    },
    fullAddress: {
      type: String,
      required: [true, 'Full address is required'],
      trim: true
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
    notes: {
      type: String,
      default: ''
    },
    customerMessage: {
      type: String,
      default: ''
    },
    estimatedPrice: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'MYR'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
      default: 'pending',
      index: true
    },
    source: {
      type: String,
      enum: ['whatsapp_ai', 'whatsapp_manual', 'dashboard_manual', 'web_form'],
      default: 'whatsapp_ai'
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ businessId: 1, status: 1, bookingDate: 1 });
bookingSchema.index({ businessId: 1, createdAt: -1 });

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
