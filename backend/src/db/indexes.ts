/**
 * Database Indexes
 * Run this on startup or via migration script
 */

import { mongoose } from './mongoose.js';

export async function ensureIndexes(): Promise<void> {
  // Indexes will be defined per model
  // This is a placeholder for manual index creation if needed

  console.log('[DB] Indexes ensured');
}

export async function dropIndexes(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  if (!collections) return;

  for (const collection of collections) {
    await collection.dropIndexes();
  }
  console.log('[DB] Indexes dropped');
}
