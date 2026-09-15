import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000
    },
    priceType: {
      type: String,
      enum: ['fixed', 'starting_from', 'range', 'contact_for_price'],
      default: 'fixed'
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
    },
    priceMax: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number, // Duration in minutes
      default: 60
    },
    available: {
      type: Boolean,
      default: true
    },
    serviceAreas: [
      {
        type: String,
        trim: true
      }
    ],
    notes: {
      type: String,
      default: ''
    },
    bookingRequired: {
      type: Boolean,
      default: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast tenant queries
serviceSchema.index({ businessId: 1, active: 1, name: 1 });

export const Service = mongoose.model('Service', serviceSchema);
export default Service;
