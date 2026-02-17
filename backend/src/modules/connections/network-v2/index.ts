/**
 * Network v2 Module - Follow Graph Authority + Co-Engagement + Silent Authority
 * 
 * PHASE A COMPLETE:
 * - A1: Follow Graph v2 (activity_factor, credibility_factor)
 * - A2: On-chain Anchor Boost (CONFIRMS/CONTRADICTS multipliers)
 * - A3: Co-Investment v2 (time_decay, round_multiplier, anchor_boost)
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

import { initFollowGraphReader } from './follow-graph.reader.js';
import { initAuthorityEngine, getNetworkV2Config } from './authority-engine.js';
import { registerNetworkV2Routes } from './network-v2.routes.js';
import { initCoEngagementModule } from './co-engagement/index.js';
import { initSilentAuthorityModule } from './silent-authority/index.js';
import { registerAnchorRoutes } from './anchor.routes.js';
import { 
  initCoInvestServices, 
  registerCoInvestAdminRoutes, 
  registerCoInvestReadRoutes,
  registerBackerNetworkRoutes 
} from './coinvest/coinvest.routes.js';

// Re-exports
export * from './network-v2.types.js';
export * from './follow-graph.reader.js';
export * from './authority-engine.js';
export * from './co-engagement/index.js';
export * from './silent-authority/index.js';
export * from './anchor.types.js';
export * as AnchorResolver from './anchor.resolver.js';

// PHASE A exports
export * from './onchain-anchor-boost.js';
export * from './coinvest/coinvest.weight.js';

/**
 * Initialize Network v2 module (full)
 * PHASE A: Follow Graph + On-chain Boost + Co-Investment
 */
export async function initNetworkV2Module(db: Db, app: FastifyInstance): Promise<void> {
  // Core components
  initFollowGraphReader(db);
  initAuthorityEngine(db);
  registerNetworkV2Routes(app);
  
  // Co-Investment (Network v2+ / PHASE A3)
  initCoInvestServices(db);
  registerCoInvestAdminRoutes(app);
  registerCoInvestReadRoutes(app);
  registerBackerNetworkRoutes(app);
  
  // Co-Engagement (works without follow data!)
  await initCoEngagementModule(db, app);
  
  // Silent Authority Detector (killer feature)
  await initSilentAuthorityModule(db, app);
  
  // Anchor-based Network (Phase 1 - Backers integration)
  registerAnchorRoutes(app);
  
  const config = await getNetworkV2Config();
  
  console.log(`[NetworkV2] PHASE A Module initialized - Status: ${config.status}`);
  console.log('[NetworkV2] Components:');
  console.log('  - A1 Follow Graph v2: ✅ (activity + credibility factors)');
  console.log('  - A2 On-chain Anchor Boost: ✅ (CONFIRMS/CONTRADICTS)');
  console.log('  - A3 Co-Investment v2: ✅ (time decay + round + anchor)');
  console.log('  - Authority Engine: ✅');
  console.log('  - Co-Engagement: ✅');
  console.log('  - Silent Authority: ✅');
  console.log('  - Anchor Resolver: ✅');
  
  if (config.status === 'SHADOW') {
    console.log('[NetworkV2] 👁️ Running in SHADOW mode');
  } else if (config.status === 'ACTIVE') {
    console.log(`[NetworkV2] 🌐 ACTIVE with blend: v1=${config.v1_v2_blend.v1_weight}, v2=${config.v1_v2_blend.v2_weight}`);
  }
}

console.log('[NetworkV2] PHASE A module loaded');
