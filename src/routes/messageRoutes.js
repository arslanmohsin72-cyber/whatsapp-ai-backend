import express from 'express';
import { body } from 'express-validator';
import messageController from '../controllers/messageController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

const sendMessageValidation = [
  body('text').trim().notEmpty().withMessage('Message text is required')
];

router.get('/conversation/:conversationId', messageController.getMessagesByConversation);
router.post('/conversation/:conversationId', validate(sendMessageValidation), messageController.sendAgentMessage);

export default router;
