/**
 * Taxonomy v2 - Store
 * 
 * CRUD operations for taxonomy data
 */

import { Db } from 'mongodb';
import { TaxonomyMembership, TaxonomyGroupKey, TaxonomyRules } from './taxonomy.types.js';
import { DEFAULT_TAXONOMY_RULES } from './taxonomy.constants.js';

let db: Db;

export function initTaxonomyStore(database: Db) {
  db = database;
  ensureIndexes();
}

async function ensureIndexes() {
  try {
    await db.collection('connections_taxonomy_membership').createIndex(
      { accountId: 1, group: 1 },
      { unique: true }
    );
    await db.collection('connections_taxonomy_membership').createIndex({ group: 1, weight: -1 });
    await db.collection('connections_taxonomy_membership').createIndex({ accountId: 1 });
    console.log('[TaxonomyStore] Indexes ensured');
  } catch (err) {
    console.log('[TaxonomyStore] Index creation skipped (may exist)');
  }
}

/**
 * Get or create rules
 */
export async function getOrCreateRules(): Promise<TaxonomyRules> {
  let doc = await db.collection('connections_taxonomy_rules').findOne({ _id: 'default' });
  
  if (!doc) {
    await db.collection('connections_taxonomy_rules').insertOne({
      _id: 'default' as any,
      ...DEFAULT_TAXONOMY_RULES,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    doc = await db.collection('connections_taxonomy_rules').findOne({ _id: 'default' });
  }
  
  return {
    version: doc?.version ?? 1,
    weights: doc?.weights ?? DEFAULT_TAXONOMY_RULES.weights,
    thresholds: doc?.thresholds ?? DEFAULT_TAXONOMY_RULES.thresholds,
  };
}

/**
 * Patch rules
 */
export async function patchRules(patch: Partial<TaxonomyRules>): Promise<TaxonomyRules> {
  const current = await getOrCreateRules();
  
  const updated = {
    version: (current.version ?? 0) + 1,
    weights: { ...current.weights, ...patch.weights },
    thresholds: { ...current.thresholds, ...patch.thresholds },
  };
  
  await db.collection('connections_taxonomy_rules').updateOne(
    { _id: 'default' },
    { $set: { ...updated, updatedAt: new Date() } }
  );
  
  return updated;
}

/**
 * Freeze/unfreeze membership
 */
export async function setMembershipFrozen(
  accountId: string,
  group: TaxonomyGroupKey,
  isFrozen: boolean
): Promise<void> {
  await db.collection('connections_taxonomy_membership').updateOne(
    { accountId, group },
    { $set: { isFrozen, updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Admin override membership
 */
export async function adminOverrideMembership(
  accountId: string,
  group: TaxonomyGroupKey,
  weight: number,
  reasons: string[]
): Promise<void> {
  await db.collection('connections_taxonomy_membership').updateOne(
    { accountId, group },
    {
      $set: {
        weight,
        reasons,
        source: 'ADMIN',
        isFrozen: true, // Admin overrides are frozen by default
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Get stats by group
 */
export async function getTaxonomyStats(): Promise<any[]> {
  return db.collection('connections_taxonomy_membership').aggregate([
    {
      $group: {
        _id: '$group',
        count: { $sum: 1 },
        avgWeight: { $avg: '$weight' },
        maxWeight: { $max: '$weight' },
        frozenCount: { $sum: { $cond: ['$isFrozen', 1, 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();
}
