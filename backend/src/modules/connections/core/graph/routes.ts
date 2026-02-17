/**
 * Connections Graph API Routes
 * 
 * REST API for influence graph visualization
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildConnectionsGraph } from './builder.js';
import { GraphFilters, NodeDetails, GraphRanking } from './types.js';
import { getMongoDb } from '../../../../db/mongoose.js';

export async function connectionsGraphRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * POST /api/connections/graph
   * Get filtered influence graph
   */
  fastify.post<{
    Body: GraphFilters;
  }>('/graph', async (request, reply) => {
    try {
      const filters = request.body || {};
      
      // Fetch accounts from database
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      const scoreColl = db.collection('connections_scores');
      const audienceColl = db.collection('connections_audience');
      
      // Get accounts with scores
      const accounts = await accountsColl.aggregate([
        { $limit: filters.limit_nodes || 100 },
        {
          $lookup: {
            from: 'connections_scores',
            localField: 'author_id',
            foreignField: 'author_id',
            as: 'score_data'
          }
        },
        {
          $lookup: {
            from: 'connections_audience',
            localField: 'author_id',
            foreignField: 'author_id',
            as: 'audience_data'
          }
        },
        {
          $project: {
            _id: 0,
            author_id: 1,
            handle: 1,
            profile: 1,
            scores: { $arrayElemAt: ['$score_data', 0] },
            audience: { $arrayElemAt: ['$audience_data.engaged_users', 0] },
          }
        }
      ]).toArray();
      
      // If no accounts in DB, generate mock data
      const accountsData = accounts.length > 0 ? accounts : generateMockAccounts(30);
      
      // Build graph
      const graph = buildConnectionsGraph(accountsData as any[], filters);
      
      return {
        ok: true,
        data: graph
      };
    } catch (err: any) {
      fastify.log.error(`[Connections Graph] Error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message
      });
    }
  });
  
  /**
   * GET /api/connections/graph
   * Get default graph (no filters)
   */
  fastify.get('/graph', async (request, reply) => {
    try {
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      
      const accounts = await accountsColl.find({}).limit(50).toArray();
      const accountsData = accounts.length > 0 ? accounts : generateMockAccounts(30);
      
      const graph = buildConnectionsGraph(accountsData as any[], {});
      
      return {
        ok: true,
        data: graph
      };
    } catch (err: any) {
      fastify.log.error(`[Connections Graph] Error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message
      });
    }
  });
  
  /**
   * GET /api/connections/graph/node/:id
   * Get node details with connections
   */
  fastify.get<{
    Params: { id: string };
  }>('/graph/node/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      const scoreColl = db.collection('connections_scores');
      
      // Get accounts from database or use mock data
      const allAccounts = await accountsColl.find({}).limit(100).toArray();
      const accountsData = allAccounts.length > 0 ? allAccounts : generateMockAccounts(30);
      
      // Find account in the data
      const account = accountsData.find((acc: any) => acc.author_id === id);
      if (!account) {
        return reply.status(404).send({ ok: false, error: 'Node not found' });
      }
      
      // Get score data (from database if available, otherwise use account data)
      let scoreData = null;
      if (allAccounts.length > 0) {
        scoreData = await scoreColl.findOne({ author_id: id }) as any;
      }
      
      // Build full graph to find connections
      const graph = buildConnectionsGraph(accountsData as any[], {});
      
      // Find edges connected to this node
      const connectedEdges = graph.edges.filter(
        e => e.source === id || e.target === id
      );
      
      const connectedNodes = connectedEdges.map(e => {
        const otherId = e.source === id ? e.target : e.source;
        const otherNode = graph.nodes.find(n => n.id === otherId);
        return {
          id: otherId,
          label: otherNode?.label || otherId,
          relation_type: e.type,
          weight: e.weight
        };
      }).sort((a, b) => b.weight - a.weight);
      
      // Generate why_connected explanations
      const whyConnected = connectedEdges.slice(0, 5).map(e => {
        if (e.type === 'audience_overlap') {
          return `Shared ${Math.round(e.overlap_percent || 0)}% audience overlap`;
        }
        if (e.type === 'trend_correlation') {
          return `Similar growth trajectory`;
        }
        if (e.type === 'engagement_similarity') {
          return `Comparable engagement patterns`;
        }
        return `Profile relationship detected`;
      });
      
      const details: NodeDetails = {
        id: account.author_id,
        label: `@${account.handle}`,
        profile: account.profile || 'retail',
        influence_score: scoreData?.influence_score || account.scores?.influence_score || 0,
        trend: {
          velocity: scoreData?.velocity_norm || account.trend?.velocity_norm || 0,
          acceleration: scoreData?.acceleration_norm || account.trend?.acceleration_norm || 0,
          state: scoreData?.trend_state || account.trend?.state || 'stable'
        },
        early_signal: {
          badge: scoreData?.early_signal_badge || account.early_signal?.badge || 'none',
          score: scoreData?.early_signal_score || account.early_signal?.score || 0,
          confidence: scoreData?.confidence || 0.5
        },
        connected_nodes: connectedNodes,
        why_connected: whyConnected
      };
      
      return { ok: true, data: details };
    } catch (err: any) {
      fastify.log.error(`[Connections Graph] Node error: ${err.message}`);
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /api/connections/graph/ranking
   * Get ranked list for sidebar
   */
  fastify.get<{
    Querystring: {
      sort_by?: 'influence' | 'early_signal' | 'acceleration';
      limit?: string;
    };
  }>('/graph/ranking', async (request, reply) => {
    try {
      const sortBy = request.query.sort_by || 'influence';
      const limit = parseInt(request.query.limit || '20');
      
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      
      const accounts = await accountsColl.find({}).limit(100).toArray();
      const accountsData = accounts.length > 0 ? accounts : generateMockAccounts(30);
      
      // Sort and rank
      const sorted = [...accountsData].sort((a: any, b: any) => {
        switch (sortBy) {
          case 'early_signal':
            return (b.early_signal?.score || 0) - (a.early_signal?.score || 0);
          case 'acceleration':
            return (b.trend?.acceleration_norm || 0) - (a.trend?.acceleration_norm || 0);
          default:
            return (b.scores?.influence_score || 0) - (a.scores?.influence_score || 0);
        }
      }).slice(0, limit);
      
      const ranking: GraphRanking = {
        items: sorted.map((acc: any, idx) => ({
          id: acc.author_id,
          label: `@${acc.handle}`,
          score: sortBy === 'influence' ? (acc.scores?.influence_score || 0) :
                 sortBy === 'early_signal' ? (acc.early_signal?.score || 0) :
                 (acc.trend?.acceleration_norm || 0),
          rank: idx + 1,
          early_signal: acc.early_signal?.badge
        })),
        sort_by: sortBy,
        total: accountsData.length
      };
      
      return { ok: true, data: ranking };
    } catch (err: any) {
      fastify.log.error(`[Connections Graph] Ranking error: ${err.message}`);
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * GET /api/connections/graph/mock
   * Get mock graph for testing
   */
  fastify.get('/graph/mock', async (request, reply) => {
    try {
      const mockAccounts = generateMockAccounts(25);
      const graph = buildConnectionsGraph(mockAccounts as any[], {});
      return { ok: true, data: graph };
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message });
    }
  });
}

/**
 * Generate mock accounts for demo
 */
function generateMockAccounts(count: number) {
  const names = [
    'crypto_alpha', 'defi_hunter', 'nft_whale', 'token_sage', 'yield_master',
    'dao_builder', 'web3_dev', 'chain_analyst', 'meme_trader', 'airdrop_pro',
    'sol_maxi', 'eth_bull', 'btc_hodler', 'layer2_fan', 'zk_builder',
    'gaming_whale', 'metaverse_ape', 'rwa_investor', 'depin_alpha', 'ai_trader'
  ];
  const profiles = ['retail', 'influencer', 'whale'] as const;
  const risks = ['low', 'medium', 'high'] as const;
  const signals = ['none', 'none', 'none', 'rising', 'breakout'] as const;
  
  return Array.from({ length: count }, (_, i) => {
    const profile = profiles[i % 3];
    const risk = risks[Math.floor(Math.random() * 3)];
    const signal = signals[Math.floor(Math.random() * 5)];
    const baseScore = profile === 'whale' ? 600 + Math.random() * 350 :
                      profile === 'influencer' ? 400 + Math.random() * 300 :
                      200 + Math.random() * 400;
    const velocity = (Math.random() - 0.3) * 1.5;
    const accel = (Math.random() - 0.3) * 1.2;
    
    return {
      author_id: `mock_${i.toString().padStart(3, '0')}`,
      handle: names[i % names.length] + (i >= names.length ? `_${Math.floor(i / names.length)}` : ''),
      profile,
      scores: {
        influence_score: Math.round(baseScore),
        x_score: Math.round(baseScore * 0.6),
        risk_level: risk
      },
      early_signal: {
        badge: signal,
        score: signal === 'breakout' ? 700 + Math.random() * 300 :
               signal === 'rising' ? 450 + Math.random() * 250 :
               Math.random() * 400
      },
      trend: {
        velocity_norm: velocity,
        acceleration_norm: accel,
        state: velocity > 0.2 ? 'growing' : velocity < -0.2 ? 'cooling' : 'stable'
      }
    };
  });
}
