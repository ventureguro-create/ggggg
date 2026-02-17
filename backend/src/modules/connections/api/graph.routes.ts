/**
 * Graph Routes - API endpoints for Connections Graph
 * 
 * Endpoints:
 * - GET /api/connections/graph - get graph with params
 * - GET /api/connections/graph/suggestions - get seed suggestions
 * - GET /api/connections/graph/filters - get filter schema
 * - GET /api/connections/graph/mock - get mock graph for testing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildConnectionsGraph, generateMockAccounts, generateMockScore, generateMockAudience } from '../core/graph/build-graph.js';
import { getGraphConfig } from '../core/graph/graph-config.js';
import { 
  GraphQuerySchema, 
  GraphSuggestionsResponse,
  GraphFiltersSchema,
  FilterField
} from '../contracts/graph.contracts.js';
import { getMongoDb } from '../../../db/mongoose.js';

export async function graphRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/connections/graph
   * Get influence graph with filters
   */
  fastify.get('/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      
      // Parse and validate query params
      const parsed = GraphQuerySchema.safeParse({
        seed: query.seed,
        depth: query.depth,
        limit: query.limit,
        min_jaccard: query.min_jaccard,
        min_shared: query.min_shared,
        max_degree: query.max_degree,
        node_types: query.node_types?.split(',').filter(Boolean),
        profile_types: query.profile_types?.split(',').filter(Boolean),
        risk_levels: query.risk_levels?.split(',').filter(Boolean),
        early_signals: query.early_signals?.split(',').filter(Boolean),
        min_influence: query.min_influence,
        max_influence: query.max_influence,
        tags: query.tags?.split(',').filter(Boolean),
      });
      
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }
      
      const graph = await buildConnectionsGraph(parsed.data);
      return graph;
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * POST /api/connections/graph
   * Get graph with body filters (for complex queries)
   */
  fastify.post('/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any || {};
      
      const parsed = GraphQuerySchema.safeParse(body);
      
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: 'Invalid request body',
          details: parsed.error.issues,
        });
      }
      
      const graph = await buildConnectionsGraph(parsed.data);
      return graph;
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/graph/suggestions
   * Get suggested accounts to explore
   */
  fastify.get('/graph/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { seed?: string };
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      const scoresColl = db.collection('connections_scores');
      
      // Get top by different criteria
      const suggestions: GraphSuggestionsResponse['suggestions'] = [];
      
      // Top by influence
      const topInfluence = await scoresColl.aggregate([
        { $sort: { influence_score: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: 'connections_accounts',
            localField: 'author_id',
            foreignField: 'author_id',
            as: 'account'
          }
        },
        { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: '$author_id',
            handle: '$account.handle',
            display_name: '$account.display_name',
            avatar: '$account.avatar',
            score: '$influence_score',
            early_signal_badge: 1,
          }
        }
      ]).toArray();
      
      topInfluence.forEach((item: any) => {
        suggestions.push({
          id: item.id,
          handle: item.handle || item.id,
          display_name: item.display_name || `@${item.handle}`,
          avatar: item.avatar,
          reason: 'top_influence',
          score: item.score || 0,
          badge: item.early_signal_badge,
        });
      });
      
      // Top breakout signals
      const breakouts = await scoresColl.aggregate([
        { $match: { early_signal_badge: 'breakout' } },
        { $sort: { early_signal_score: -1 } },
        { $limit: 2 },
        {
          $lookup: {
            from: 'connections_accounts',
            localField: 'author_id',
            foreignField: 'author_id',
            as: 'account'
          }
        },
        { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: '$author_id',
            handle: '$account.handle',
            display_name: '$account.display_name',
            avatar: '$account.avatar',
            score: '$early_signal_score',
          }
        }
      ]).toArray();
      
      breakouts.forEach((item: any) => {
        if (!suggestions.find(s => s.id === item.id)) {
          suggestions.push({
            id: item.id,
            handle: item.handle || item.id,
            display_name: item.display_name || `@${item.handle}`,
            avatar: item.avatar,
            reason: 'breakout',
            score: item.score || 0,
            badge: 'breakout',
          });
        }
      });
      
      // If no data, generate mock suggestions
      if (suggestions.length === 0) {
        const mockAccounts = generateMockAccounts(5);
        mockAccounts.forEach((acc, i) => {
          const score = generateMockScore(acc.author_id);
          suggestions.push({
            id: acc.author_id,
            handle: acc.handle,
            display_name: acc.display_name || `@${acc.handle}`,
            avatar: acc.avatar,
            reason: i < 2 ? 'top_influence' : i < 4 ? 'breakout' : 'rising',
            score: score.influence_score || 500,
            badge: score.early_signal_badge as any,
          });
        });
      }
      
      const response: GraphSuggestionsResponse = {
        ok: true,
        suggestions: suggestions.slice(0, 6),
        seed_id: query.seed,
      };
      
      return response;
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Suggestions error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        suggestions: [],
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/graph/filters
   * Get filter schema for dynamic UI
   */
  fastify.get('/graph/filters', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await getGraphConfig();
      
      const nodeFilters: FilterField[] = [
        {
          key: 'followers',
          label: 'Followers',
          type: 'buckets',
          buckets: [
            { value: '1k-10k', label: '1K - 10K', range: [1000, 10000] },
            { value: '10k-50k', label: '10K - 50K', range: [10000, 50000] },
            { value: '50k-100k', label: '50K - 100K', range: [50000, 100000] },
            { value: '100k+', label: '100K+', range: [100000, 10000000] },
          ],
        },
        {
          key: 'influence_score',
          label: 'Influence Score',
          type: 'range',
          min: 0,
          max: 1000,
          step: 50,
          default_value: [0, 1000],
        },
        {
          key: 'profile_type',
          label: 'Profile Type',
          type: 'multiselect',
          options: [
            { value: 'retail', label: 'Retail' },
            { value: 'influencer', label: 'Influencer' },
            { value: 'whale', label: 'Whale' },
          ],
          default_value: ['retail', 'influencer', 'whale'],
        },
        {
          key: 'node_type',
          label: 'Account Type',
          type: 'multiselect',
          options: [
            { value: 'person', label: 'Person' },
            { value: 'fund', label: 'Fund' },
            { value: 'project', label: 'Project' },
          ],
        },
        {
          key: 'early_signal',
          label: 'Early Signal',
          type: 'multiselect',
          options: [
            { value: 'breakout', label: 'Breakout' },
            { value: 'rising', label: 'Rising' },
            { value: 'none', label: 'None' },
          ],
        },
        {
          key: 'risk_level',
          label: 'Risk Level',
          type: 'multiselect',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
        {
          key: 'red_flags',
          label: 'Red Flags',
          type: 'range',
          min: 0,
          max: 10,
          step: 1,
          default_value: [0, 10],
        },
      ];
      
      const edgeFilters: FilterField[] = [
        {
          key: 'min_jaccard',
          label: 'Min Overlap (Jaccard)',
          type: 'range',
          min: 0,
          max: 1,
          step: 0.05,
          default_value: config.min_jaccard,
        },
        {
          key: 'min_shared',
          label: 'Min Shared Audience',
          type: 'range',
          min: 1,
          max: 100,
          step: 1,
          default_value: config.min_shared,
        },
        {
          key: 'edge_strength',
          label: 'Edge Strength',
          type: 'multiselect',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
      ];
      
      const viewFilters: FilterField[] = [
        {
          key: 'limit',
          label: 'Max Nodes',
          type: 'range',
          min: 10,
          max: 100,
          step: 10,
          default_value: config.default_limit,
        },
        {
          key: 'max_degree',
          label: 'Max Connections per Node',
          type: 'range',
          min: 5,
          max: 50,
          step: 5,
          default_value: config.max_degree,
        },
        {
          key: 'hide_isolated',
          label: 'Hide Isolated Nodes',
          type: 'checkbox',
          default_value: false,
        },
      ];
      
      const response: GraphFiltersSchema = {
        ok: true,
        filters: {
          nodes: nodeFilters,
          edges: edgeFilters,
          view: viewFilters,
        },
      };
      
      return response;
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Filters error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/graph/mock
   * Get mock graph for testing
   */
  fastify.get('/graph/mock', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Force mock data
      const graph = await buildConnectionsGraph({
        limit: 30,
        min_jaccard: 0.05,
        min_shared: 2,
        max_degree: 15,
      });
      
      return graph;
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Mock error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/graph/node/:id
   * Get node details with connections
   */
  fastify.get<{ Params: { id: string } }>('/graph/node/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      const db = getMongoDb();
      const accountsColl = db.collection('connections_accounts');
      const scoresColl = db.collection('connections_scores');
      
      // Get account
      const account = await accountsColl.findOne({ author_id: id }) as any;
      const score = await scoresColl.findOne({ author_id: id }) as any;
      
      if (!account && !score) {
        // Generate mock for non-existent ID
        const mockScore = generateMockScore(id);
        return {
          ok: true,
          data: {
            id,
            handle: id,
            display_name: id,
            profile_type: 'retail',
            influence_score: mockScore.influence_score,
            x_score: mockScore.x_score,
            early_signal: {
              badge: mockScore.early_signal_badge,
              score: mockScore.early_signal_score,
            },
            trend: {
              velocity: mockScore.velocity_norm,
              acceleration: mockScore.acceleration_norm,
            },
            connected_nodes: [],
            why_connected: [],
          },
        };
      }
      
      // Build full graph to find connections
      const graph = await buildConnectionsGraph({ limit: 100 });
      
      // Find edges connected to this node
      const connectedEdges = graph.edges.filter(
        e => e.source === id || e.target === id
      );
      
      const connectedNodes = connectedEdges.map(e => {
        const otherId = e.source === id ? e.target : e.source;
        const otherNode = graph.nodes.find(n => n.id === otherId);
        return {
          id: otherId,
          label: otherNode?.display_name || otherId,
          relation_type: e.edge_type,
          weight: e.weight,
          jaccard: e.jaccard,
          shared: e.shared_count,
        };
      }).sort((a, b) => b.weight - a.weight);
      
      // Generate why_connected explanations
      const whyConnected = connectedEdges.slice(0, 5).map(e => {
        return `${Math.round(e.jaccard * 100)}% audience overlap (${e.shared_count} shared users)`;
      });
      
      return {
        ok: true,
        data: {
          id: account?.author_id || id,
          handle: account?.handle || id,
          display_name: account?.display_name || `@${account?.handle || id}`,
          profile_type: account?.profile || 'retail',
          influence_score: score?.influence_score || 0,
          x_score: score?.x_score || 0,
          adjusted_influence: score?.adjusted_influence || 0,
          early_signal: {
            badge: score?.early_signal_badge || 'none',
            score: score?.early_signal_score || 0,
          },
          trend: {
            velocity: score?.velocity_norm || 0,
            acceleration: score?.acceleration_norm || 0,
            state: score?.trend_state || 'stable',
          },
          risk_level: score?.risk_level || 'low',
          red_flags_count: account?.red_flags_count || 0,
          connected_nodes: connectedNodes.slice(0, 10),
          why_connected: whyConnected,
        },
      };
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Node error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  /**
   * GET /api/connections/graph/ranking
   * Get ranked list for table/sidebar
   */
  fastify.get('/graph/ranking', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { 
        sort_by?: 'influence' | 'early_signal' | 'acceleration';
        limit?: string;
      };
      
      const sortBy = query.sort_by || 'influence';
      const limit = parseInt(query.limit || '20');
      
      const db = getMongoDb();
      const scoresColl = db.collection('connections_scores');
      const accountsColl = db.collection('connections_accounts');
      
      // Build sort field
      const sortField = sortBy === 'influence' ? 'influence_score' :
                       sortBy === 'early_signal' ? 'early_signal_score' :
                       'acceleration_norm';
      
      const results = await scoresColl.aggregate([
        { $sort: { [sortField]: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'connections_accounts',
            localField: 'author_id',
            foreignField: 'author_id',
            as: 'account'
          }
        },
        { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: '$author_id',
            handle: '$account.handle',
            display_name: '$account.display_name',
            score: `$${sortField}`,
            early_signal_badge: 1,
            influence_score: 1,
          }
        }
      ]).toArray();
      
      // If no data, generate mock
      let items = results;
      if (items.length === 0) {
        const mockAccounts = generateMockAccounts(limit);
        items = mockAccounts.map((acc, idx) => {
          const score = generateMockScore(acc.author_id);
          return {
            id: acc.author_id,
            handle: acc.handle,
            display_name: acc.display_name,
            score: sortBy === 'influence' ? score.influence_score :
                   sortBy === 'early_signal' ? score.early_signal_score :
                   score.acceleration_norm,
            early_signal_badge: score.early_signal_badge,
            influence_score: score.influence_score,
          };
        }).sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      }
      
      return {
        ok: true,
        data: {
          items: items.map((item: any, idx: number) => ({
            id: item.id,
            label: item.display_name || `@${item.handle}`,
            handle: item.handle,
            score: Math.round(item.score || 0),
            rank: idx + 1,
            early_signal: item.early_signal_badge,
            influence_score: item.influence_score,
          })),
          sort_by: sortBy,
          total: items.length,
        },
      };
      
    } catch (err: any) {
      fastify.log.error(`[Graph] Ranking error: ${err.message}`);
      return reply.status(500).send({
        ok: false,
        error: err.message,
      });
    }
  });
  
  console.log('[Graph] Routes registered at /api/connections/graph');
}
