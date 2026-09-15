import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: 120
    },
    logo: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: '',
      maxlength: 3000
    },
    masterKnowledgeBase: {
      type: String,
      default: '',
      maxlength: 30000 // Full all-in-one business prompt (services, pricing, FAQs, hours, rules, policies)
    },
    phone: {
      type: String,
      default: ''
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    website: {
      type: String,
      default: '',
      trim: true
    },
    address: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    },
    currency: {
      type: String,
      default: 'MYR',
      uppercase: true,
      maxlength: 5
    },
    timezone: {
      type: String,
      default: 'Asia/Kuala_Lumpur'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const Business = mongoose.model('Business', businessSchema);
export default Business;
