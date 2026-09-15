import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI is not set. Running in memory / mock database mode until configured.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 25,
      minPoolSize: 2,
      retryWrites: true,
      family: 4,
      autoIndex: true
    });

    isConnected = true;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Reconnecting in 3s...');
      isConnected = false;
      setTimeout(() => {
        if (!isConnected) {
          connectDB();
        }
      }, 3000);
    });

    return true;
  } catch (error) {
    logger.error(`MongoDB Connection Failed: ${error.message}. Retrying in 5s...`);
    isConnected = false;
    setTimeout(connectDB, 5000);
    return false;
  }
};

export const getDBStatus = () => {
  if (mongoose.connection.readyState === 1) return 'connected';
  if (mongoose.connection.readyState === 2) return 'connecting';
  if (mongoose.connection.readyState === 3) return 'disconnecting';
  return 'disconnected';
};

export default { connectDB, getDBStatus };
