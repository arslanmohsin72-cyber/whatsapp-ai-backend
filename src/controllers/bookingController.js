import { Booking } from '../models/Booking.js';
import { Customer } from '../models/Customer.js';
import { Notification } from '../models/Notification.js';
import socketService from '../services/socketService.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/responseHelper.js';

export const getBookings = async (req, res, next) => {
  try {
    const { status, date, search, page = 1, limit = 25 } = req.query;
    const query = { businessId: req.businessId };

    if (status) query.status = status;
    if (date) query.bookingDate = date;
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { whatsappNumber: { $regex: search, $options: 'i' } },
        { serviceName: { $regex: search, $options: 'i' } },
        { fullAddress: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('customerId', 'name whatsappNumber detectedLanguage')
      .populate('assignedStaff', 'name email')
      .sort({ bookingDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    return sendPaginated(res, bookings, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({ _id: id, businessId: req.businessId })
      .populate('customerId')
      .populate('assignedStaff', 'name email');

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }
    return sendSuccess(res, booking);
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req, res, next) => {
  try {
    let customer = await Customer.findOne({
      businessId: req.businessId,
      whatsappNumber: req.body.whatsappNumber
    });

    if (!customer) {
      customer = await Customer.create({
        businessId: req.businessId,
        name: req.body.customerName || 'Direct Booking',
        whatsappNumber: req.body.whatsappNumber,
        address: req.body.fullAddress || '',
        totalBookings: 1
      });
    } else {
      customer.totalBookings += 1;
      await customer.save();
    }

    const booking = await Booking.create({
      ...req.body,
      businessId: req.businessId,
      customerId: customer._id,
      source: req.body.source || 'dashboard_manual'
    });

    const notification = await Notification.create({
      businessId: req.businessId,
      title: 'New Booking Created',
      message: `Booking created for ${booking.customerName} - ${booking.serviceName}`,
      type: 'booking_created',
      relatedId: booking._id
    });

    socketService.emitBookingUpdate(req.businessId, booking, 'booking:created');
    socketService.emitNotification(req.businessId, notification);

    return sendSuccess(res, booking, 'Booking created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'Invalid booking status', 400);
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: { status, ...(notes ? { notes } : {}) } },
      { new: true }
    );

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    socketService.emitBookingUpdate(req.businessId, booking, 'booking:updated');

    return sendSuccess(res, booking, `Booking status changed to ${status}`);
  } catch (error) {
    next(error);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOneAndUpdate(
      { _id: id, businessId: req.businessId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    socketService.emitBookingUpdate(req.businessId, booking, 'booking:updated');

    return sendSuccess(res, booking, 'Booking updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOneAndDelete({ _id: id, businessId: req.businessId });
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }
    return sendSuccess(res, null, 'Booking deleted successfully');
  } catch (error) {
    next(error);
  }
};

export default { getBookings, getBookingById, createBooking, updateBookingStatus, updateBooking, deleteBooking };
