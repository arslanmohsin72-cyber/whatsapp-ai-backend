import express from 'express';
import { body } from 'express-validator';
import faqController from '../controllers/faqController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const faqValidation = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required')
];

router.get('/', faqController.getFAQs);
router.post('/', validate(faqValidation), faqController.createFAQ);
router.put('/:id', validate(faqValidation), faqController.updateFAQ);
router.delete('/:id', faqController.deleteFAQ);

export default router;
