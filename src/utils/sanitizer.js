/**
 * Data Sanitizer to prevent NoSQL injection (removes keys starting with $ or containing .)
 */
export const sanitizeData = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Strip leading $ or forbidden Mongo operators
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    sanitized[key] = sanitizeData(value);
  }
  return sanitized;
};

export const sanitizeMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeData(req.body);
  if (req.query) req.query = sanitizeData(req.query);
  if (req.params) req.params = sanitizeData(req.params);
  next();
};

export default { sanitizeData, sanitizeMiddleware };
