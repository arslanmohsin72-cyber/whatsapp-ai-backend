import express from 'express';
import conversationController from '../controllers/conversationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/', conversationController.getConversations);
router.get('/:id', conversationController.getConversationById);
router.patch('/:id/takeover', conversationController.toggleHumanTakeover);
router.patch('/:id/resolve', conversationController.resolveConversation);

export default router;
