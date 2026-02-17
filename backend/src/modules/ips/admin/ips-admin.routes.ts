/**
 * IPS Admin Routes
 * 
 * PHASE G6: Admin Debug API
 * ADMIN-ONLY analytical layer
 */

import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { IPSPersistService } from '../services/ips-persist.service.js';
import { WindowKey } from '../constants/ips.constants.js';

export async function ipsAdminRoutes(app: FastifyInstance, db: Db) {
  const persistService = new IPSPersistService(db);
  
  // Ensure indexes on startup
  await persistService.ensureIndexes().catch(console.error);
  
  /**
   * GET /api/admin/ips/timeline
   * Timeline of IPS events with filters
   */
  app.get('/api/admin/ips/timeline', async (req, reply) => {
    const query = req.query as any;
    
    const params = {
      actorId: query.actorId,
      asset: query.asset,
      window: query.window as WindowKey,
      from: query.from ? Number(query.from) : undefined,
      to: query.to ? Number(query.to) : undefined,
      verdict: query.verdict,
      minIPS: query.minIPS ? Number(query.minIPS) : undefined,
      limit: Math.min(Number(query.limit) || 200, 500)
    };
    
    const items = await persistService.getTimeline(params);
    
    // Get stats for the same query
    const match: any = {};
    if (params.actorId) match.actorId = params.actorId;
    if (params.asset) match.asset = params.asset.toUpperCase();
    if (params.window) match.window = params.window;
    
    const stats = await persistService.getTimelineStats(match);
    
    return reply.send({
      ok: true,
      window: params.window || 'all',
      stats,
      items
    });
  });
  
  /**
   * GET /api/admin/ips/actor/:actorId
   * Aggregated IPS stats for an actor
   */
  app.get('/api/admin/ips/actor/:actorId', async (req, reply) => {
    const { actorId } = req.params as any;
    
    const stats = await persistService.getActorStats(actorId);
    
    if (!stats) {
      return reply.status(404).send({ 
        ok: false, 
        error: 'Actor not found or no IPS data' 
      });
    }
    
    return reply.send({
      ok: true,
      data: stats
    });
  });
  
  /**
   * GET /api/admin/ips/asset/:symbol
   * Aggregated IPS stats for an asset
   */
  app.get('/api/admin/ips/asset/:symbol', async (req, reply) => {
    const { symbol } = req.params as any;
    
    const stats = await persistService.getAssetStats(symbol);
    
    return reply.send({
      ok: true,
      data: stats
    });
  });
  
  /**
   * GET /api/admin/ips/distribution
   * Overall IPS distribution stats
   */
  app.get('/api/admin/ips/distribution', async (req, reply) => {
    const col = db.collection('ips_events');
    
    // Get distribution by verdict
    const verdictDist = await col.aggregate([
      {
        $group: {
          _id: '$verdict',
          count: { $sum: 1 },
          avgIPS: { $avg: '$ips' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Get distribution by window
    const windowDist = await col.aggregate([
      {
        $group: {
          _id: '$window',
          count: { $sum: 1 },
          avgIPS: { $avg: '$ips' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    // Get distribution by outcome
    const outcomeDist = await col.aggregate([
      {
        $group: {
          _id: '$outcome',
          count: { $sum: 1 },
          avgIPS: { $avg: '$ips' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Overall stats
    const overall = await col.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueActors: { $addToSet: '$actorId' },
          uniqueAssets: { $addToSet: '$asset' },
          avgIPS: { $avg: '$ips' }
        }
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          uniqueActors: { $size: '$uniqueActors' },
          uniqueAssets: { $size: '$uniqueAssets' },
          avgIPS: { $round: ['$avgIPS', 3] }
        }
      }
    ]).toArray();
    
    return reply.send({
      ok: true,
      data: {
        overall: overall[0] || { totalEvents: 0, uniqueActors: 0, uniqueAssets: 0, avgIPS: 0 },
        byVerdict: verdictDist.map(v => ({ 
          verdict: v._id, 
          count: v.count, 
          avgIPS: Math.round(v.avgIPS * 1000) / 1000 
        })),
        byWindow: windowDist.map(w => ({ 
          window: w._id, 
          count: w.count, 
          avgIPS: Math.round(w.avgIPS * 1000) / 1000 
        })),
        byOutcome: outcomeDist.map(o => ({ 
          outcome: o._id, 
          count: o.count, 
          avgIPS: Math.round(o.avgIPS * 1000) / 1000 
        }))
      }
    });
  });
  
  /**
   * POST /api/admin/ips/recalculate
   * Trigger recalculation for an actor
   */
  app.post('/api/admin/ips/recalculate', async (req, reply) => {
    const { actorId } = req.body as any;
    
    if (!actorId) {
      return reply.status(400).send({ ok: false, error: 'actorId required' });
    }
    
    const stats = await persistService.updateActorStats(actorId);
    
    return reply.send({
      ok: true,
      message: `Recalculated IPS for ${actorId}`,
      data: stats
    });
  });
  
  console.log('[IPS] Admin routes registered: /api/admin/ips/*');
}
