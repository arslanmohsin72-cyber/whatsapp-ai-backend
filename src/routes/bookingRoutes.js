import express from 'express';
import { body } from 'express-validator';
import bookingController from '../controllers/bookingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const createBookingValidation = [
  body('customerName').trim().notEmpty().withMessage('Customer name is required'),
  body('whatsappNumber').trim().notEmpty().withMessage('WhatsApp number is required'),
  body('serviceName').trim().notEmpty().withMessage('Service name is required'),
  body('bookingDate').notEmpty().withMessage('Booking date is required'),
  body('preferredTime').notEmpty().withMessage('Preferred time is required'),
  body('fullAddress').trim().notEmpty().withMessage('Full address is required')
];

router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/', validate(createBookingValidation), bookingController.createBooking);
router.patch('/:id/status', bookingController.updateBookingStatus);
router.put('/:id', bookingController.updateBooking);
router.delete('/:id', bookingController.deleteBooking);

export default router;
