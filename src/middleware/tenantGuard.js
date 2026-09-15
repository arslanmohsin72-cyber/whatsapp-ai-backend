import { sendError } from '../utils/responseHelper.js';
import logger from '../utils/logger.js';

/**
 * Strict Multi-Tenant Isolation Guard
 * Enforces that every request is strictly bound to the authenticated user's businessId.
 * Prevents URL parameter, query parameter, or JSON body tampering across businesses.
 */
export const tenantGuard = (req, res, next) => {
  if (!req.businessId) {
    logger.error('Security Breach Attempt / Misconfigured Route: req.businessId missing in tenantGuard');
    return sendError(res, 'Tenant context missing. Access denied.', 403);
  }

  // If request contains an explicit businessId, verify that it matches authenticated businessId
  const explicitBusinessId = req.params.businessId || req.query.businessId || req.body?.businessId;
  if (explicitBusinessId && explicitBusinessId.toString() !== req.businessId.toString()) {
    logger.warn(`Cross-tenant tampering attempt detected! Auth Tenant: ${req.businessId}, Attempted: ${explicitBusinessId} from IP: ${req.ip}`);
    return sendError(res, 'Cross-tenant data access strictly prohibited', 403);
  }

  // Force businessId in body to match authenticated tenant
  if (req.body && typeof req.body === 'object') {
    req.body.businessId = req.businessId;
  }

  // Attach standard tenant filter for Mongoose queries
  req.tenantFilter = { businessId: req.businessId };

  next();
};

export default tenantGuard;
