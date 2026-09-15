import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WhatsAppSession } from '../models/WhatsAppSession.js';
import { BaileysWhatsAppConnector } from '../providers/whatsapp/BaileysWhatsAppConnector.js';
import { processIncomingWhatsAppMessage } from '../services/messageProcessor.js';
import socketService from '../services/socketService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SESSION_BASE = path.resolve(__dirname, '../../auth_info_baileys');

export const getSessionStoragePath = () => {
  const configured = process.env.WHATSAPP_SESSION_PATH;
  if (!configured) return DEFAULT_SESSION_BASE;
  return path.isAbsolute(configured) ? configured : path.resolve(__dirname, '../../', configured);
};

// Global connector registry in memory per business
global.whatsappConnectors = global.whatsappConnectors || {};

export const setupConnectorEvents = (connector, businessId) => {
  connector.removeAllListeners('qr');
  connector.removeAllListeners('status');
  connector.removeAllListeners('pairing_code');
  connector.removeAllListeners('message');

  connector.on('qr', (data) => {
    socketService.emitWhatsAppStatus(businessId, {
      status: 'qr_required',
      qrImage: data.qrImage
    });
  });

  connector.on('pairing_code', (data) => {
    socketService.emitWhatsAppStatus(businessId, {
      status: 'pairing_code',
      pairingCode: data.pairingCode,
      phoneNumber: data.phoneNumber
    });
  });

  connector.on('status', (data) => {
    socketService.emitWhatsAppStatus(businessId, data);
  });

  connector.on('message', async (data) => {
    try {
      await processIncomingWhatsAppMessage({
        businessId,
        from: data.from,
        rawFrom: data.rawFrom || data.normalizedJid,
        text: data.text,
        messageId: data.messageId,
        whatsappConnector: connector
      });
    } catch (msgErr) {
      logger.error(`[WhatsApp Event Listener Error] Failed to process message for business ${businessId}:`, msgErr);
    }
  });
};

export const autoStartAllSessions = async () => {
  try {
    const sessionPath = getSessionStoragePath();
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    let businessIdsToBoot = new Set();

    // 1. Discover businesses with saved creds from disk
    if (fs.existsSync(sessionPath)) {
      const entries = fs.readdirSync(sessionPath);
      for (const entry of entries) {
        if (entry.startsWith('business_')) {
          const bId = entry.replace('business_', '').trim();
          const credsPath = path.join(sessionPath, entry, 'creds.json');
          if (bId && fs.existsSync(credsPath)) {
            businessIdsToBoot.add(bId);
          }
        }
      }
    }

    // 2. Cross-reference with DB records
    try {
      const dbSessions = await WhatsAppSession.find({
        status: { $in: ['connected', 'connecting', 'qr_required'] }
      }).lean();

      for (const s of dbSessions) {
        const bId = (s.businessId || '').toString();
        const credsPath = path.join(sessionPath, `business_${bId}`, 'creds.json');
        if (bId && fs.existsSync(credsPath)) {
          businessIdsToBoot.add(bId);
        }
      }
    } catch (dbQueryErr) {
      logger.warn(`Could not query DB for sessions during auto-start: ${dbQueryErr.message}`);
    }

    let restoredCount = 0;
    for (const bIdStr of businessIdsToBoot) {
      if (!global.whatsappConnectors[bIdStr]) {
        logger.info(`[24/7 Background Bot] Booting WhatsApp session for business: ${bIdStr}`);
        const connector = new BaileysWhatsAppConnector(bIdStr, { sessionPath });
        global.whatsappConnectors[bIdStr] = connector;
        setupConnectorEvents(connector, bIdStr);
        restoredCount++;

        connector.initialize().catch((err) => {
          logger.warn(`Auto-start session failed for ${bIdStr}:`, err.message);
        });
      }
    }

    logger.info(`[WhatsApp Engine] Auto-start completed. ${restoredCount} active business session(s) online.`);
  } catch (err) {
    logger.error('Error during autoStartAllSessions:', err);
  }
};

/**
 * 24/7 WhatsApp Self-Healing Health Watchdog
 * Runs periodically to ensure all registered WhatsApp bots stay alive and connected.
 */
let watchdogTimer = null;
export const startWhatsAppWatchdog = (intervalMs = 30000) => {
  if (watchdogTimer) clearInterval(watchdogTimer);

  logger.info(`[24/7 WhatsApp Watchdog] Started (checking every ${intervalMs / 1000}s)`);

  watchdogTimer = setInterval(async () => {
    try {
      const sessionPath = getSessionStoragePath();
      if (!fs.existsSync(sessionPath)) return;

      const entries = fs.readdirSync(sessionPath);
      for (const entry of entries) {
        if (!entry.startsWith('business_')) continue;
        const bIdStr = entry.replace('business_', '').trim();
        const credsPath = path.join(sessionPath, entry, 'creds.json');

        if (bIdStr && fs.existsSync(credsPath)) {
          const currentConnector = global.whatsappConnectors[bIdStr];
          const status = currentConnector ? currentConnector.getStatus() : 'none';
          const isHealthy = currentConnector && typeof currentConnector.isHealthy === 'function' ? currentConnector.isHealthy() : (status === 'connected');

          // If connector does not exist, or is in error/disconnected state, or is a zombie socket:
          if (!currentConnector || status === 'disconnected' || status === 'error' || (status === 'connected' && !isHealthy)) {
            logger.warn(`[24/7 WhatsApp Watchdog] Auto-healing business session: ${bIdStr} (current status: ${status}, healthy: ${isHealthy})`);
            const connector = currentConnector || new BaileysWhatsAppConnector(bIdStr, { sessionPath });
            global.whatsappConnectors[bIdStr] = connector;
            setupConnectorEvents(connector, bIdStr);

            connector.initialize().catch((err) => {
              logger.warn(`[Watchdog Re-init failed for ${bIdStr}]: ${err.message}`);
            });
          }
        }
      }
    } catch (watchdogErr) {
      logger.error('[WhatsApp Watchdog Error]:', watchdogErr);
    }
  }, intervalMs);
};

