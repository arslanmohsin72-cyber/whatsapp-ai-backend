import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    area: {
      type: String,
      required: [true, 'Area name is required'],
      trim: true
    },
    postcode: {
      type: String,
      default: '',
      trim: true
    },
    notes: {
      type: String,
      default: ''
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

serviceAreaSchema.index({ businessId: 1, active: 1, city: 1, area: 1 });

export const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);
export default ServiceArea;
