import { Business } from '../models/Business.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getProfile = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId);
    if (!business) {
      return sendError(res, 'Business not found', 404);
    }
    return sendSuccess(res, business);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'name', 'logo', 'description', 'masterKnowledgeBase', 'phone', 'whatsappNumber',
      'email', 'website', 'address', 'city', 'country', 'currency', 'timezone'
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!business) {
      return sendError(res, 'Business not found', 404);
    }

    return sendSuccess(res, business, 'Business profile updated successfully');
  } catch (error) {
    next(error);
  }
};

export default { getProfile, updateProfile };
