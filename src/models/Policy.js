import mongoose from 'mongoose';

const policySchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Policy title is required'],
      trim: true
    },
    policyType: {
      type: String,
      enum: ['cancellation', 'refund', 'warranty', 'payment', 'booking', 'other'],
      default: 'other'
    },
    content: {
      type: String,
      required: [true, 'Policy content is required'],
      trim: true,
      maxlength: 3000
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

policySchema.index({ businessId: 1, active: 1, policyType: 1 });

export const Policy = mongoose.model('Policy', policySchema);
export default Policy;
