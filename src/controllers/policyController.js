import { Policy } from '../models/Policy.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getPolicies = async (req, res, next) => {
  try {
    const policies = await Policy.find({ businessId: req.businessId }).sort({ policyType: 1 });
    return sendSuccess(res, policies);
  } catch (error) {
    next(error);
  }
};

export const createPolicy = async (req, res, next) => {
  try {
    const policy = await Policy.create({
      ...req.body,
      businessId: req.businessId
    });
    return sendSuccess(res, policy, 'Policy created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updatePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!policy) return sendError(res, 'Policy not found', 404);
    return sendSuccess(res, policy, 'Policy updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deletePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findOneAndDelete({ _id: id, businessId: req.businessId });
    if (!policy) return sendError(res, 'Policy not found', 404);
    return sendSuccess(res, null, 'Policy deleted');
  } catch (error) {
    next(error);
  }
};

export default { getPolicies, createPolicy, updatePolicy, deletePolicy };
