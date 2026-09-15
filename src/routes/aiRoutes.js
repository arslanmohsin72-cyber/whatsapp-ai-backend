import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/settings', aiController.getAISettings);
router.put('/settings', aiController.updateAISettings);
router.post('/test', aiLimiter, aiController.testConsole);

export default router;
