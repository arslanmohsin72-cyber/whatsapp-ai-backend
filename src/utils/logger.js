/**
 * Centralized Logger for WhatsApp AI SaaS Platform
 */
const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta = '') => {
    console.log(`[INFO] [${getTimestamp()}] ${message}`, meta ? (typeof meta === 'object' ? JSON.stringify(meta) : meta) : '');
  },
  warn: (message, meta = '') => {
    console.warn(`[WARN] [${getTimestamp()}] ${message}`, meta ? (typeof meta === 'object' ? JSON.stringify(meta) : meta) : '');
  },
  error: (message, error = '') => {
    console.error(`[ERROR] [${getTimestamp()}] ${message}`, error ? (error.stack || error.message || error) : '');
  },
  debug: (message, meta = '') => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${getTimestamp()}] ${message}`, meta ? (typeof meta === 'object' ? JSON.stringify(meta) : meta) : '');
    }
  },
  audit: (action, businessId, userId, details = {}) => {
    console.log(`[AUDIT] [${getTimestamp()}] Action: ${action} | Business: ${businessId} | User: ${userId}`, JSON.stringify(details));
  }
};

export default logger;