export const getSessionStatus = async (req, res, next) => {
  try {
    let session = await WhatsAppSession.findOne({ businessId: req.businessId });
    if (!session) {
      session = await WhatsAppSession.create({
        businessId: req.businessId,
        status: 'disconnected'
      });
    }

    const activeConnector = global.whatsappConnectors[req.businessId];
    const liveStatus = activeConnector ? activeConnector.getStatus() : session.status;

    return sendSuccess(res, {
      ...session.toObject(),
      status: liveStatus
    });
  } catch (error) {
    next(error);
  }
};

export const connectWhatsApp = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { forceReset } = req.body || {};

    if (forceReset && global.whatsappConnectors[businessId]) {
      await global.whatsappConnectors[businessId].resetSession();
      delete global.whatsappConnectors[businessId];
    }

    // Check if connector is already running and connected
    if (global.whatsappConnectors[businessId]) {
      const existing = global.whatsappConnectors[businessId];
      if (existing.getStatus() === 'connected') {
        return sendSuccess(res, { status: 'connected' }, 'WhatsApp already connected');
      }
    }

    const connector = new BaileysWhatsAppConnector(businessId);
    global.whatsappConnectors[businessId] = connector;
    setupConnectorEvents(connector, businessId);

    // Start in background without blocking response
    connector.initialize().catch((err) => {
      logger.error(`Error in WhatsApp connector background run for ${businessId}:`, err);
    });

    return sendSuccess(res, { status: 'connecting' }, 'WhatsApp connection initialized. Awaiting QR code.');
  } catch (error) {
    next(error);
  }
};

export const requestPairingCode = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required to generate a pairing code', 400);
    }

    let connector = global.whatsappConnectors[businessId];
    if (!connector) {
      connector = new BaileysWhatsAppConnector(businessId);
      global.whatsappConnectors[businessId] = connector;
      setupConnectorEvents(connector, businessId);
    }

    const result = await connector.requestPairingCode(phoneNumber);
    return sendSuccess(res, result, 'Pairing code generated successfully. Enter this code in WhatsApp on your phone.');
  } catch (error) {
    logger.error(`Failed to request pairing code for business ${req.businessId}:`, error);
    return sendError(res, error.message || 'Failed to generate pairing code', 500);
  }
};

export const resetWhatsAppSession = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const connector = global.whatsappConnectors[businessId];

    if (connector) {
      await connector.resetSession();
      delete global.whatsappConnectors[businessId];
    } else {
      const temp = new BaileysWhatsAppConnector(businessId);
      await temp.resetSession();
    }

    return sendSuccess(res, { status: 'disconnected' }, 'WhatsApp session wiped and reset successfully. You can now reconnect cleanly.');
  } catch (error) {
    next(error);
  }
};

export const disconnectWhatsApp = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const connector = global.whatsappConnectors[businessId];

    if (connector) {
      await connector.disconnect();
      delete global.whatsappConnectors[businessId];
    }

    await WhatsAppSession.findOneAndUpdate(
      { businessId },
      { $set: { status: 'disconnected', qrCodeString: '', pairingCode: '', connectedPhone: '' } }
    );

    socketService.emitWhatsAppStatus(businessId, { status: 'disconnected' });

    return sendSuccess(res, null, 'WhatsApp disconnected successfully');
  } catch (error) {
    next(error);
  }
};

export const simulateIncomingMessage = async (req, res, next) => {
  try {
    const { from, text } = req.body;
    if (!from || !text) {
      return sendError(res, 'Phone number (from) and text are required', 400);
    }

    const result = await processIncomingWhatsAppMessage({
      businessId: req.businessId,
      from: from.replace(/[^0-9]/g, ''),
      text: text.trim(),
      messageId: `sim_${Date.now()}`,
      whatsappConnector: global.whatsappConnectors[req.businessId] || null
    });

    return sendSuccess(res, result, 'Simulation processed successfully');
  } catch (error) {
    next(error);
  }
};

export default {
  getSessionStoragePath,
  autoStartAllSessions,
  startWhatsAppWatchdog,
  getSessionStatus,
  connectWhatsApp,
  requestPairingCode,
  resetWhatsAppSession,
  disconnectWhatsApp,
  simulateIncomingMessage
};
