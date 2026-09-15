import express from 'express';
import { body } from 'express-validator';
import businessController from '../controllers/businessController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.use(authenticate, tenantGuard);

const profileValidation = [
  body('name').optional().trim().notEmpty().withMessage('Business name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email format required')
];

router.get('/', businessController.getProfile);
router.put('/', validate(profileValidation), businessController.updateProfile);

export default router;
