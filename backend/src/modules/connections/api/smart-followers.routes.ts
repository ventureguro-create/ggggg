/**
 * Smart Followers API Routes
 * 
 * Prefix: /api/connections/smart-followers
 * 
 * Endpoints:
 * - POST / - Compute smart followers score
 * - POST /batch - Batch computation
 * - GET /mock - Mock data for testing
 * - GET /info - Engine info
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  computeSmartFollowers, 
  generateMockFollowers,
  smartFollowersConfig,
  SmartFollowersInput,
  getTierLabel,
  getTierColor,
} from '../core/smart-followers/index.js';
import { getMongoDb } from '../../../db/mongoose.js';

export async function registerSmartFollowersRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * POST /api/connections/smart-followers
   * Compute smart followers score for an account
   */
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!smartFollowersConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'SMART_FOLLOWERS_DISABLED',
        message: 'Smart Followers engine is disabled',
      });
    }
    
    const body = req.body as SmartFollowersInput;
    
    if (!body.account_id) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'account_id required',
      });
    }
    
    try {
      const result = computeSmartFollowers(body);
      
      return reply.send({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'COMPUTATION_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * POST /api/connections/smart-followers/batch
   * Batch computation for multiple accounts
   */
  app.post('/batch', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!smartFollowersConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'SMART_FOLLOWERS_DISABLED',
        message: 'Smart Followers engine is disabled',
      });
    }
    
    const body = req.body as { items: SmartFollowersInput[] };
    
    if (!body.items || !Array.isArray(body.items)) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_REQUEST',
        message: 'items array required',
      });
    }
    
    try {
      const results = body.items.map(item => computeSmartFollowers(item));
      
      return reply.send({
        ok: true,
        data: {
          results,
          processed: results.length,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'BATCH_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/smart-followers/mock
   * Get mock smart followers data for UI development
   */
  app.get('/mock', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { count?: string; account_id?: string };
    const count = Math.min(parseInt(query.count || '15'), 50);
    
    const mockInput = generateMockFollowers(count);
    if (query.account_id) {
      mockInput.account_id = query.account_id;
    }
    
    const result = computeSmartFollowers(mockInput);
    
    return reply.send({
      ok: true,
      message: 'Mock smart followers data for UI development',
      data: result,
    });
  });
  
  /**
   * GET /api/connections/smart-followers/info
   * Get engine info and configuration
   */
  app.get('/info', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        version: smartFollowersConfig.version,
        description: 'Smart Followers Engine - quality of followers, not quantity',
        components: [
          'Authority score weighted followers',
          'Tier multipliers (elite, high, upper_mid, mid, low_mid, low)',
          'Follower value index (quality per size)',
          'Top followers breakdown',
        ],
        tiers: Object.keys(smartFollowersConfig.tier_multiplier).map(tier => ({
          tier,
          label: getTierLabel(tier),
          multiplier: smartFollowersConfig.tier_multiplier[tier],
          color: getTierColor(tier),
        })),
        enabled: smartFollowersConfig.enabled,
      },
    });
  });
  
  /**
   * GET /api/connections/smart-followers/:account_id
   * Get smart followers for specific account using REAL data from unified_accounts
   */
  app.get('/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { account_id } = req.params as { account_id: string };
    const query = req.query as { mock_count?: string; use_mock?: string };
    
    // Try to get real followers from unified_accounts first
    const db = getMongoDb();
    
    if (db && query.use_mock !== 'true') {
      try {
        // Get all unified accounts sorted by authority (these are potential "followers")
        const unifiedAccounts = await db.collection('connections_unified_accounts')
          .find({})
          .sort({ authority: -1 })
          .limit(50)
          .toArray();
        
        if (unifiedAccounts && unifiedAccounts.length > 0) {
          // Transform unified accounts to followers format
          const realFollowers = unifiedAccounts.map((acc: any, idx: number) => ({
            follower_id: acc.id || acc.handle?.replace('@', '') || `follower_${idx}`,
            authority_score_0_1: Math.min(1, (acc.authority || 50) / 100),
            tier_multiplier: 1.0,
            handle: acc.handle || `@${acc.id}`,
            label: acc.title || acc.displayName || acc.id,
            avatar: acc.avatar,
            followers: acc.followers || 0,
          }));
          
          const realInput: SmartFollowersInput = {
            account_id,
            followers: realFollowers,
          };
          
          const result = computeSmartFollowers(realInput);
          
          // Enrich top_followers with real data
          result.top_followers = result.top_followers.map((f: any) => {
            const original = realFollowers.find((rf: any) => rf.follower_id === f.follower_id);
            return {
              ...f,
              handle: original?.handle || f.handle,
              label: original?.label || f.label,
              avatar: original?.avatar,
              followers: original?.followers,
            };
          });
          
          return reply.send({
            ok: true,
            source: 'real',
            data: result,
          });
        }
      } catch (err) {
        console.error('[SmartFollowers] Error fetching real data:', err);
      }
    }
    
    // Fallback to mock data
    const count = Math.min(parseInt(query.mock_count || '20'), 50);
    const mockInput = generateMockFollowers(count);
    mockInput.account_id = account_id;
    
    const result = computeSmartFollowers(mockInput);
    
    return reply.send({
      ok: true,
      source: 'mock',
      data: result,
    });
  });
  
  console.log('[SmartFollowers] Routes registered: /api/connections/smart-followers/*');
}
