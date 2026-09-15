import { ServiceArea } from '../models/ServiceArea.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const getServiceAreas = async (req, res, next) => {
  try {
    const areas = await ServiceArea.find({ businessId: req.businessId }).sort({ city: 1, area: 1 });
    return sendSuccess(res, areas);
  } catch (error) {
    next(error);
  }
};

export const createServiceArea = async (req, res, next) => {
  try {
    const area = await ServiceArea.create({
      ...req.body,
      businessId: req.businessId
    });
    return sendSuccess(res, area, 'Service area added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateServiceArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const area = await ServiceArea.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!area) return sendError(res, 'Service area not found', 404);
    return sendSuccess(res, area, 'Service area updated');
  } catch (error) {
    next(error);
  }
};

export const deleteServiceArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const area = await ServiceArea.findOneAndDelete({ _id: id, businessId: req.businessId });
    if (!area) return sendError(res, 'Service area not found', 404);
    return sendSuccess(res, null, 'Service area deleted');
  } catch (error) {
    next(error);
  }
};

export default { getServiceAreas, createServiceArea, updateServiceArea, deleteServiceArea };
