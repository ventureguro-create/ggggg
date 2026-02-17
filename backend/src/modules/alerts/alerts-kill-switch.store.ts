/**
 * Alerts Kill Switch Store
 * 
 * Global emergency disable for all alerts.
 * Auto-triggers on: twitter rollback, drift HIGH, admin manual.
 */

import { Db, Collection } from 'mongodb';

const COLLECTION = 'connections_alerts_kill_switch';

export interface KillSwitchState {
  _id?: string;
  switch_id: 'main';
  enabled: boolean;              // true = alerts BLOCKED
  auto_enabled: boolean;         // Was enabled automatically
  enabled_reason?: string;
  enabled_at?: Date;
  enabled_by?: string;
  disabled_at?: Date;
  disabled_by?: string;
}

let collection: Collection<KillSwitchState> | null = null;
let cachedState: KillSwitchState | null = null;

const DEFAULT_STATE: Omit<KillSwitchState, '_id'> = {
  switch_id: 'main',
  enabled: false,
  auto_enabled: false,
};

export function initKillSwitchStore(db: Db): void {
  collection = db.collection(COLLECTION);
  collection.createIndex({ switch_id: 1 }, { unique: true });
  console.log('[KillSwitchStore] Initialized');
}

export async function getKillSwitchState(): Promise<KillSwitchState> {
  if (!collection) return { ...DEFAULT_STATE };
  
  let doc = await collection.findOne({ switch_id: 'main' });
  if (!doc) {
    await collection.insertOne({ ...DEFAULT_STATE } as KillSwitchState);
    doc = await collection.findOne({ switch_id: 'main' });
  }
  
  cachedState = doc!;
  return { ...cachedState };
}

export async function isKillSwitchOn(): Promise<boolean> {
  const state = await getKillSwitchState();
  return state.enabled;
}

export async function enableKillSwitch(reason: string, enabledBy: string, auto: boolean = false): Promise<void> {
  if (!collection) return;
  
  await collection.updateOne(
    { switch_id: 'main' },
    {
      $set: {
        enabled: true,
        auto_enabled: auto,
        enabled_reason: reason,
        enabled_at: new Date(),
        enabled_by: enabledBy,
      },
    },
    { upsert: true }
  );
  
  cachedState = null;
  console.log(`[KillSwitch] ENABLED by ${enabledBy}: ${reason}`);
}

export async function disableKillSwitch(disabledBy: string): Promise<void> {
  if (!collection) return;
  
  await collection.updateOne(
    { switch_id: 'main' },
    {
      $set: {
        enabled: false,
        auto_enabled: false,
        disabled_at: new Date(),
        disabled_by: disabledBy,
      },
    }
  );
  
  cachedState = null;
  console.log(`[KillSwitch] DISABLED by ${disabledBy}`);
}

// Auto-trigger conditions
export async function checkAutoTriggers(context: {
  twitterRollback: boolean;
  driftLevel: string;
}): Promise<{ triggered: boolean; reason?: string }> {
  if (context.twitterRollback) {
    await enableKillSwitch('Twitter adapter rollback', 'auto', true);
    return { triggered: true, reason: 'Twitter rollback' };
  }
  
  if (context.driftLevel === 'HIGH') {
    await enableKillSwitch('Drift level HIGH', 'auto', true);
    return { triggered: true, reason: 'Drift HIGH' };
  }
  
  return { triggered: false };
}
