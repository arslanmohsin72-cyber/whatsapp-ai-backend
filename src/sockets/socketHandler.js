import { verifyToken } from '../config/jwt.js';
import socketService from '../services/socketService.js';
import logger from '../utils/logger.js';

export const setupSocketIO = (io) => {
  socketService.setSocketIO(io);

  // Authentication Middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      logger.warn(`Socket connection rejected: No token provided from IP: ${socket.handshake.address}`);
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = verifyToken(token);
      if (!decoded || !decoded.businessId) {
        return next(new Error('Authentication error: Invalid token payload'));
      }

      socket.user = decoded;
      socket.businessId = decoded.businessId.toString();
      next();
    } catch (err) {
      logger.warn(`Socket auth failure: ${err.message}`);
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const businessRoom = `business_${socket.businessId}`;
    socket.join(businessRoom);
    logger.info(`[Socket Connected] User ${socket.user.id} joined room: ${businessRoom}`);

    // Join specific conversation room if requested
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
      logger.debug(`Socket ${socket.id} joined conv_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // Handle typing status
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv_${conversationId}`).emit('typing_status', {
        conversationId,
        isTyping,
        user: socket.user.name || 'Agent'
      });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket Disconnected] User ${socket.user?.id} from room: ${businessRoom} (${reason})`);
    });
  });
};

export default setupSocketIO;
