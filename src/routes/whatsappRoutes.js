import express from 'express';
import whatsappController from '../controllers/whatsappController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = express.Router();
router.use(authenticate, tenantGuard);

router.get('/status', whatsappController.getSessionStatus);
router.post('/connect', whatsappController.connectWhatsApp);
router.post('/pairing-code', whatsappController.requestPairingCode);
router.post('/reset', whatsappController.resetWhatsAppSession);
router.post('/disconnect', whatsappController.disconnectWhatsApp);
router.post('/simulate', whatsappController.simulateIncomingMessage);

export default router;
