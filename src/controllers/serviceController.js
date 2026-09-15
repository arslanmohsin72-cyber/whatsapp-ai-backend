import { Service } from '../models/Service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/responseHelper.js';

export const getServices = async (req, res, next) => {
  try {
    const { category, search, active, page = 1, limit = 50 } = req.query;
    const query = { businessId: req.businessId };

    if (category) query.category = category;
    if (active !== undefined) query.active = active === 'true';
    if (search) query.name = { $regex: search, $options: 'i' };

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    return sendPaginated(res, services, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const serviceData = {
      ...req.body,
      businessId: req.businessId
    };

    const service = await Service.create(serviceData);
    return sendSuccess(res, service, 'Service created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!service) {
      return sendError(res, 'Service not found or unauthorized', 404);
    }

    return sendSuccess(res, service, 'Service updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findOneAndDelete({ _id: id, businessId: req.businessId });

    if (!service) {
      return sendError(res, 'Service not found or unauthorized', 404);
    }

    return sendSuccess(res, null, 'Service deleted successfully');
  } catch (error) {
    next(error);
  }
};

export default { getServices, createService, updateService, deleteService };
