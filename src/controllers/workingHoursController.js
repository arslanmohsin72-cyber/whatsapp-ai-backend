import { WorkingHours } from '../models/WorkingHours.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getWorkingHours = async (req, res, next) => {
  try {
    let hours = await WorkingHours.findOne({ businessId: req.businessId });
    if (!hours) {
      // Create default if not present
      hours = await WorkingHours.create({ businessId: req.businessId });
    }
    return sendSuccess(res, hours);
  } catch (error) {
    next(error);
  }
};

export const updateWorkingHours = async (req, res, next) => {
  try {
    const { schedule, holidays, timezone, specialNotes } = req.body;

    const hours = await WorkingHours.findOneAndUpdate(
      { businessId: req.businessId },
      { $set: { schedule, holidays, timezone, specialNotes } },
      { new: true, upsert: true, runValidators: true }
    );

    return sendSuccess(res, hours, 'Working hours updated successfully');
  } catch (error) {
    next(error);
  }
};

export default { getWorkingHours, updateWorkingHours };
