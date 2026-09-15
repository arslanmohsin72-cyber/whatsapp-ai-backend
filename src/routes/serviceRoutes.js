import express from 'express';
import { body } from 'express-validator';
import serviceController from '../controllers/serviceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const serviceValidation = [
  body('name').trim().notEmpty().withMessage('Service name is required'),
  body('price').optional().isNumeric().withMessage('Price must be a valid number'),
  body('priceType').optional().isIn(['fixed', 'starting_from', 'range', 'contact_for_price']).withMessage('Invalid price type')
];

router.get('/', serviceController.getServices);
router.post('/', validate(serviceValidation), serviceController.createService);
router.put('/:id', validate(serviceValidation), serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

export default router;
