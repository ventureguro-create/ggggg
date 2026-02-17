/**
 * Network v2 Routes - Co-investment edges, backer network maps
 */

import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { rebuildCoinvestEdges } from './jobs/rebuildCoinvest.job.js';

export async function registerNetworkV2Routes(app: FastifyInstance) {
  const db = getMongoDb();

  // Admin: rebuild co-invest edges
  app.post('/api/admin/connections/networkv2/rebuild/coinvest', async () => {
    const result = await rebuildCoinvestEdges(db);
    return { ok: true, ...result };
  });

  // Get coinvest edges for graph
  app.get('/api/connections/networkv2/coinvest/edges', async (req: any) => {
    const minShared = Number(req.query.minShared || 1);
    const limit = Number(req.query.limit || 500);
    
    const edges = await db.collection('backer_coinvest_edges')
      .find({ sharedProjects: { $gte: minShared } })
      .sort({ weight: -1 })
      .limit(limit)
      .toArray();
    
    return { ok: true, count: edges.length, edges };
  });

  // Get backer's network (nodes + edges)
  app.get('/api/connections/backers/:slug/networkv2', async (req: any) => {
    const slug = String(req.params.slug);
    const backerId = `backer:${slug}`;

    // Get backer
    const backer = await db.collection('connections_backers').findOne({ slug });
    if (!backer) {
      // Try unified accounts
      const unified = await db.collection('connections_unified_accounts').findOne({ 
        $or: [{ id: backerId }, { slug }] 
      });
      if (!unified) {
        return { ok: false, error: 'Backer not found' };
      }
    }

    // Get edges involving this backer
    const edges = await db.collection('backer_coinvest_edges')
      .find({ $or: [{ source: backerId }, { target: backerId }] })
      .sort({ weight: -1 })
      .limit(100)
      .toArray();

    // Collect all neighbor IDs
    const neighborIds = new Set<string>([backerId]);
    for (const e of edges) {
      neighborIds.add(e.source);
      neighborIds.add(e.target);
    }

    // Get all neighbor nodes
    const slugs = Array.from(neighborIds)
      .filter(id => id.startsWith('backer:'))
      .map(id => id.replace('backer:', ''));
    
    const backers = await db.collection('connections_backers')
      .find({ slug: { $in: slugs } })
      .toArray();

    // Also check unified accounts
    const unifiedNodes = await db.collection('connections_unified_accounts')
      .find({ id: { $in: Array.from(neighborIds) } })
      .toArray();

    // Build nodes array
    const nodes = [
      ...backers.map((b: any) => ({
        id: `backer:${b.slug}`,
        kind: 'BACKER' as const,
        label: b.name || b.slug,
        seedAuthority: b.authority ?? 0.8,
        confidence: 0.9,
      })),
      ...unifiedNodes
        .filter((n: any) => !backers.find((b: any) => `backer:${b.slug}` === n.id))
        .map((n: any) => ({
          id: n.id,
          kind: n.kind || 'TWITTER',
          label: n.title || n.label || n.id,
          seedAuthority: n.authority ?? n.seedAuthority ?? 0,
          confidence: n.confidence ?? 0.7,
        })),
    ];

    return {
      ok: true,
      backer: backer || { slug, name: slug },
      nodes,
      edges,
    };
  });

  // Get network stats
  app.get('/api/connections/networkv2/stats', async () => {
    const edgesCount = await db.collection('backer_coinvest_edges').countDocuments();
    const investmentsCount = await db.collection('investments').countDocuments();
    
    const topEdges = await db.collection('backer_coinvest_edges')
      .find({})
      .sort({ sharedProjects: -1 })
      .limit(5)
      .toArray();

    return {
      ok: true,
      stats: {
        totalEdges: edgesCount,
        totalInvestments: investmentsCount,
        topConnections: topEdges.map(e => ({
          pair: `${e.source} <-> ${e.target}`,
          sharedProjects: e.sharedProjects,
          weight: e.weight,
        })),
      },
    };
  });

  console.log('[NetworkV2] Routes registered at /api/connections/networkv2/*');
}
