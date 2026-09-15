import { WhatsAppConnector } from './WhatsAppConnector.js';
import { WhatsAppSession } from '../../models/WhatsAppSession.js';
import logger from '../../utils/logger.js';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';

export class QRWhatsAppConnector extends WhatsAppConnector {
  constructor(businessId, options = {}) {
    super(businessId, options);
    this.sessionPath = options.sessionPath || process.env.WHATSAPP_SESSION_PATH || './auth_info_baileys';
    this.client = null;
    this.isReconnecting = false;
  }

  async initialize() {
    try {
      this.status = 'connecting';
      await this._updateDBSession({ status: 'connecting' });
      this.emit('status', { status: 'connecting', businessId: this.businessId });

      logger.info(`Initializing WhatsApp QR Connector for business: ${this.businessId}`);

      // Dynamic import of whatsapp-web.js to handle environments smoothly
      const wwebjs = await import('whatsapp-web.js');
      const { Client, LocalAuth } = wwebjs.default || wwebjs;

      const businessSessionDir = path.join(this.sessionPath, `business_${this.businessId}`);
      if (!fs.existsSync(businessSessionDir)) {
        fs.mkdirSync(businessSessionDir, { recursive: true });
      }

      // Detect system Chrome or Edge browser executable on Windows/Linux
      const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      const detectedBrowser = candidates.find((p) => p && fs.existsSync(p));
      if (detectedBrowser) {
        logger.info(`Using system browser for WhatsApp QR generation: ${detectedBrowser}`);
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: businessSessionDir
        }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1018944540-alpha.html'
        },
        puppeteer: {
          headless: true,
          executablePath: detectedBrowser || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          ]
        }
      });

      this.client.on('qr', async (qr) => {
        this.status = 'qr_required';
        const qrImage = await qrcode.toDataURL(qr);
        logger.info(`[WhatsApp QR Generated] for business: ${this.businessId}`);

        await this._updateDBSession({
          status: 'qr_required',
          qrCodeString: qrImage,
          qrGeneratedAt: new Date()
        });

        this.emit('qr', { qr, qrImage, businessId: this.businessId });
        this.emit('status', { status: 'qr_required', qrImage, businessId: this.businessId });
      });

      this.client.on('authenticated', async () => {
        logger.info(`[WhatsApp Authenticated] QR Scan Successful for business: ${this.businessId}. Syncing chats...`);
        this.status = 'authenticating';
        await this._updateDBSession({ status: 'authenticating', qrCodeString: '' });
        this.emit('status', { status: 'authenticating', businessId: this.businessId });
      });

      this.client.on('loading_screen', (percent, message) => {
        logger.info(`[WhatsApp Loading] ${percent}% - ${message} for business: ${this.businessId}`);
        this.emit('status', { status: 'authenticating', loadingPercent: percent, loadingMessage: message, businessId: this.businessId });
      });

      this.client.on('ready', async () => {
        this.status = 'connected';
        const phone = this.client.info?.wid?.user || '';
        const name = this.client.info?.pushname || 'WhatsApp Business';
        logger.info(`[WhatsApp Connected] Business: ${this.businessId} | Phone: ${phone}`);

        await this._updateDBSession({
          status: 'connected',
          connectedPhone: phone,
          connectedName: name,
          qrCodeString: '',
          lastConnectedAt: new Date()
        });

        this.emit('status', { status: 'connected', connectedPhone: phone, connectedName: name, businessId: this.businessId });
      });

      this.client.on('message', async (msg) => {
        // Skip broadcast messages / status messages
        if (msg.isStatus || msg.from === 'status@broadcast') return;

        logger.info(`[WhatsApp Incoming] Business: ${this.businessId} | From: ${msg.from} | Text: "${msg.body}"`);

        const cleanPhone = msg.from.replace(/[^0-9]/g, '');

        this.emit('message', {
          businessId: this.businessId,
          from: cleanPhone,
          rawFrom: msg.from,
          messageId: msg.id?.id || `msg_${Date.now()}`,
          text: msg.body || '',
          type: msg.type || 'text',
          timestamp: new Date(msg.timestamp * 1000 || Date.now())
        });
      });

      this.client.on('disconnected', async (reason) => {
        this.status = 'disconnected';
        logger.warn(`[WhatsApp Disconnected] Business: ${this.businessId} | Reason: ${reason}`);

        await this._updateDBSession({
          status: 'disconnected',
          lastDisconnectedAt: new Date(),
          lastErrorMessage: String(reason)
        });

        this.emit('status', { status: 'disconnected', reason, businessId: this.businessId });
      });

      this.client.on('auth_failure', async (msg) => {
        this.status = 'error';
        logger.error(`[WhatsApp Auth Failure] Business: ${this.businessId}: ${msg}`);

        await this._updateDBSession({
          status: 'error',
          lastErrorMessage: `Auth Failure: ${msg}`
        });

        this.emit('status', { status: 'error', error: msg, businessId: this.businessId });
      });

      await this.client.initialize();
    } catch (error) {
      this.status = 'error';
      logger.error(`WhatsApp Connector Initialization Error for ${this.businessId}:`, error);

      await this._updateDBSession({
        status: 'error',
        lastErrorMessage: error.message
      });

      this.emit('status', { status: 'error', error: error.message, businessId: this.businessId });
    }
  }

  async sendMessage(to, text) {
    if (!this.client || this.status !== 'connected') {
      logger.warn(`Cannot send WhatsApp message. Client not connected for business: ${this.businessId}`);
      return { success: false, error: 'WhatsApp client is not connected' };
    }

    try {
      // Format destination phone number to WhatsApp JID format
      const formattedTo = to.includes('@c.us') ? to : `${to.replace(/[^0-9]/g, '')}@c.us`;
      const response = await this.client.sendMessage(formattedTo, text);
      return {
        success: true,
        messageId: response.id?.id || `sent_${Date.now()}`
      };
    } catch (error) {
      logger.error(`Failed to send WhatsApp message for business ${this.businessId} to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        logger.warn('Error destroying WhatsApp client:', err);
      }
    }
    this.status = 'disconnected';
    await this._updateDBSession({ status: 'disconnected' });
    this.emit('status', { status: 'disconnected', businessId: this.businessId });
  }

  async _updateDBSession(updates) {
    try {
      await WhatsAppSession.findOneAndUpdate(
        { businessId: this.businessId },
        { ...updates, businessId: this.businessId },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      logger.error('Error updating WhatsAppSession in DB:', dbErr);
    }
  }
}

export default QRWhatsAppConnector;
