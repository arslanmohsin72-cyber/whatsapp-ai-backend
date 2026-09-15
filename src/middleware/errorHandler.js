import logger from '../utils/logger.js';
import { sendError } from '../utils/responseHelper.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error at ${req.method} ${req.originalUrl}:`, err);

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return sendError(res, 'Validation Error', 400, messages);
  }

  // Mongoose Duplicate Key Error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `Duplicate entry: '${field}' already exists`, 409);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token expired', 401);
  }

  // CastError (Invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 'Resource not found or invalid ID format', 404);
  }

  // Mongoose Connection / Buffering Timeout Error
  if (err.name === 'MongooseError' && err.message && err.message.includes('buffering timed out')) {
    return sendError(
      res,
      'Database connection timeout: Unable to reach MongoDB cluster. If using MongoDB Atlas, please verify in Atlas Console > Security > Network Access that "0.0.0.0/0" (Allow Access from Anywhere) is enabled.',
      503
    );
  }

  // Generic Safe Error Output
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred. Please try again later.' 
    : (err.message || 'Internal Server Error');

  const statusCode = err.statusCode || 500;
  return sendError(res, message, statusCode);
};

export default errorHandler;
