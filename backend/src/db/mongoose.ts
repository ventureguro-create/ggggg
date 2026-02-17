import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { env } from '../config/env.js';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('[MongoDB] Disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: false, // Prevent duplicate index warnings
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

/**
 * Get native MongoDB Db instance for raw operations
 */
export function getMongoDb(): Db {
  const connection = mongoose.connection;
  if (!connection || connection.readyState !== 1) {
    throw new Error('MongoDB not connected');
  }
  return connection.db as Db;
}

export { mongoose };
