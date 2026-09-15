import { verifyToken } from '../config/jwt.js';
import { sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Authentication token missing', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id || !decoded.businessId) {
      return sendError(res, 'Invalid token payload', 401);
    }

    req.user = decoded;
    req.businessId = decoded.businessId.toString();

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Session expired. Please log in again.', 401);
    }
    logger.warn(`Auth failed: ${error.message}`);
    return sendError(res, 'Invalid authentication token', 401);
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Access forbidden: Insufficient permissions', 403);
    }
    next();
  };
};

export default { authenticate, authorizeRoles };
