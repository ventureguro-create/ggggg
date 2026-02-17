/**
 * Alert Dedup Store
 * 
 * Deduplication and cooldown for alerts.
 * Different rules for twitter vs core alerts.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_alert_dedup';

export interface DedupEntry {
  hash: string;
  account_id: string;
  signal_type: string;
  source: 'twitter' | 'core' | 'mock';
  created_at: Date;
  expires_at: Date;
}

export interface DedupConfig {
  twitter_window_minutes: number;
  core_window_minutes: number;
  hash_includes_confidence: boolean;
}

const DEFAULT_CONFIG: DedupConfig = {
  twitter_window_minutes: 60,   // 1 hour dedup for twitter
  core_window_minutes: 30,       // 30 min for core
  hash_includes_confidence: false,
};

let collection: Collection<DedupEntry> | null = null;
let dedupConfig: DedupConfig = { ...DEFAULT_CONFIG };

export function initDedupStore(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ hash: 1 }, { unique: true });
  collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL
  console.log('[DedupStore] Initialized');
}

export function getDedupConfig(): DedupConfig {
  return { ...dedupConfig };
}

export function updateDedupConfig(updates: Partial<DedupConfig>): DedupConfig {
  dedupConfig = { ...dedupConfig, ...updates };
  return { ...dedupConfig };
}

function generateHash(accountId: string, signalType: string, source: string): string {
  return `${accountId}:${signalType}:${source}`;
}

export async function isDuplicate(
  accountId: string,
  signalType: string,
  source: 'twitter' | 'core' | 'mock'
): Promise<boolean> {
  if (!collection) return false;
  
  const hash = generateHash(accountId, signalType, source);
  const existing = await collection.findOne({ hash, expires_at: { $gt: new Date() } });
  return !!existing;
}

export async function recordAlert(
  accountId: string,
  signalType: string,
  source: 'twitter' | 'core' | 'mock'
): Promise<void> {
  if (!collection) return;
  
  const windowMinutes = source === 'twitter' 
    ? dedupConfig.twitter_window_minutes 
    : dedupConfig.core_window_minutes;
  
  const hash = generateHash(accountId, signalType, source);
  const now = new Date();
  const expires = new Date(now.getTime() + windowMinutes * 60 * 1000);
  
  await collection.updateOne(
    { hash },
    {
      $set: {
        hash,
        account_id: accountId,
        signal_type: signalType,
        source,
        created_at: now,
        expires_at: expires,
      },
    },
    { upsert: true }
  );
}

export async function clearDedup(accountId?: string): Promise<number> {
  if (!collection) return 0;
  
  const filter = accountId ? { account_id: accountId } : {};
  const result = await collection.deleteMany(filter);
  return result.deletedCount;
}

export async function getDedupStats(): Promise<{
  total_entries: number;
  twitter_entries: number;
  core_entries: number;
}> {
  if (!collection) return { total_entries: 0, twitter_entries: 0, core_entries: 0 };
  
  const all = await collection.countDocuments({ expires_at: { $gt: new Date() } });
  const twitter = await collection.countDocuments({ source: 'twitter', expires_at: { $gt: new Date() } });
  const core = await collection.countDocuments({ source: 'core', expires_at: { $gt: new Date() } });
  
  return { total_entries: all, twitter_entries: twitter, core_entries: core };
}
