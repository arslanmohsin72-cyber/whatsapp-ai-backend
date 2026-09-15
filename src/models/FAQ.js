import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    question: {
      type: String,
      required: [true, 'FAQ question is required'],
      trim: true,
      maxlength: 300
    },
    answer: {
      type: String,
      required: [true, 'FAQ answer is required'],
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      default: 'General',
      trim: true
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

faqSchema.index({ businessId: 1, active: 1, category: 1 });

export const FAQ = mongoose.model('FAQ', faqSchema);
export default FAQ;
