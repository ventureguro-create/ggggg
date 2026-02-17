/**
 * Cluster Attention API Routes
 * БЛОК 1-6 API endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Db } from 'mongodb';
import { getMongoDb } from '../../../db/mongoose.js';
import { clusterExtractionService } from './cluster-extraction.service.js';
import { tokenAttentionService } from './token-attention.service.js';
import { TimeWindow, MomentumLevel, ClusterTokenMomentum } from './cluster.types.js';

export async function registerClusterAttentionRoutes(app: FastifyInstance) {
  const db = getMongoDb();
  
  // Initialize services with database
  clusterExtractionService.setDb(db);
  tokenAttentionService.setDb(db);

  // ============================
  // БЛОК 1 - Cluster Endpoints
  // ============================

  /**
   * GET /api/connections/clusters
   * Get all influencer clusters
   */
  app.get('/api/connections/clusters', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const clusters = await clusterExtractionService.getClusters();
      return reply.send({
        ok: true,
        data: clusters,
        count: clusters.length,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * POST /api/connections/clusters/rebuild
   * Rebuild clusters from network data
   */
  app.post('/api/connections/clusters/rebuild', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const clusters = await clusterExtractionService.buildClusters();
      return reply.send({
        ok: true,
        data: clusters,
        count: clusters.length,
        message: `Rebuilt ${clusters.length} clusters`,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/clusters/member/:username
   * Find cluster containing a specific user
   */
  app.get('/api/connections/clusters/member/:username', async (req: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
    try {
      const cluster = await clusterExtractionService.findClusterByMember(req.params.username);
      if (!cluster) {
        return reply.status(404).send({ ok: false, error: 'User not found in any cluster' });
      }
      return reply.send({ ok: true, data: cluster });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/clusters/:id
   * Get specific cluster by ID
   */
  app.get('/api/connections/clusters/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const cluster = await clusterExtractionService.getCluster(req.params.id);
      if (!cluster) {
        return reply.status(404).send({ ok: false, error: 'Cluster not found' });
      }
      return reply.send({ ok: true, data: cluster });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 2 - Token Attention Endpoints
  // ============================

  /**
   * GET /api/connections/cluster-attention
   * Get cluster-token attention scores
   */
  app.get('/api/connections/cluster-attention', async (
    req: FastifyRequest<{ Querystring: { window?: TimeWindow; clusterId?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { window = '4h', clusterId } = req.query as { window?: TimeWindow; clusterId?: string };

      if (clusterId) {
        const attention = await tokenAttentionService.getClusterAttention(clusterId);
        return reply.send({ ok: true, data: attention });
      }

      // Recompute attention
      const attention = await tokenAttentionService.computeAttention(window as TimeWindow);
      return reply.send({
        ok: true,
        data: attention,
        count: attention.length,
        window,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/cluster-attention/token/:symbol
   * Get attention for specific token
   */
  app.get('/api/connections/cluster-attention/token/:symbol', async (
    req: FastifyRequest<{ Params: { symbol: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const momentum = await tokenAttentionService.getTokenMomentum(req.params.symbol);
      return reply.send({ ok: true, data: momentum });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 3 - Momentum Endpoints
  // ============================

  /**
   * GET /api/connections/cluster-momentum
   * Get momentum scores (coordinated attention signals)
   */
  app.get('/api/connections/cluster-momentum', async (
    req: FastifyRequest<{ Querystring: { level?: MomentumLevel; recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { level, recompute } = req.query as { level?: MomentumLevel; recompute?: string };

      let momentum: ClusterTokenMomentum[];

      if (recompute === 'true') {
        // Recompute attention first
        await tokenAttentionService.computeAttention('1h');
        await tokenAttentionService.computeAttention('4h');
        // Compute momentum
        momentum = await tokenAttentionService.computeMomentum();
      } else {
        // Just return existing data from database
        momentum = await tokenAttentionService.getTopMomentum();
      }

      // Filter by level if specified
      let filtered = momentum;
      if (level) {
        const levels: MomentumLevel[] = ['BACKGROUND', 'ATTENTION', 'MOMENTUM', 'PUMP_LIKE'];
        const minIndex = levels.indexOf(level);
        filtered = momentum.filter(m => levels.indexOf(m.level) >= minIndex);
      }

      return reply.send({
        ok: true,
        data: filtered.sort((a, b) => b.momentumScore - a.momentumScore),
        count: filtered.length,
        summary: {
          pumpLike: momentum.filter(m => m.level === 'PUMP_LIKE').length,
          momentum: momentum.filter(m => m.level === 'MOMENTUM').length,
          attention: momentum.filter(m => m.level === 'ATTENTION').length,
          background: momentum.filter(m => m.level === 'BACKGROUND').length,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/cluster-momentum/token/:symbol
   * Get momentum for specific token
   */
  app.get('/api/connections/cluster-momentum/token/:symbol', async (
    req: FastifyRequest<{ Params: { symbol: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const momentum = await tokenAttentionService.getTokenMomentum(req.params.symbol);
      return reply.send({
        ok: true,
        data: momentum,
        token: req.params.symbol.toUpperCase(),
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/cluster-momentum/top
   * Get top momentum tokens
   */
  app.get('/api/connections/cluster-momentum/top', async (
    req: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { limit } = req.query as { limit?: string };
      const limitNum = parseInt(limit || '20');
      const momentum = await tokenAttentionService.getTopMomentum('ATTENTION');
      
      return reply.send({
        ok: true,
        data: momentum.slice(0, limitNum),
        count: Math.min(momentum.length, limitNum),
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 4 - Price Alignment Endpoints
  // ============================

  /**
   * GET /api/connections/cluster-alignment
   * Get price alignment data
   */
  app.get('/api/connections/cluster-alignment', async (
    req: FastifyRequest<{ Querystring: { verdict?: string; recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { verdict, recompute } = req.query as { verdict?: string; recompute?: string };
      
      // Initialize alignment service
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);

      if (recompute === 'true') {
        const results = await clusterAlignmentService.evaluateAllMomentum();
        return reply.send({
          ok: true,
          data: results,
          count: results.length,
          message: 'Recomputed alignments',
        });
      }

      const alignments = await clusterAlignmentService.getAlignments(verdict as any);
      return reply.send({
        ok: true,
        data: alignments,
        count: alignments.length,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/cluster-alignment/token/:symbol
   * Get alignment for specific token
   */
  app.get('/api/connections/cluster-alignment/token/:symbol', async (
    req: FastifyRequest<{ Params: { symbol: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);
      
      const alignments = await clusterAlignmentService.getAlignments();
      const tokenAlignments = alignments.filter(
        a => a.token.toUpperCase() === req.params.symbol.toUpperCase()
      );
      
      return reply.send({
        ok: true,
        data: tokenAlignments,
        token: req.params.symbol.toUpperCase(),
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 5 - Cluster Credibility Endpoints
  // ============================

  /**
   * GET /api/connections/cluster-credibility
   * Get cluster credibility scores
   */
  app.get('/api/connections/cluster-credibility', async (
    req: FastifyRequest<{ Querystring: { minScore?: string; recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { minScore, recompute } = req.query as { minScore?: string; recompute?: string };
      
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);

      if (recompute === 'true') {
        const results = await clusterAlignmentService.computeAllCredibility();
        return reply.send({
          ok: true,
          data: results,
          count: results.length,
          message: 'Recomputed credibility',
        });
      }

      const minScoreNum = parseFloat(minScore || '0');
      const credibility = await clusterAlignmentService.getTopCredibleClusters(minScoreNum);
      
      return reply.send({
        ok: true,
        data: credibility,
        count: credibility.length,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/cluster-credibility/:clusterId
   * Get credibility for specific cluster
   */
  app.get('/api/connections/cluster-credibility/:clusterId', async (
    req: FastifyRequest<{ Params: { clusterId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);
      
      const credibility = await clusterAlignmentService.computeCredibility(req.params.clusterId);
      
      return reply.send({
        ok: true,
        data: credibility,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 6 - Token Momentum Score Endpoints
  // ============================

  /**
   * GET /api/connections/token-momentum
   * Get cluster-weighted token momentum scores
   */
  app.get('/api/connections/token-momentum', async (
    req: FastifyRequest<{ Querystring: { minScore?: string; recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { minScore, recompute } = req.query as { minScore?: string; recompute?: string };
      
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);

      if (recompute === 'true') {
        const results = await clusterAlignmentService.computeTokenMomentum();
        return reply.send({
          ok: true,
          data: results,
          count: results.length,
          message: 'Recomputed token momentum',
        });
      }

      const minScoreNum = parseFloat(minScore || '0.3');
      const tokens = await clusterAlignmentService.getTopTokens(minScoreNum);
      
      return reply.send({
        ok: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/token-momentum/:symbol
   * Get momentum for specific token
   */
  app.get('/api/connections/token-momentum/:symbol', async (
    req: FastifyRequest<{ Params: { symbol: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { clusterAlignmentService } = await import('./cluster-alignment.service.js');
      clusterAlignmentService.setDb(db);
      
      const score = await clusterAlignmentService.getTokenScore(req.params.symbol);
      
      if (!score) {
        return reply.status(404).send({
          ok: false,
          error: 'Token not found in momentum data',
        });
      }
      
      return reply.send({
        ok: true,
        data: score,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 7 - Opportunity Ranking Endpoints
  // ============================

  /**
   * GET /api/connections/opportunities
   * Get opportunity rankings
   */
  app.get('/api/connections/opportunities', async (
    req: FastifyRequest<{ Querystring: { phase?: string; recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { phase, recompute } = req.query as { phase?: string; recompute?: string };
      
      const { opportunityService } = await import('./opportunity.service.js');
      opportunityService.setDb(db);

      if (recompute === 'true') {
        const results = await opportunityService.computeOpportunities();
        return reply.send({
          ok: true,
          data: results,
          count: results.length,
          message: 'Recomputed opportunities',
        });
      }

      const opportunities = await opportunityService.getTopOpportunities(phase as any);
      
      return reply.send({
        ok: true,
        data: opportunities,
        count: opportunities.length,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 8 - Exchange Feedback Loop Endpoints
  // ============================

  /**
   * POST /api/connections/opportunities/outcome
   * Record outcome of an opportunity
   */
  app.post('/api/connections/opportunities/outcome', async (
    req: FastifyRequest<{ Body: { symbol: string; priceChange: number; horizon?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { symbol, priceChange, horizon } = req.body as { symbol: string; priceChange: number; horizon?: string };
      
      const { opportunityService } = await import('./opportunity.service.js');
      opportunityService.setDb(db);

      const outcome = await opportunityService.recordOutcome(symbol, priceChange, horizon || '4h');
      
      return reply.send({
        ok: true,
        data: outcome,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/connections/opportunities/stats
   * Get outcome statistics
   */
  app.get('/api/connections/opportunities/stats', async (
    req: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { opportunityService } = await import('./opportunity.service.js');
      opportunityService.setDb(db);

      const stats = await opportunityService.getOutcomeStats();
      
      return reply.send({
        ok: true,
        data: stats,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 9 - Market State Attribution Endpoints
  // ============================

  /**
   * GET /api/connections/market-state
   * Get market state attribution
   */
  app.get('/api/connections/market-state', async (
    req: FastifyRequest<{ Querystring: { recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { recompute } = req.query as { recompute?: string };
      
      const { opportunityService } = await import('./opportunity.service.js');
      opportunityService.setDb(db);

      if (recompute === 'true') {
        const state = await opportunityService.computeMarketState();
        return reply.send({
          ok: true,
          data: state,
          message: 'Recomputed market state',
        });
      }

      const state = await opportunityService.getMarketState();
      
      return reply.send({
        ok: true,
        data: state,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  // ============================
  // БЛОК 10 - Alt Season Probability Endpoints
  // ============================

  /**
   * GET /api/connections/alt-season
   * Get alt season probability
   */
  app.get('/api/connections/alt-season', async (
    req: FastifyRequest<{ Querystring: { recompute?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { recompute } = req.query as { recompute?: string };
      
      const { opportunityService } = await import('./opportunity.service.js');
      opportunityService.setDb(db);

      if (recompute === 'true') {
        const state = await opportunityService.computeAltSeasonProbability();
        return reply.send({
          ok: true,
          data: state,
          message: 'Recomputed alt season probability',
        });
      }

      const state = await opportunityService.getAltSeasonState();
      
      return reply.send({
        ok: true,
        data: state,
      });
    } catch (error: any) {
      return reply.status(500).send({ ok: false, error: error.message });
    }
  });

  console.log('[ClusterAttention] All БЛОК 1-10 routes registered');
}
