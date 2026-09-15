import EventEmitter from 'events';

/**
 * Abstract WhatsAppConnector Class
 * Emits events:
 * - 'qr': (qrString) => void
 * - 'status': ({ status, connectedPhone, connectedName, error }) => void
 * - 'message': ({ from, messageId, text, type, timestamp }) => void
 */
export class WhatsAppConnector extends EventEmitter {
  constructor(businessId, options = {}) {
    super();
    this.businessId = businessId;
    this.options = options;
    this.status = 'disconnected'; // disconnected | connecting | qr_required | connected | reconnecting | error
  }

  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  async sendMessage(to, message) {
    throw new Error('sendMessage() must be implemented');
  }

  getStatus() {
    return this.status;
  }
}

export default WhatsAppConnector;
