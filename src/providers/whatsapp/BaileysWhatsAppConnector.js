import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { fileURLToPath } from 'url';
import { WhatsAppConnector } from './WhatsAppConnector.js';
import { WhatsAppSession } from '../../models/WhatsAppSession.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SESSION_BASE = path.resolve(__dirname, '../../../auth_info_baileys');

export class BaileysWhatsAppConnector extends WhatsAppConnector {
  constructor(businessId, options = {}) {
    super(businessId, options);
    const configuredPath = options.sessionPath || process.env.WHATSAPP_SESSION_PATH;
    this.sessionPath = configuredPath
      ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(__dirname, '../../../', configuredPath))
      : DEFAULT_SESSION_BASE;
    this.sock = null;
    this.isReconnecting = false;
    this.requestedPhone = options.requestedPhone || null;
    this.reconnectAttempts = 0;
  }

  async initialize(requestedPhone = null) {
    if (requestedPhone) {
      this.requestedPhone = requestedPhone;
    }

    try {
      this.status = 'connecting';
      await this._updateDBSession({ status: 'connecting' });
      this.emit('status', { status: 'connecting', businessId: this.businessId });

      const businessSessionDir = path.join(this.sessionPath, `business_${this.businessId}`);
      if (!fs.existsSync(businessSessionDir)) {
        fs.mkdirSync(businessSessionDir, { recursive: true });
      }

      const baileysLogger = pino({ level: 'silent' });
      const { state, saveCreds } = await useMultiFileAuthState(businessSessionDir);

      let version = [2, 3000, 1043857760];
      try {
        const vInfo = await fetchLatestBaileysVersion();
        if (vInfo && vInfo.version) {
          version = vInfo.version;
        }
      } catch (vErr) {
        logger.warn(`Could not fetch latest WA version, using default: ${vErr.message}`);
      }

      logger.info(`Starting Baileys Direct WhatsApp Socket for ${this.businessId} (WA Version: ${version.join('.')})`);

      // Clean up previous socket if any
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners('messages.upsert');
          this.sock.ev.removeAllListeners('connection.update');
          this.sock.ev.removeAllListeners('creds.update');
        } catch (_) {}
      }

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        logger: baileysLogger,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 20000,
        qrTimeout: 40000,
        retryRequestDelayMs: 250
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this.requestedPhone) {
          this.status = 'qr_required';
          const qrImage = await qrcode.toDataURL(qr);
          logger.info(`[Baileys WhatsApp QR Generated] for business: ${this.businessId}`);

          await this._updateDBSession({
            status: 'qr_required',
            qrCodeString: qrImage,
            qrGeneratedAt: new Date()
          });

          this.emit('qr', { qr, qrImage, businessId: this.businessId });
          this.emit('status', { status: 'qr_required', qrImage, businessId: this.businessId });
        }

        if (connection === 'close') {
          const rawError = lastDisconnect?.error;
          const statusCode = rawError?.output?.statusCode;
          const errMessage = rawError?.message || '';
          const credsFile = path.join(businessSessionDir, 'creds.json');
          const hasSavedCreds = fs.existsSync(credsFile);
          const isRegistered = Boolean(this.sock?.authState?.creds?.registered) || hasSavedCreds;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || (statusCode === 401 && !hasSavedCreds);

          logger.warn(`[Baileys Disconnected] Business: ${this.businessId}, Status Code: ${statusCode}, Err: "${errMessage}", isRegistered: ${isRegistered}, hasSavedCreds: ${hasSavedCreds}`);

          if (isRegistered && !isLoggedOut) {
            if (!this.isReconnecting) {
              this.isReconnecting = true;
              this.status = 'connecting';
              this.emit('status', { status: 'connecting', businessId: this.businessId });

              this.reconnectAttempts++;
              let delay = 2000;
              if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
                delay = 300;
              } else if (statusCode === DisconnectReason.timedOut || statusCode === DisconnectReason.connectionLost || statusCode === 408 || statusCode === 428) {
                delay = 2000;
              } else if (this.reconnectAttempts > 5) {
                delay = Math.min(20000, 3000 * Math.pow(1.5, this.reconnectAttempts - 5));
              }

              logger.info(`[Baileys 24/7 Autonomous Reconnect] Scheduling reconnection for ${this.businessId} in ${delay}ms (attempt #${this.reconnectAttempts})...`);
              
              setTimeout(async () => {
                try {
                  // Proactive Internet Connectivity Check before opening socket
                  let isOnline = true;
                  try {
                    const dnsPromise = dns.promises.lookup('web.whatsapp.com');
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DNS Timeout')), 2500));
                    await Promise.race([dnsPromise, timeoutPromise]);
                  } catch (_) {
                    try {
                      await dns.promises.lookup('google.com');
                    } catch (netErr) {
                      isOnline = false;
                    }
                  }

                  if (!isOnline) {
                    logger.warn(`[Baileys Network Watcher] Internet connection is temporarily offline. Waiting for network restoration before reconnecting ${this.businessId}...`);
                    // Poll network every 3 seconds until restored
                    const netCheckInterval = setInterval(async () => {
                      try {
                        await dns.promises.lookup('web.whatsapp.com');
                        clearInterval(netCheckInterval);
                        logger.info(`[Baileys Network Watcher] Internet restored! Resuming WhatsApp connection for ${this.businessId}...`);
                        this.isReconnecting = false;
                        this.initialize().catch((err) => {
                          logger.warn(`Auto-reconnect post-restoration failed for ${this.businessId}: ${err.message}`);
                        });
                      } catch (__) {}
                    }, 3000);
                    return;
                  }

                  this.isReconnecting = false;
                  await this.initialize();
                } catch (err) {
                  this.isReconnecting = false;
                  logger.warn(`Auto-reconnect failed for ${this.businessId}: ${err.message}`);
                }
              }, delay);
            }
          } else if (isLoggedOut) {
            this.status = 'disconnected';
            this.reconnectAttempts = 0;
            try {
              fs.rmSync(businessSessionDir, { recursive: true, force: true });
            } catch (_) {}

            await this._updateDBSession({
              status: 'disconnected',
              qrCodeString: '',
              pairingCode: '',
              connectedPhone: '',
              lastDisconnectedAt: new Date(),
              lastErrorMessage: 'Logged out from mobile device'
            });
            this.emit('status', { status: 'disconnected', businessId: this.businessId });
          } else {
            this.status = 'disconnected';
            await this._updateDBSession({
              status: 'disconnected',
              qrCodeString: '',
              pairingCode: ''
            });
            this.emit('status', { status: 'disconnected', businessId: this.businessId });
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          const normalizedMe = jidNormalizedUser(this.sock.user?.id || '');
          const phone = normalizedMe.split('@')[0];
          const name = this.sock.user?.name || 'WhatsApp Business';
          logger.info(`[Baileys WhatsApp Connected 24/7] Business: ${this.businessId} | Phone: +${phone} | User: ${name}`);

          await this._updateDBSession({
            status: 'connected',
            connectedPhone: phone,
            connectedName: name,
            qrCodeString: '',
            pairingCode: '',
            lastConnectedAt: new Date()
          });

          this.emit('status', {
            status: 'connected',
            connectedPhone: phone,
            connectedName: name,
            businessId: this.businessId
          });
        }
      });

      const myNormalizedJid = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : null;
      const myPhone = myNormalizedJid ? myNormalizedJid.split('@')[0].replace(/[^0-9]/g, '') : null;

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          // 1. Skip if no message payload or fromMe is true
          if (!msg.message || msg.key.fromMe) continue;

          // 2. Skip protocol, stub, reactions, cipher sync
          if (msg.message.protocolMessage || msg.message.senderKeyDistributionMessage || msg.message.reactionMessage) continue;

          const rawRemoteJid = msg.key.remoteJid;
          if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us') || rawRemoteJid.endsWith('@newsletter') || rawRemoteJid === 'status@broadcast') continue;

          // Normalize JID to strip multi-device session suffixes (:12, :2)
          const normalizedJid = jidNormalizedUser(rawRemoteJid);
          let cleanPhone = normalizedJid.split('@')[0].replace(/[^0-9]/g, '');

          // 3. Skip if message is from the bot's own connected WhatsApp phone
          if (myPhone && cleanPhone === myPhone) {
            continue;
          }
          if (myNormalizedJid && normalizedJid === myNormalizedJid) {
            continue;
          }

          const messageId = msg.key.id;

          // 4. Skip if this message was dispatched by the bot (outbound self-echo)
          if (messageId && this.recentOutboundIds && this.recentOutboundIds.has(messageId)) {
            logger.info(`[Baileys Filter] Skipping outbound echo message ID: ${messageId}`);
            continue;
          }

          // 5. Skip if this inbound message was already received and processed
          if (messageId && this.processedInboundIds && this.processedInboundIds.has(messageId)) {
            logger.info(`[Baileys Filter] Skipping already processed message ID: ${messageId}`);
            continue;
          }

          if (messageId) {
            if (!this.processedInboundIds) this.processedInboundIds = new Set();
            this.processedInboundIds.add(messageId);
            if (this.processedInboundIds.size > 2000) {
              const firstKey = this.processedInboundIds.values().next().value;
              this.processedInboundIds.delete(firstKey);
            }
          }

          const m = msg.message;
          const messageText = m?.conversation ||
            m?.extendedTextMessage?.text ||
            m?.imageMessage?.caption ||
            m?.videoMessage?.caption ||
            m?.documentMessage?.caption ||
            m?.buttonsResponseMessage?.selectedButtonId ||
            m?.templateButtonReplyMessage?.selectedId ||
            m?.listResponseMessage?.title ||
            m?.interactiveResponseMessage?.body?.text ||
            '';

          if (!messageText.trim()) continue;

          logger.info(`[Baileys Incoming WhatsApp] Business: ${this.businessId} | Phone: +${cleanPhone} | JID: ${normalizedJid} | Text: "${messageText}"`);

          this.emit('message', {
            businessId: this.businessId,
            from: cleanPhone,
            rawFrom: normalizedJid,
            normalizedJid,
            messageId: messageId || `msg_${Date.now()}`,
            text: messageText,
            type: 'text',
            timestamp: new Date(msg.messageTimestamp * 1000 || Date.now()),
            connector: this
          });
        }
      });

    } catch (error) {
      this.status = 'error';
      logger.error(`Baileys Initialization Error for ${this.businessId}:`, error);

      await this._updateDBSession({
        status: 'error',
        lastErrorMessage: error.message
      });

      this.emit('status', { status: 'error', error: error.message, businessId: this.businessId });
    }
  }

  async requestPairingCode(phoneNumber) {
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('03') && cleanPhone.length === 11) {
      cleanPhone = '92' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('01') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = '60' + cleanPhone.slice(1);
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Please provide a valid phone number with country code (e.g., 923001234567 or 601137359420)');
    }

    this.requestedPhone = cleanPhone;

    // If socket is not running, start it
    if (!this.sock) {
      await this.initialize(cleanPhone);
    }

    // Wait for socket to complete initial WebSocket handshake
    await new Promise((r) => setTimeout(r, 2000));

    let rawCode = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
          await this.initialize(cleanPhone);
          await new Promise((r) => setTimeout(r, 2000));
        }

        logger.info(`Requesting WhatsApp MD Pairing Code for +${cleanPhone} (attempt ${attempt}/3)...`);
        rawCode = await this.sock.requestPairingCode(cleanPhone);
        if (rawCode) break;
      } catch (err) {
        lastError = err;
        logger.warn(`Pairing code attempt ${attempt} failed:`, err.message);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!rawCode) {
      throw new Error(lastError?.message || 'Failed to obtain pairing code from WhatsApp. Please try again in a few moments.');
    }

    const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

    await this._updateDBSession({
      pairingCode: formattedCode,
      pairingPhone: cleanPhone,
      pairingGeneratedAt: new Date()
    });

    this.emit('pairing_code', {
      pairingCode: formattedCode,
      phoneNumber: cleanPhone,
      businessId: this.businessId
    });

    return { pairingCode: formattedCode, phoneNumber: cleanPhone };
  }

  async resetSession() {
    if (this.sock) {
      try {
        await this.sock.end(new Error('Reset requested'));
      } catch (_) {}
      this.sock = null;
    }

    const businessSessionDir = path.join(this.sessionPath, `business_${this.businessId}`);
    try {
      if (fs.existsSync(businessSessionDir)) {
        fs.rmSync(businessSessionDir, { recursive: true, force: true });
      }
    } catch (err) {
      logger.warn(`Failed to remove session dir for ${this.businessId}:`, err.message);
    }

    this.status = 'disconnected';
    this.requestedPhone = null;
    await this._updateDBSession({
      status: 'disconnected',
      qrCodeString: '',
      pairingCode: '',
      pairingPhone: '',
      connectedPhone: '',
      connectedName: '',
      lastErrorMessage: ''
    });

    this.emit('status', { status: 'disconnected', businessId: this.businessId });
  }

  async sendMessage(to, text) {
    if (!this.sock) {
      logger.warn(`Cannot send WhatsApp message. Socket is null for business: ${this.businessId}`);
      return { success: false, error: 'WhatsApp client is not running' };
    }

    try {
      const target = (to || '').toString().trim();
      let targetJid;

      if (target.includes('@')) {
        targetJid = jidNormalizedUser(target);
      } else {
        let digits = target.replace(/[^0-9]/g, '');
        if (digits.startsWith('03') && digits.length === 11) {
          digits = '92' + digits.slice(1);
        } else if (digits.startsWith('01') && (digits.length === 10 || digits.length === 11)) {
          digits = '60' + digits.slice(1);
        }
        targetJid = `${digits}@s.whatsapp.net`;
      }

      logger.info(`[WhatsApp Dispatching Outbound] Business ${this.businessId} -> ${targetJid}: "${text}"`);
      const result = await this.sock.sendMessage(targetJid, { text });
      const sentMsgId = result?.key?.id || `sent_${Date.now()}`;

      if (sentMsgId) {
        if (!this.recentOutboundIds) this.recentOutboundIds = new Set();
        this.recentOutboundIds.add(sentMsgId);
        if (this.recentOutboundIds.size > 2000) {
          const firstKey = this.recentOutboundIds.values().next().value;
          this.recentOutboundIds.delete(firstKey);
        }
      }

      logger.info(`[WhatsApp Sent OK] Dispatched to ${targetJid} (MsgID: ${sentMsgId})`);
      return {
        success: true,
        messageId: sentMsgId
      };
    } catch (error) {
      logger.error(`Failed to send WhatsApp message for business ${this.businessId} to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        logger.warn('Error closing Baileys socket:', err);
      }
    }
    this.status = 'disconnected';
    await this._updateDBSession({ status: 'disconnected', qrCodeString: '', pairingCode: '' });
    this.emit('status', { status: 'disconnected', businessId: this.businessId });
  }

  isHealthy() {
    return this.status === 'connected' && Boolean(this.sock) && (this.sock?.ws?.isOpen || Boolean(this.sock?.user?.id));
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

export default BaileysWhatsAppConnector;
