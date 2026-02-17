/**
 * Rebuild Co-Investment Edges Job
 * Builds edges between funds based on shared portfolio investments
 */

import { Db } from 'mongodb';

export interface RebuildResult {
  ok: boolean;
  upserts: number;
  modified: number;
  edgesBuilt: number;
}

export async function rebuildCoinvestEdges(db: Db): Promise<RebuildResult> {
  // Check if investments collection exists and has data
  const investmentsCount = await db.collection('investments').countDocuments();
  
  if (investmentsCount === 0) {
    // Seed mock investment data for demo
    await seedMockInvestments(db);
  }

  // Simplified pipeline without $function (for broader MongoDB compatibility)
  const investments = await db.collection('investments')
    .find({ backerId: /^backer:/, projectId: /^project:/ })
    .toArray();

  // Group by project
  const projectBackers = new Map<string, { backers: Set<string>; conf: number[] }>();
  
  for (const inv of investments) {
    if (!projectBackers.has(inv.projectId)) {
      projectBackers.set(inv.projectId, { backers: new Set(), conf: [] });
    }
    const entry = projectBackers.get(inv.projectId)!;
    entry.backers.add(inv.backerId);
    entry.conf.push(inv.confidence ?? 0.8);
  }

  // Generate pairs and aggregate
  const pairStats = new Map<string, { sharedProjects: number; confs: number[]; projects: string[] }>();

  for (const [projectId, { backers, conf }] of projectBackers) {
    const backerList = Array.from(backers);
    if (backerList.length < 2) continue;

    const avgConf = conf.reduce((a, b) => a + b, 0) / conf.length;

    for (let i = 0; i < backerList.length; i++) {
      for (let j = i + 1; j < backerList.length; j++) {
        const key = [backerList[i], backerList[j]].sort().join('|');
        if (!pairStats.has(key)) {
          pairStats.set(key, { sharedProjects: 0, confs: [], projects: [] });
        }
        const entry = pairStats.get(key)!;
        entry.sharedProjects++;
        entry.confs.push(avgConf);
        entry.projects.push(projectId);
      }
    }
  }

  // Build edges
  const edges: any[] = [];
  for (const [key, stats] of pairStats) {
    const [source, target] = key.split('|');
    const avgConf = stats.confs.reduce((a, b) => a + b, 0) / stats.confs.length;
    const weight = Math.min(1, Math.log(stats.sharedProjects + 1) / 2.5);

    edges.push({
      source,
      target,
      sharedProjects: stats.sharedProjects,
      weight,
      confidence: Math.min(1, Math.max(0.1, avgConf)),
      evidence: { projects: stats.projects.slice(0, 20) },
      updatedAt: new Date(),
    });
  }

  if (edges.length === 0) {
    return { ok: true, upserts: 0, modified: 0, edgesBuilt: 0 };
  }

  // Bulk upsert
  const ops = edges.map((e) => ({
    updateOne: {
      filter: { source: e.source, target: e.target },
      update: { $set: e },
      upsert: true,
    },
  }));

  const res = await db.collection('backer_coinvest_edges').bulkWrite(ops, { ordered: false });

  // Create indexes
  await db.collection('backer_coinvest_edges').createIndex({ source: 1, target: 1 }, { unique: true });
  await db.collection('backer_coinvest_edges').createIndex({ weight: -1 });
  await db.collection('backer_coinvest_edges').createIndex({ sharedProjects: -1 });

  return {
    ok: true,
    upserts: res.upsertedCount,
    modified: res.modifiedCount,
    edgesBuilt: edges.length,
  };
}

/**
 * Seed mock investment data for demo
 */
async function seedMockInvestments(db: Db): Promise<void> {
  const backers = ['a16z', 'paradigm', 'sequoia', 'binance', 'polychain', 'coinbase', 'multicoin', 'pantera'];
  const projects = ['arbitrum', 'optimism', 'celestia', 'eigenlayer', 'layerzero', 'blur', 'opensea', 'uniswap', 'aave', 'compound', 'lido', 'rocketpool'];
  
  const investments: any[] = [];
  
  // Each backer invests in 3-6 random projects
  for (const backer of backers) {
    const numInvestments = 3 + Math.floor(Math.random() * 4);
    const selectedProjects = projects
      .sort(() => Math.random() - 0.5)
      .slice(0, numInvestments);
    
    for (const project of selectedProjects) {
      investments.push({
        backerId: `backer:${backer}`,
        projectId: `project:${project}`,
        round: ['Seed', 'Series A', 'Series B'][Math.floor(Math.random() * 3)],
        date: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        confidence: 0.7 + Math.random() * 0.25,
        tags: ['DEFI', 'INFRA', 'L2', 'NFT'].slice(0, 1 + Math.floor(Math.random() * 2)),
      });
    }
  }

  await db.collection('investments').insertMany(investments);
  await db.collection('investments').createIndex({ backerId: 1, projectId: 1 }, { unique: true });
  
  console.log(`[CoinvestJob] Seeded ${investments.length} mock investments`);
}
