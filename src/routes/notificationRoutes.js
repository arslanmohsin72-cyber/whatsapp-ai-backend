import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

export default router;
