/**
 * Pilot Accounts Store
 * 
 * Manages pilot account list, limits, and status.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_pilot_accounts';

export interface PilotAccount {
  account_id: string;
  username?: string;
  added_at: Date;
  added_by: string;
  alerts_today: number;
  alerts_total: number;
  last_alert_at?: Date;
}

export interface PilotConfig {
  status: 'ACTIVE' | 'PAUSED';
  max_alerts_per_day: number;
  max_alerts_per_account_per_day: number;
  cooldown_minutes: number;
}

const DEFAULT_CONFIG: PilotConfig = {
  status: 'ACTIVE',
  max_alerts_per_day: 50,
  max_alerts_per_account_per_day: 5,
  cooldown_minutes: 30,
};

let collection: Collection<PilotAccount> | null = null;
let pilotConfig: PilotConfig = { ...DEFAULT_CONFIG };

export function initPilotAccountsStore(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ account_id: 1 }, { unique: true });
  console.log('[PilotAccountsStore] Initialized');
}

export function getPilotConfig(): PilotConfig {
  return { ...pilotConfig };
}

export function updatePilotConfig(updates: Partial<PilotConfig>): PilotConfig {
  pilotConfig = { ...pilotConfig, ...updates };
  return { ...pilotConfig };
}

export async function isPilotAccount(accountId: string): Promise<boolean> {
  if (!collection) return false;
  const doc = await collection.findOne({ account_id: accountId });
  return !!doc;
}

export async function addPilotAccount(accountId: string, username: string, addedBy: string): Promise<void> {
  if (!collection) return;
  await collection.updateOne(
    { account_id: accountId },
    {
      $setOnInsert: {
        account_id: accountId,
        username,
        added_at: new Date(),
        added_by: addedBy,
        alerts_today: 0,
        alerts_total: 0,
      },
    },
    { upsert: true }
  );
}

export async function removePilotAccount(accountId: string): Promise<void> {
  if (!collection) return;
  await collection.deleteOne({ account_id: accountId });
}

export async function getPilotAccounts(): Promise<PilotAccount[]> {
  if (!collection) return [];
  return collection.find().toArray();
}

export async function incrementAlertCount(accountId: string): Promise<void> {
  if (!collection) return;
  await collection.updateOne(
    { account_id: accountId },
    {
      $inc: { alerts_today: 1, alerts_total: 1 },
      $set: { last_alert_at: new Date() },
    }
  );
}

export async function resetDailyCounters(): Promise<void> {
  if (!collection) return;
  await collection.updateMany({}, { $set: { alerts_today: 0 } });
}

export async function isWithinLimits(accountId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!collection) return { allowed: false, reason: 'Store not initialized' };
  if (pilotConfig.status === 'PAUSED') return { allowed: false, reason: 'Pilot paused' };
  
  const account = await collection.findOne({ account_id: accountId });
  if (!account) return { allowed: false, reason: 'Not a pilot account' };
  
  if (account.alerts_today >= pilotConfig.max_alerts_per_account_per_day) {
    return { allowed: false, reason: 'Account daily limit reached' };
  }
  
  // Check cooldown
  if (account.last_alert_at) {
    const minutesSince = (Date.now() - account.last_alert_at.getTime()) / (1000 * 60);
    if (minutesSince < pilotConfig.cooldown_minutes) {
      return { allowed: false, reason: 'Cooldown period active' };
    }
  }
  
  return { allowed: true };
}

export async function getPilotStats(): Promise<{
  total_accounts: number;
  total_alerts_today: number;
  total_alerts_all_time: number;
  status: string;
}> {
  if (!collection) return { total_accounts: 0, total_alerts_today: 0, total_alerts_all_time: 0, status: 'NOT_INITIALIZED' };
  
  const accounts = await collection.find().toArray();
  return {
    total_accounts: accounts.length,
    total_alerts_today: accounts.reduce((s, a) => s + a.alerts_today, 0),
    total_alerts_all_time: accounts.reduce((s, a) => s + a.alerts_total, 0),
    status: pilotConfig.status,
  };
}
