/**
 * Graph Overlay Config Store (Phase 4.4)
 * 
 * Stores and retrieves overlay configuration from MongoDB.
 */

import { getMongoDb } from '../../../../db/mongoose.js';
import { DEFAULT_GRAPH_OVERLAY_CONFIG, type GraphOverlayConfig } from '../../contracts/graph-overlay.contracts.js';

const CONFIG_KEY = 'connections.graph_overlay';

/**
 * Get overlay config from database
 */
export async function getGraphOverlayConfig(): Promise<GraphOverlayConfig> {
  try {
    const db = getMongoDb();
    const col = db.collection('connections_admin_config');
    const doc = await col.findOne({ key: CONFIG_KEY });
    
    if (doc?.value) {
      return {
        ...DEFAULT_GRAPH_OVERLAY_CONFIG,
        ...doc.value,
      };
    }
  } catch (err) {
    console.error('[GraphOverlayConfig] Failed to load config:', err);
  }
  
  return { ...DEFAULT_GRAPH_OVERLAY_CONFIG };
}

/**
 * Update overlay config in database
 */
export async function patchGraphOverlayConfig(
  updates: Partial<GraphOverlayConfig>
): Promise<GraphOverlayConfig> {
  try {
    const db = getMongoDb();
    const col = db.collection('connections_admin_config');
    
    const current = await getGraphOverlayConfig();
    const next: GraphOverlayConfig = {
      ...current,
      ...updates,
    };
    
    await col.updateOne(
      { key: CONFIG_KEY },
      {
        $set: {
          key: CONFIG_KEY,
          value: next,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
    
    console.log('[GraphOverlayConfig] Updated:', next.mode);
    return next;
  } catch (err) {
    console.error('[GraphOverlayConfig] Failed to update:', err);
    throw err;
  }
}
