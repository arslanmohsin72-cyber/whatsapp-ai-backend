import express from 'express';
import workingHoursController from '../controllers/workingHoursController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/', workingHoursController.getWorkingHours);
router.put('/', workingHoursController.updateWorkingHours);

export default router;
