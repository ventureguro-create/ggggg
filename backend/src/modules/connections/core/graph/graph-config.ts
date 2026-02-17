/**
 * Graph Config - default values and limits for graph building
 */

import { GraphConfig, DEFAULT_GRAPH_CONFIG } from '../../contracts/graph.contracts.js';
import { getMongoDb } from '../../../../db/mongoose.js';

// In-memory config cache
let cachedConfig: GraphConfig | null = null;
let configLoadedAt: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Get graph config from database or defaults
 */
export async function getGraphConfig(): Promise<GraphConfig> {
  const now = Date.now();
  
  // Return cached if fresh
  if (cachedConfig && (now - configLoadedAt) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }
  
  try {
    const db = getMongoDb();
    const settingsColl = db.collection('connections_settings');
    
    const doc = await settingsColl.findOne({ key: 'graph_config' });
    
    if (doc?.value) {
      cachedConfig = { ...DEFAULT_GRAPH_CONFIG, ...doc.value };
    } else {
      cachedConfig = DEFAULT_GRAPH_CONFIG;
    }
    
    configLoadedAt = now;
    return cachedConfig;
  } catch (err) {
    console.error('[GraphConfig] Error loading config:', err);
    return DEFAULT_GRAPH_CONFIG;
  }
}

/**
 * Update graph config
 */
export async function updateGraphConfig(updates: Partial<GraphConfig>): Promise<GraphConfig> {
  try {
    const db = getMongoDb();
    const settingsColl = db.collection('connections_settings');
    
    const current = await getGraphConfig();
    const newConfig = { ...current, ...updates };
    
    await settingsColl.updateOne(
      { key: 'graph_config' },
      { 
        $set: { 
          value: newConfig,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );
    
    // Invalidate cache
    cachedConfig = newConfig;
    configLoadedAt = Date.now();
    
    return newConfig;
  } catch (err) {
    console.error('[GraphConfig] Error updating config:', err);
    throw err;
  }
}

/**
 * Invalidate config cache (for testing)
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
  configLoadedAt = 0;
}
