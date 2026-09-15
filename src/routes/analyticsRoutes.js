import express from 'express';
import analyticsController from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/overview', analyticsController.getOverviewMetrics);

export default router;
