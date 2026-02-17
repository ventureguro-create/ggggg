/**
 * BLOCKS 15-28 Module Index
 * 
 * Export all services, formulas, and routes
 */

// Formulas
export * from './formulas/aqi.formula.js';
export * from './formulas/shared-farm.penalty.js';
export * from './formulas/fake-growth.formula.js';
export * from './formulas/identity-hash.js';
export * from './formulas/farm-overlap.scoring.js';
export * from './formulas/follower-quality.score.js';
export * from './formulas/authenticity.score.js';
export * from './formulas/authority-adjustment.js';
export * from './formulas/bot-market-signal.js';
export * from './formulas/alert-gate.js';
export * from './formulas/wallet-bot-correlation.js';
export * from './formulas/wallet-clustering.js';
export * from './formulas/actor-profile.classifier.js';
export * from './formulas/strategy-simulation.js';

// Services
export { BotFarmsService } from './services/bot-farms.service.js';
export { AudienceQualityService } from './services/audience-quality.service.js';
export { FakeGrowthService } from './services/fake-growth.service.js';
export { FollowerClusterService } from './services/follower-cluster.service.js';
export { FarmOverlapGraphService } from './services/farm-overlap-graph.service.js';
export { RealTopFollowersService } from './services/real-top-followers.service.js';
export { InfluencerAuthenticityService } from './services/influencer-authenticity.service.js';
export { AuthorityAdjustmentService } from './services/authority-adjustment.service.js';
export { BotMarketSignalService } from './services/bot-market-signal.service.js';
export { AlertGateService } from './services/alert-gate.service.js';
export { WalletBotCorrelationService } from './services/wallet-bot-correlation.service.js';
export { WalletClusterService } from './services/wallet-cluster.service.js';
export { ActorBehaviorProfileService } from './services/actor-behavior-profile.service.js';
export { StrategySimulationService } from './services/strategy-simulation.service.js';

// Routes
export { registerBlocks15To28Routes } from './routes/index.js';

// Seed
export { seedBlocks15To28Data } from './seed/index.js';
