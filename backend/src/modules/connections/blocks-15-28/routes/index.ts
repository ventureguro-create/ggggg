/**
 * Routes for BLOCKS 15-28
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

// Services
import { BotFarmsService } from '../services/bot-farms.service.js';
import { AudienceQualityService } from '../services/audience-quality.service.js';
import { FakeGrowthService } from '../services/fake-growth.service.js';
import { FollowerClusterService } from '../services/follower-cluster.service.js';
import { FarmOverlapGraphService } from '../services/farm-overlap-graph.service.js';
import { RealTopFollowersService } from '../services/real-top-followers.service.js';
import { InfluencerAuthenticityService } from '../services/influencer-authenticity.service.js';
import { AuthorityAdjustmentService } from '../services/authority-adjustment.service.js';
import { BotMarketSignalService } from '../services/bot-market-signal.service.js';
import { AlertGateService } from '../services/alert-gate.service.js';
import { WalletBotCorrelationService } from '../services/wallet-bot-correlation.service.js';
import { WalletClusterService } from '../services/wallet-cluster.service.js';
import { ActorBehaviorProfileService } from '../services/actor-behavior-profile.service.js';
import { StrategySimulationService } from '../services/strategy-simulation.service.js';

export async function registerBlocks15To28Routes(app: FastifyInstance, db: Db) {
  // Initialize services
  const botFarmsService = new BotFarmsService(db);
  const audienceQualityService = new AudienceQualityService(db);
  const fakeGrowthService = new FakeGrowthService(db);
  const followerClusterService = new FollowerClusterService(db);
  const farmOverlapGraphService = new FarmOverlapGraphService(db);
  const realTopFollowersService = new RealTopFollowersService(db);
  const influencerAuthenticityService = new InfluencerAuthenticityService(db);
  const authorityAdjustmentService = new AuthorityAdjustmentService(db);
  const botMarketSignalService = new BotMarketSignalService(db);
  const alertGateService = new AlertGateService(db);
  const walletBotCorrelationService = new WalletBotCorrelationService(db);
  const walletClusterService = new WalletClusterService(db);
  const actorBehaviorProfileService = new ActorBehaviorProfileService(db);
  const strategySimulationService = new StrategySimulationService(db);

  // ===========================================
  // BLOCK 15 - Bot Farms
  // ===========================================
  
  app.get('/api/connections/bot-farms', async (req, reply) => {
    const limit = Number((req.query as any).limit ?? 100);
    const minConfidence = Number((req.query as any).minConfidence ?? 0);
    
    try {
      // Direct query to bot_farms collection
      const farms = await db.collection('bot_farms')
        .find({})
        .sort({ memberCount: -1 })
        .limit(limit)
        .toArray();
      
      return reply.send({ ok: true, data: farms, count: farms.length });
    } catch (error) {
      console.error('[BotFarms] Error:', error);
      return reply.send({ ok: true, data: [], count: 0 });
    }
  });

  app.get('/api/connections/influencers/:actorId/bot-farms', async (req, reply) => {
    const { actorId } = req.params as any;
    const farms = await botFarmsService.getFarmsForActor(actorId);
    return reply.send({ ok: true, farms });
  });

  app.post('/api/admin/connections/bot-farms/detect', async (req, reply) => {
    const farms = await botFarmsService.detectSharedFarms();
    await botFarmsService.storeFarms(farms);
    return reply.send({ ok: true, detected: farms.length });
  });

  // ===========================================
  // BLOCK 16 - Audience Quality Index (AQI)
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/audience-quality', async (req, reply) => {
    const { actorId } = req.params as any;
    let report = await audienceQualityService.get(actorId);
    if (!report) {
      report = await audienceQualityService.computeAndUpsert(actorId, { sampleLimit: 800 });
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/audience-quality/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const report = await audienceQualityService.computeAndUpsert(actorId, { sampleLimit: 2000 });
    return reply.send({ ok: true, report });
  });

  // ===========================================
  // BLOCK 17 - Fake Growth Detector
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/fake-growth', async (req, reply) => {
    const { actorId } = req.params as any;
    let report = await fakeGrowthService.get(actorId);
    if (!report) {
      report = await fakeGrowthService.compute(actorId);
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/fake-growth/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const report = await fakeGrowthService.compute(actorId);
    return reply.send({ ok: true, report });
  });

  // ===========================================
  // BLOCK 18 - Follower Identity Clustering
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/follower-clusters', async (req, reply) => {
    const { actorId } = req.params as any;
    let report = await followerClusterService.get(actorId);
    if (!report) {
      report = await followerClusterService.analyze(actorId);
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/follower-clusters/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const report = await followerClusterService.analyze(actorId);
    return reply.send({ ok: true, report });
  });

  // ===========================================
  // BLOCK 19 - Cross-Influencer Farm Graph
  // ===========================================
  
  app.get('/api/connections/network/farm-graph', async (req, reply) => {
    const minScore = Number((req.query as any).minScore ?? 0.35);
    const limit = Number((req.query as any).limit ?? 200);
    const graph = await farmOverlapGraphService.getGraph({ minScore, limit });
    return reply.send(graph);
  });

  // Get detailed actor info for modal popup
  app.get('/api/connections/network/actor/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const details = await farmOverlapGraphService.getActorDetails(actorId);
    return reply.send(details);
  });

  app.post('/api/admin/connections/network/farm-graph/recompute', async (req, reply) => {
    const { actorIds, minSharedSuspects, limitPairs } = req.body as any;
    if (!Array.isArray(actorIds) || actorIds.length < 2) {
      return reply.status(400).send({ ok: false, error: 'actorIds required (>=2)' });
    }
    const result = await farmOverlapGraphService.recompute({ actorIds, minSharedSuspects, limitPairs });
    return reply.send({ ok: true, ...result });
  });

  // ===========================================
  // BLOCK 20 - Real Top Followers
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/top-followers', async (req, reply) => {
    const { actorId } = req.params as any;
    const limit = Number((req.query as any).limit ?? 10);
    const followers = await realTopFollowersService.get(actorId, limit);
    return reply.send({ ok: true, followers });
  });

  // ===========================================
  // BLOCK 21 - Influencer Authenticity Score (IAS)
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/authenticity', async (req, reply) => {
    const { actorId } = req.params as any;
    let report = await influencerAuthenticityService.get(actorId);
    if (!report) {
      report = await influencerAuthenticityService.compute(actorId);
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/authenticity/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const report = await influencerAuthenticityService.compute(actorId);
    return reply.send({ ok: true, report });
  });

  // ===========================================
  // BLOCK 22 - Authority Adjustment
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/authority', async (req, reply) => {
    const { actorId } = req.params as any;
    const report = await authorityAdjustmentService.getAdjustedAuthority(actorId);
    return reply.send(report);
  });

  app.post('/api/admin/connections/authority/apply-all', async (req, reply) => {
    const limit = Number((req.body as any)?.limit ?? 100);
    const result = await authorityAdjustmentService.applyToAll(limit);
    return reply.send({ ok: true, ...result });
  });

  // ===========================================
  // BLOCK 23 - Bot Market Signals (BMS)
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/bot-signals', async (req, reply) => {
    const { actorId } = req.params as any;
    const window = (req.query as any).window ?? '24h';
    let report = await botMarketSignalService.get(actorId, window);
    if (!report) {
      report = await botMarketSignalService.compute(actorId, window);
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/bot-signals/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const window = (req.body as any)?.window ?? '24h';
    const report = await botMarketSignalService.compute(actorId, window);
    return reply.send({ ok: true, report });
  });

  // ===========================================
  // BLOCK 24 - Alert Gate
  // ===========================================
  
  app.post('/api/connections/alerts/process', async (req, reply) => {
    const { actorId, alertId, confidence } = req.body as any;
    if (!actorId || !alertId) {
      return reply.status(400).send({ ok: false, error: 'actorId and alertId required' });
    }
    const result = await alertGateService.processAlert(actorId, {
      alertId,
      confidence: confidence ?? 1.0
    });
    return reply.send({ ok: true, result });
  });

  app.get('/api/admin/connections/alerts/decisions', async (req, reply) => {
    const limit = Number((req.query as any).limit ?? 50);
    const decisions = await alertGateService.getRecentDecisions(limit);
    return reply.send({ ok: true, decisions });
  });

  // ===========================================
  // BLOCK 25 - Wallet-Bot Correlation
  // ===========================================
  
  app.post('/api/connections/correlation/wallet-bot', async (req, reply) => {
    const { asset, actorId, twitterEventTime } = req.body as any;
    if (!asset) {
      return reply.status(400).send({ ok: false, error: 'asset required' });
    }
    const result = await walletBotCorrelationService.correlate({
      asset,
      actorId,
      twitterEventTime: twitterEventTime ? new Date(twitterEventTime) : new Date()
    });
    return reply.send({ ok: true, result });
  });

  app.get('/api/connections/correlation/:asset/history', async (req, reply) => {
    const { asset } = req.params as any;
    const limit = Number((req.query as any).limit ?? 50);
    const history = await walletBotCorrelationService.getHistory(asset, limit);
    return reply.send({ ok: true, history });
  });

  // ===========================================
  // BLOCK 26 - Wallet Clustering
  // ===========================================
  
  app.post('/api/connections/wallets/cluster', async (req, reply) => {
    const { addresses } = req.body as any;
    if (!Array.isArray(addresses) || addresses.length < 2) {
      return reply.status(400).send({ ok: false, error: 'addresses array required (>=2)' });
    }
    const clusters = await walletClusterService.clusterWallets(addresses);
    return reply.send({ ok: true, clusters });
  });

  app.get('/api/connections/wallets/:address/clusters', async (req, reply) => {
    const { address } = req.params as any;
    const clusters = await walletClusterService.getClustersForWallet(address);
    return reply.send({ ok: true, clusters });
  });

  app.post('/api/connections/wallets/similarity', async (req, reply) => {
    const { addressA, addressB } = req.body as any;
    if (!addressA || !addressB) {
      return reply.status(400).send({ ok: false, error: 'addressA and addressB required' });
    }
    const result = await walletClusterService.getSimilarity(addressA, addressB);
    return reply.send({ ok: true, ...result });
  });

  // ===========================================
  // BLOCK 27 - Actor Behavior Profiles
  // ===========================================
  
  app.get('/api/connections/influencers/:actorId/behavior-profile', async (req, reply) => {
    const { actorId } = req.params as any;
    let report = await actorBehaviorProfileService.get(actorId);
    if (!report) {
      report = await actorBehaviorProfileService.compute(actorId);
    }
    return reply.send(report);
  });

  app.post('/api/admin/connections/behavior-profiles/recompute/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    const windowDays = Number((req.body as any)?.windowDays ?? 90);
    const report = await actorBehaviorProfileService.compute(actorId, windowDays);
    return reply.send({ ok: true, report });
  });

  app.get('/api/connections/actors/by-profile/:profileType', async (req, reply) => {
    const { profileType } = req.params as any;
    const limit = Number((req.query as any).limit ?? 50);
    const actors = await actorBehaviorProfileService.getByProfileType(profileType, limit);
    return reply.send({ ok: true, actors });
  });

  // ===========================================
  // BLOCK 28 - Strategy Simulation
  // ===========================================
  
  app.get('/api/connections/simulation/strategies', async (req, reply) => {
    const strategies = strategySimulationService.getStrategies();
    return reply.send({ ok: true, strategies });
  });

  app.post('/api/connections/simulation/run', async (req, reply) => {
    const { strategyName, windowDays, limit } = req.body as any;
    if (!strategyName) {
      return reply.status(400).send({ ok: false, error: 'strategyName required' });
    }
    const report = await strategySimulationService.simulate({ strategyName, windowDays, limit });
    return reply.send({ ok: true, report });
  });

  app.get('/api/connections/simulation/:strategyName', async (req, reply) => {
    const { strategyName } = req.params as any;
    const report = await strategySimulationService.get(strategyName);
    return reply.send({ ok: true, report });
  });

  app.post('/api/connections/simulation/compare', async (req, reply) => {
    const { strategyA, strategyB } = req.body as any;
    if (!strategyA || !strategyB) {
      return reply.status(400).send({ ok: false, error: 'strategyA and strategyB required' });
    }
    const comparison = await strategySimulationService.compare(strategyA, strategyB);
    return reply.send({ ok: true, ...comparison });
  });

  console.log('[Blocks 15-28] Routes registered');
}
