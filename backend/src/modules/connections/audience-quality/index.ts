/**
 * Audience Quality Engine (AQE) Module
 * 
 * Rules-based audience quality assessment.
 * Measures: real_audience_pct, bot_pressure_pct
 * 
 * Includes:
 * - БЛОК 1-7: Core AQE
 * - БЛОК 10: Debug routes
 * - БЛОК 14: Follower Graph
 * - БЛОК 15: Shared Bot Farms
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

import { DEFAULT_AQE_CONFIG } from './contracts/audienceQuality.config.js';
import { AudienceQualityEngine } from './core/audienceQuality.engine.js';
import { TwitterFollowersReader } from './readers/twitterFollowers.reader.js';
import { AudienceQualityCacheStore } from './storage/audienceQuality.cache.store.js';
import { registerAudienceQualityRoutes } from './routes/audienceQuality.routes.js';
import { registerAudienceQualityDebugRoutes } from './routes/audienceQuality.debug.routes.js';
import { registerFollowerGraphRoutes } from './follower-graph/follower-graph.routes.js';
import { registerSharedFarmsRoutes } from './shared-farms/shared-farms.routes.js';

export async function registerAudienceQualityModule(app: FastifyInstance, db: Db) {
  console.log('[AQE] Registering Audience Quality Engine...');

  // Initialize cache store
  const cache = new AudienceQualityCacheStore(db);
  await cache.ensureIndexes();

  // Initialize reader (uses mock fallback if no real data)
  const reader = new TwitterFollowersReader(db);

  // Initialize engine
  const engine = new AudienceQualityEngine(reader, DEFAULT_AQE_CONFIG);

  // Register core routes
  registerAudienceQualityRoutes(app, { engine, cache });
  registerAudienceQualityDebugRoutes(app, { reader, engine });
  
  // БЛОК 14: Follower Graph routes
  registerFollowerGraphRoutes(app, { reader });
  
  // БЛОК 15: Shared Bot Farms routes
  registerSharedFarmsRoutes(app, db);

  console.log('[AQE] Audience Quality Engine registered');
  console.log('[AQE] Endpoints:');
  console.log('[AQE]   GET  /api/connections/audience-quality/:actorId');
  console.log('[AQE]   GET  /api/connections/audience-quality/:actorId/summary');
  console.log('[AQE]   GET  /api/connections/audience-quality/:actorId/graph');
  console.log('[AQE]   GET  /api/connections/audience-quality/:actorId/clusters');
  console.log('[AQE]   GET  /api/connections/audience-quality/:actorId/shared-farms');
  console.log('[AQE]   POST /api/admin/connections/audience-quality/:actorId/recompute');
}

// Export types and classes for external use
export { AudienceQualityEngine } from './core/audienceQuality.engine.js';
export { AudienceQualityCacheStore } from './storage/audienceQuality.cache.store.js';
export { DEFAULT_AQE_CONFIG } from './contracts/audienceQuality.config.js';
export type { AQEResult, AQEFollowerClassified, AQEBreakdown } from './contracts/audienceQuality.types.js';

// БЛОК 14 exports
export { buildFollowerGraph, calculateGraphPenalty } from './follower-graph/follower-graph.service.js';
export type { FollowerGraphResult, FollowerCluster } from './follower-graph/follower-graph.types.js';

// БЛОК 15 exports  
export { analyzeSharedFarms } from './shared-farms/shared-farms.service.js';
export type { SharedFarmAnalysis, SharedBotFarm } from './shared-farms/shared-farms.types.js';
