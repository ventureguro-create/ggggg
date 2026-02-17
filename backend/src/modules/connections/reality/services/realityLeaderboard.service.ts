/**
 * Reality Leaderboard Service
 * 
 * PHASE E4: Ranking of actors by "truth" vs "talking books"
 * 
 * FORMULA:
 * truth_raw = (C - 1.25*X) / max(1, (C + X))
 * coverage = (C + X) / max(1, T)
 * sample_conf = 1 - exp(-(C+X)/k)  // k = 12
 * authority_w = clamp(0.75 + 0.5 * authority_0_1, 0.75, 1.25)
 * 
 * reality_score = 100 * clamp((0.55*truth_raw + 0.45*coverage) * sample_conf * authority_w, -1, 1)
 */

import { Db } from 'mongodb';
import { 
  LeaderboardEntry, 
  LeaderboardConfig, 
  DEFAULT_LEADERBOARD_CONFIG,
  RealityLevel 
} from '../contracts/reality.types.js';

let db: Db;
let config: LeaderboardConfig = DEFAULT_LEADERBOARD_CONFIG;

export function initRealityLeaderboard(database: Db) {
  db = database;
  console.log('[RealityLeaderboard] Service initialized');
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/**
 * Calculate reality score for an actor
 */
function calculateRealityScore(
  confirms: number,
  contradicts: number,
  nodata: number,
  authority_0_1: number = 0.5,
  cfg: LeaderboardConfig = config
): { score: number; level: RealityLevel } {
  const C = confirms;
  const X = contradicts;
  const N = nodata;
  const T = C + X + N;
  const sample = C + X;
  
  // Insufficient data
  if (sample < cfg.min_sample) {
    return { score: 0, level: 'INSUFFICIENT' };
  }
  
  // 1. Truth raw score
  const truthRaw = (C - cfg.contradict_penalty * X) / Math.max(1, sample);
  
  // 2. Coverage factor
  const coverage = sample / Math.max(1, T);
  
  // 3. Sample confidence (penalize small samples)
  const sampleConf = 1 - Math.exp(-sample / cfg.k_sample);
  
  // 4. Authority weight
  const authorityW = clamp(0.75 + 0.5 * authority_0_1, 0.75, 1.25);
  
  // 5. Final score
  const rawScore = (0.55 * truthRaw + 0.45 * coverage) * sampleConf * authorityW;
  const score = Math.round(100 * clamp(rawScore, -1, 1));
  
  // Determine level
  let level: RealityLevel;
  if (score >= 70) level = 'ELITE';
  else if (score >= 45) level = 'STRONG';
  else if (score >= 20) level = 'MIXED';
  else level = 'RISKY';
  
  return { score, level };
}

export interface LeaderboardQuery {
  windowDays?: number;
  group?: string;
  limit?: number;
  sort?: 'score' | 'confirms' | 'contradicts' | 'sample';
  minSample?: number;
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  query: LeaderboardQuery = {}
): Promise<LeaderboardEntry[]> {
  const {
    windowDays = 30,
    group,
    limit = 50,
    sort = 'score',
    minSample = config.min_sample,
  } = query;
  
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  
  // 1. Aggregate per actor from ledger
  const pipeline: any[] = [
    { $match: { ts: { $gte: since } } },
    {
      $group: {
        _id: '$actorId',
        confirms: { $sum: { $cond: [{ $eq: ['$verdict', 'CONFIRMS'] }, 1, 0] } },
        contradicts: { $sum: { $cond: [{ $eq: ['$verdict', 'CONTRADICTS'] }, 1, 0] } },
        nodata: { $sum: { $cond: [{ $eq: ['$verdict', 'NO_DATA'] }, 1, 0] } },
        lastTs: { $max: '$ts' },
      },
    },
    {
      $addFields: {
        total: { $add: ['$confirms', '$contradicts', '$nodata'] },
        sample: { $add: ['$confirms', '$contradicts'] },
      },
    },
    { $match: { sample: { $gte: minSample } } },
  ];
  
  // 2. Join with profiles for authority/name
  pipeline.push(
    {
      $lookup: {
        from: 'connections_unified_accounts',
        localField: '_id',
        foreignField: 'id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        authority_0_1: { $ifNull: ['$profile.authority', { $ifNull: ['$profile.score.authority', 0.5] }] },
        username: { $ifNull: ['$profile.username', '$profile.handle'] },
        name: '$profile.title',
        avatar: '$profile.avatar',
      },
    }
  );
  
  // 3. Filter by taxonomy group if specified
  if (group) {
    pipeline.push(
      {
        $lookup: {
          from: 'connections_taxonomy_membership',
          let: { actorId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$accountId', '$$actorId'] },
              { $eq: ['$group', group] },
              { $gte: ['$weight', config.taxonomy_weight_threshold] },
            ] } } },
          ],
          as: 'membership',
        },
      },
      { $match: { 'membership.0': { $exists: true } } }
    );
  }
  
  // 4. Limit
  pipeline.push({ $limit: limit * 2 }); // Get more for scoring filter
  
  const rawResults = await db.collection('connections_reality_ledger')
    .aggregate(pipeline)
    .toArray();
  
  // 5. Calculate scores in JS (more control)
  const entries: LeaderboardEntry[] = rawResults.map((r: any) => {
    const { score, level } = calculateRealityScore(
      r.confirms,
      r.contradicts,
      r.nodata,
      r.authority_0_1
    );
    
    return {
      actorId: r._id,
      username: r.username,
      name: r.name,
      avatar: r.avatar,
      confirms: r.confirms,
      contradicts: r.contradicts,
      nodata: r.nodata,
      total: r.total,
      sample: r.sample,
      realityScore: score,
      level,
      authority_0_1: r.authority_0_1,
      lastTs: r.lastTs,
    };
  });
  
  // 6. Sort
  entries.sort((a, b) => {
    switch (sort) {
      case 'confirms': return b.confirms - a.confirms;
      case 'contradicts': return b.contradicts - a.contradicts;
      case 'sample': return b.sample - a.sample;
      default: return b.realityScore - a.realityScore;
    }
  });
  
  return entries.slice(0, limit);
}

/**
 * Get actor reality summary
 */
export async function getActorReality(
  actorId: string,
  windowDays: number = 30
): Promise<LeaderboardEntry | null> {
  const entries = await getLeaderboard({
    windowDays,
    limit: 1000,
    minSample: 0,
  });
  
  return entries.find(e => e.actorId === actorId) || null;
}

/**
 * Get leaderboard config
 */
export async function getLeaderboardConfig(): Promise<LeaderboardConfig> {
  const doc = await db.collection('connections_reality_config').findOne({ _id: 'leaderboard' });
  return doc ?? DEFAULT_LEADERBOARD_CONFIG;
}

/**
 * Update leaderboard config
 */
export async function updateLeaderboardConfig(patch: Partial<LeaderboardConfig>): Promise<LeaderboardConfig> {
  config = { ...config, ...patch };
  
  await db.collection('connections_reality_config').updateOne(
    { _id: 'leaderboard' },
    { $set: { ...config, updatedAt: new Date() } },
    { upsert: true }
  );
  
  return config;
}
