import express from 'express';
import { body } from 'express-validator';
import policyController from '../controllers/policyController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const policyValidation = [
  body('title').trim().notEmpty().withMessage('Policy title is required'),
  body('content').trim().notEmpty().withMessage('Policy content is required'),
  body('policyType').isIn(['cancellation', 'refund', 'warranty', 'payment', 'booking', 'other']).withMessage('Invalid policy type')
];

router.get('/', policyController.getPolicies);
router.post('/', validate(policyValidation), policyController.createPolicy);
router.put('/:id', validate(policyValidation), policyController.updatePolicy);
router.delete('/:id', policyController.deletePolicy);

export default router;
