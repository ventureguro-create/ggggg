/**
 * Connections Module - Database Utilities
 * 
 * Provides safe access to module collections with namespace enforcement.
 */

import type { Collection, Db, Document } from 'mongodb';
import { getConnectionsDb } from '../module.js';
import { COLLECTIONS, LEGACY_TO_NEW_COLLECTIONS } from '../config/connections.config.js';

// ============================================
// COLLECTION ACCESS
// ============================================

/**
 * Get a namespaced collection from the module database.
 * Only allows access to collections defined in COLLECTIONS constant.
 */
export function getCollection<T extends Document = Document>(
  collectionKey: keyof typeof COLLECTIONS
): Collection<T> | null {
  const db = getConnectionsDb();
  if (!db) {
    console.warn(`[Connections] Cannot get collection '${collectionKey}' - no database connection`);
    return null;
  }
  
  const collectionName = COLLECTIONS[collectionKey];
  return db.collection<T>(collectionName);
}

/**
 * Get raw collection by name (for backward compatibility).
 * Automatically maps legacy names to new namespaced names.
 */
export function getCollectionByName<T extends Document = Document>(
  name: string
): Collection<T> | null {
  const db = getConnectionsDb();
  if (!db) {
    console.warn(`[Connections] Cannot get collection '${name}' - no database connection`);
    return null;
  }
  
  // Check if it's a legacy name that needs mapping
  const mappedName = LEGACY_TO_NEW_COLLECTIONS[name] || name;
  
  // Warn if using non-namespaced collection
  if (!mappedName.startsWith('connections_')) {
    console.warn(`[Connections] Accessing non-namespaced collection '${name}' - consider using COLLECTIONS constant`);
  }
  
  return db.collection<T>(mappedName);
}

// ============================================
// MIGRATION UTILITIES
// ============================================

/**
 * Migrate data from legacy collection to namespaced collection.
 */
export async function migrateCollection(
  legacyName: string,
  options: { dropLegacy?: boolean; batchSize?: number } = {}
): Promise<{ migrated: number; errors: number }> {
  const db = getConnectionsDb();
  if (!db) {
    throw new Error('No database connection');
  }
  
  const newName = LEGACY_TO_NEW_COLLECTIONS[legacyName];
  if (!newName) {
    throw new Error(`No mapping found for legacy collection '${legacyName}'`);
  }
  
  const { dropLegacy = false, batchSize = 1000 } = options;
  
  console.log(`[Migration] Migrating ${legacyName} → ${newName}...`);
  
  const legacyCol = db.collection(legacyName);
  const newCol = db.collection(newName);
  
  let migrated = 0;
  let errors = 0;
  
  const cursor = legacyCol.find({}).batchSize(batchSize);
  
  const batch: Document[] = [];
  
  for await (const doc of cursor) {
    batch.push(doc);
    
    if (batch.length >= batchSize) {
      try {
        await newCol.insertMany(batch, { ordered: false });
        migrated += batch.length;
      } catch (err: any) {
        // Handle duplicate key errors
        if (err.code === 11000) {
          migrated += batch.length - (err.writeErrors?.length || 0);
          errors += err.writeErrors?.length || 0;
        } else {
          throw err;
        }
      }
      batch.length = 0;
    }
  }
  
  // Insert remaining
  if (batch.length > 0) {
    try {
      await newCol.insertMany(batch, { ordered: false });
      migrated += batch.length;
    } catch (err: any) {
      if (err.code === 11000) {
        migrated += batch.length - (err.writeErrors?.length || 0);
        errors += err.writeErrors?.length || 0;
      } else {
        throw err;
      }
    }
  }
  
  if (dropLegacy) {
    await legacyCol.drop().catch(() => {});
    console.log(`[Migration] Dropped legacy collection ${legacyName}`);
  }
  
  console.log(`[Migration] Complete: ${migrated} migrated, ${errors} errors`);
  
  return { migrated, errors };
}

/**
 * Migrate all legacy collections
 */
export async function migrateAllCollections(
  options: { dropLegacy?: boolean } = {}
): Promise<void> {
  const legacyNames = Object.keys(LEGACY_TO_NEW_COLLECTIONS);
  
  console.log(`[Migration] Starting migration of ${legacyNames.length} collections...`);
  
  for (const legacyName of legacyNames) {
    try {
      await migrateCollection(legacyName, options);
    } catch (err) {
      console.error(`[Migration] Failed to migrate ${legacyName}:`, err);
    }
  }
  
  console.log('[Migration] All migrations complete');
}

// ============================================
// HELPER: Safe DB wrapper
// ============================================

/**
 * Execute a database operation with safe error handling.
 */
export async function withDb<T>(
  operation: (db: Db) => Promise<T>,
  fallback: T
): Promise<T> {
  const db = getConnectionsDb();
  if (!db) {
    console.warn('[Connections] Database not available, returning fallback');
    return fallback;
  }
  
  try {
    return await operation(db);
  } catch (err) {
    console.error('[Connections] Database operation failed:', err);
    return fallback;
  }
}
