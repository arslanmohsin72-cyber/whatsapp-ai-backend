import { Customer } from '../models/Customer.js';
import { Conversation } from '../models/Conversation.js';
import { Booking } from '../models/Booking.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/responseHelper.js';

export const getCustomers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 25 } = req.query;
    const query = { businessId: req.businessId };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { whatsappNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ lastContactAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    return sendPaginated(res, customers, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({ _id: id, businessId: req.businessId });
    if (!customer) {
      return sendError(res, 'Customer not found', 404);
    }

    const [conversation, bookings] = await Promise.all([
      Conversation.findOne({ businessId: req.businessId, customerId: customer._id }),
      Booking.find({ businessId: req.businessId, customerId: customer._id }).sort({ createdAt: -1 })
    ]);

    return sendSuccess(res, {
      customer,
      conversation,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!customer) return sendError(res, 'Customer not found', 404);
    return sendSuccess(res, customer, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOneAndDelete({ _id: id, businessId: req.businessId });
    if (!customer) return sendError(res, 'Customer not found', 404);
    return sendSuccess(res, null, 'Customer deleted');
  } catch (error) {
    next(error);
  }
};

export default { getCustomers, getCustomerById, updateCustomer, deleteCustomer };
