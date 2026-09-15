import mongoose from 'mongoose';

const dayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    isOpen: {
      type: Boolean,
      default: true
    },
    openTime: {
      type: String,
      default: '09:00'
    },
    closeTime: {
      type: String,
      default: '18:00'
    }
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    isClosed: { type: Boolean, default: true }
  },
  { _id: false }
);

const workingHoursSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true
    },
    timezone: {
      type: String,
      default: 'Asia/Kuala_Lumpur'
    },
    schedule: {
      type: [dayScheduleSchema],
      default: [
        { day: 'Monday', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { day: 'Tuesday', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { day: 'Wednesday', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { day: 'Thursday', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { day: 'Friday', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { day: 'Saturday', isOpen: true, openTime: '09:00', closeTime: '15:00' },
        { day: 'Sunday', isOpen: false, openTime: '09:00', closeTime: '18:00' }
      ]
    },
    holidays: [holidaySchema],
    specialNotes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const WorkingHours = mongoose.model('WorkingHours', workingHoursSchema);
export default WorkingHours;
