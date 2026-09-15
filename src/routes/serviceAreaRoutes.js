import express from 'express';
import { body } from 'express-validator';
import serviceAreaController from '../controllers/serviceAreaController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const areaValidation = [
  body('city').trim().notEmpty().withMessage('City is required'),
  body('area').trim().notEmpty().withMessage('Area name is required')
];

router.get('/', serviceAreaController.getServiceAreas);
router.post('/', validate(areaValidation), serviceAreaController.createServiceArea);
router.put('/:id', validate(areaValidation), serviceAreaController.updateServiceArea);
router.delete('/:id', serviceAreaController.deleteServiceArea);

export default router;
