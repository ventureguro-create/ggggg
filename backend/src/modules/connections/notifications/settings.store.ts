/**
 * Connections Telegram Settings Store
 * Phase 2.3: MongoDB storage for Telegram delivery settings
 * 
 * All settings controlled via Admin UI - bot has no settings
 */

import type { Db } from 'mongodb';
import type { TelegramDeliverySettings, ConnectionsAlertType } from './types.js';
import { DEFAULT_TELEGRAM_SETTINGS } from './types.js';

const COLLECTION_NAME = 'connections_telegram_settings';
const SINGLETON_ID = 'singleton';

export class ConnectionsTelegramSettingsStore {
  private collection;

  constructor(db: Db) {
    this.collection = db.collection(COLLECTION_NAME);
  }

  /**
   * Get current settings (creates default if not exists)
   */
  async get(): Promise<TelegramDeliverySettings> {
    const doc = await this.collection.findOne({ _id: SINGLETON_ID });
    
    if (!doc) {
      // Create default settings
      await this.collection.insertOne({
        _id: SINGLETON_ID,
        ...DEFAULT_TELEGRAM_SETTINGS,
        updated_at: new Date().toISOString(),
      });
      return { ...DEFAULT_TELEGRAM_SETTINGS };
    }

    // Merge with defaults to handle new fields
    const { _id, ...rest } = doc as any;
    return {
      ...DEFAULT_TELEGRAM_SETTINGS,
      ...rest,
      cooldown_hours: {
        ...DEFAULT_TELEGRAM_SETTINGS.cooldown_hours,
        ...(rest.cooldown_hours || {}),
      },
      type_enabled: {
        ...DEFAULT_TELEGRAM_SETTINGS.type_enabled,
        ...(rest.type_enabled || {}),
      },
    };
  }

  /**
   * Update settings (partial update)
   */
  async patch(patch: Partial<TelegramDeliverySettings>): Promise<TelegramDeliverySettings> {
    const current = await this.get();
    
    // Handle nested objects
    const update: any = { ...patch };
    if (patch.cooldown_hours) {
      update.cooldown_hours = { ...current.cooldown_hours, ...patch.cooldown_hours };
    }
    if (patch.type_enabled) {
      update.type_enabled = { ...current.type_enabled, ...patch.type_enabled };
    }
    update.updated_at = new Date().toISOString();

    await this.collection.updateOne(
      { _id: SINGLETON_ID },
      { $set: update },
      { upsert: true }
    );

    return this.get();
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<TelegramDeliverySettings> {
    await this.collection.updateOne(
      { _id: SINGLETON_ID },
      { $set: { ...DEFAULT_TELEGRAM_SETTINGS, updated_at: new Date().toISOString() } },
      { upsert: true }
    );
    return this.get();
  }
}
