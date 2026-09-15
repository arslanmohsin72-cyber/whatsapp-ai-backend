import logger from '../utils/logger.js';

let ioInstance = null;

export const setSocketIO = (io) => {
  ioInstance = io;
};

export const getSocketIO = () => {
  return ioInstance;
};

/**
 * Emit an event strictly to the tenant's isolated Socket room
 */
export const emitToBusiness = (businessId, event, data) => {
  if (!ioInstance) return;
  const roomName = `business_${businessId}`;
  ioInstance.to(roomName).emit(event, data);
  logger.debug(`[Socket.IO Emitted] Room: ${roomName} | Event: ${event}`);
};

export const emitNewMessage = (businessId, message) => {
  emitToBusiness(businessId, 'message:new', message);
};

export const emitConversationUpdate = (businessId, conversation) => {
  emitToBusiness(businessId, 'conversation:updated', conversation);
};

export const emitBookingUpdate = (businessId, booking, type = 'booking:updated') => {
  emitToBusiness(businessId, type, booking);
};

export const emitWhatsAppStatus = (businessId, statusData) => {
  emitToBusiness(businessId, 'whatsapp:status', statusData);
};

export const emitNotification = (businessId, notification) => {
  emitToBusiness(businessId, 'notification:new', notification);
};

export default {
  setSocketIO,
  getSocketIO,
  emitToBusiness,
  emitNewMessage,
  emitConversationUpdate,
  emitBookingUpdate,
  emitWhatsAppStatus,
  emitNotification
};
