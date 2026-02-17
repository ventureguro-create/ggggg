/**
 * BLOCK 19 - Farm Overlap Graph Service
 * 
 * Builds graph of shared suspicious followers between influencers
 */

import type { Db, Collection, Document } from 'mongodb';
import { computeJaccard, computeOverlapScore, computeClusterConcentration } from '../formulas/farm-overlap.scoring.js';

export interface FarmOverlapEdge {
  a: string;
  b: string;
  sharedSuspects: number;
  sharedTotal: number;
  jaccard: number;
  overlapScore: number;
  topClusters: Array<{ hash: string; cnt: number }>;
  updatedAt: Date;
}

export interface FarmGraphData {
  nodes: Array<{ id: string; type: string }>;
  edges: FarmOverlapEdge[];
}

export interface ActorDetails {
  actorId: string;
  audienceQuality: {
    aqi: number;
    level: string;
    pctBot: number;
    pctHuman: number;
    pctSuspicious: number;
    pctDormant: number;
    reasons: string[];
    totalFollowers: number;
  } | null;
  authenticity: {
    score: number;
    label: string;
    breakdown: {
      realFollowerRatio: number;
      audienceQuality: number;
      networkIntegrity: number;
    };
  } | null;
  farmConnections: Array<{
    connectedActor: string;
    sharedSuspects: number;
    overlapScore: number;
    jaccard: number;
  }>;
  botFarms: Array<{
    farmId: string;
    actorIds: string[];
    botRatio: number;
    confidence: number;
    sharedFollowers: number;
  }>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
}

export class FarmOverlapGraphService {
  private actorFollowers: Collection<Document>;
  private followerFlags: Collection<Document>;
  private farmEdges: Collection<Document>;
  private audienceQualityReports: Collection<Document>;
  private authenticityReports: Collection<Document>;
  private botFarms: Collection<Document>;

  constructor(private db: Db) {
    this.actorFollowers = db.collection('actor_followers');
    this.followerFlags = db.collection('follower_flags');
    this.farmEdges = db.collection('farm_overlap_edges');
    this.audienceQualityReports = db.collection('audience_quality_reports');
    this.authenticityReports = db.collection('influencer_authenticity_reports');
    this.botFarms = db.collection('bot_farms');
  }

  /**
   * Recompute farm overlap graph
   */
  async recompute(params: {
    actorIds: string[];
    minSharedSuspects?: number;
    limitPairs?: number;
  }): Promise<{ edges: number; updatedAt: string }> {
    const { actorIds, minSharedSuspects = 8, limitPairs = 200 } = params;

    // Get raw overlaps from simplified pipeline
    const raw = await this.computeOverlaps(actorIds, minSharedSuspects, limitPairs);

    // Get suspect counts per actor
    const suspectTotals = new Map<string, number>();
    for (const id of actorIds) {
      suspectTotals.set(id, await this.countSuspects(id));
    }

    // Enrich with jaccard and overlap score
    const now = new Date();
    const edges: FarmOverlapEdge[] = raw.map((e: any) => {
      const aTotal = suspectTotals.get(e.a) ?? 0;
      const bTotal = suspectTotals.get(e.b) ?? 0;

      const jaccard = computeJaccard(e.sharedSuspects, aTotal, bTotal);
      const conc = computeClusterConcentration(e.topClusters ?? [], e.sharedSuspects);
      const overlapScore = computeOverlapScore({
        sharedSuspects: e.sharedSuspects,
        jaccard,
        clusterConcentration: conc
      });

      return {
        a: e.a,
        b: e.b,
        sharedSuspects: e.sharedSuspects,
        sharedTotal: e.sharedSuspects,
        jaccard: Math.round(jaccard * 10000) / 10000,
        overlapScore: Math.round(overlapScore * 10000) / 10000,
        topClusters: e.topClusters ?? [],
        updatedAt: now
      };
    });

    // Upsert edges
    for (const ed of edges) {
      await this.farmEdges.updateOne(
        { a: ed.a, b: ed.b },
        { $set: ed },
        { upsert: true }
      );
    }

    return { edges: edges.length, updatedAt: now.toISOString() };
  }

  /**
   * Get farm graph data
   */
  async getGraph(params: { minScore?: number; limit?: number }): Promise<FarmGraphData> {
    const { minScore = 0.35, limit = 200 } = params;

    const edges = await this.farmEdges
      .find({ overlapScore: { $gte: minScore } })
      .sort({ overlapScore: -1 })
      .limit(limit)
      .toArray() as unknown as FarmOverlapEdge[];

    const nodesSet = new Set<string>();
    edges.forEach(e => {
      nodesSet.add(e.a);
      nodesSet.add(e.b);
    });

    const nodes = Array.from(nodesSet).map(id => ({ id, type: 'ACTOR' }));

    return { nodes, edges };
  }

  /**
   * Count suspects for an actor
   */
  private async countSuspects(actorId: string): Promise<number> {
    const result = await this.actorFollowers.aggregate([
      { $match: { actorId } },
      {
        $lookup: {
          from: 'follower_flags',
          localField: 'followerId',
          foreignField: 'followerId',
          as: 'flag'
        }
      },
      { $unwind: '$flag' },
      { $match: { 'flag.isSuspect': true } },
      { $count: 'n' }
    ]).toArray();

    return result[0]?.n ?? 0;
  }

  /**
   * Compute overlaps using simplified approach
   */
  private async computeOverlaps(
    actorIds: string[],
    minShared: number,
    limit: number
  ): Promise<any[]> {
    // Simplified: get suspect followers per actor and compute pairs in memory
    const suspectsByActor = new Map<string, Set<string>>();

    for (const actorId of actorIds) {
      const suspects = await this.actorFollowers.aggregate([
        { $match: { actorId } },
        {
          $lookup: {
            from: 'follower_flags',
            localField: 'followerId',
            foreignField: 'followerId',
            as: 'flag'
          }
        },
        { $unwind: '$flag' },
        { $match: { 'flag.isSuspect': true } },
        { $project: { followerId: 1 } }
      ]).toArray();

      suspectsByActor.set(actorId, new Set(suspects.map(s => s.followerId)));
    }

    // Compute pairs
    const results: any[] = [];
    const actorList = Array.from(suspectsByActor.keys());

    for (let i = 0; i < actorList.length; i++) {
      for (let j = i + 1; j < actorList.length; j++) {
        const a = actorList[i];
        const b = actorList[j];
        const setA = suspectsByActor.get(a)!;
        const setB = suspectsByActor.get(b)!;

        let shared = 0;
        for (const id of setA) {
          if (setB.has(id)) shared++;
        }

        if (shared >= minShared) {
          results.push({
            a,
            b,
            sharedSuspects: shared,
            topClusters: []
          });
        }
      }
    }

    return results.sort((x, y) => y.sharedSuspects - x.sharedSuspects).slice(0, limit);
  }

  /**
   * Get detailed actor info for popup modal
   */
  async getActorDetails(actorId: string): Promise<ActorDetails> {
    // 1. Get audience quality report
    const aqReport = await this.audienceQualityReports.findOne(
      { actorId },
      { projection: { _id: 0 } }
    ) as any;

    // 2. Get authenticity report
    const authReport = await this.authenticityReports.findOne(
      { actorId },
      { projection: { _id: 0 } }
    ) as any;

    // 3. Get farm connections (edges where this actor is involved)
    const farmEdges = await this.farmEdges
      .find({
        $or: [{ a: actorId }, { b: actorId }]
      })
      .sort({ overlapScore: -1 })
      .limit(10)
      .toArray();

    const farmConnections = farmEdges.map((edge: any) => ({
      connectedActor: edge.a === actorId ? edge.b : edge.a,
      sharedSuspects: edge.sharedSuspects,
      overlapScore: edge.overlapScore,
      jaccard: edge.jaccard
    }));

    // 4. Get bot farms this actor is part of
    const botFarmDocs = await this.botFarms
      .find({ actorIds: actorId })
      .limit(5)
      .toArray();

    const botFarmsData = botFarmDocs.map((farm: any) => ({
      farmId: farm.farmId,
      actorIds: farm.actorIds,
      botRatio: farm.botRatio,
      confidence: farm.confidence,
      sharedFollowers: farm.sharedFollowers
    }));

    // 5. Calculate risk level
    const botPct = aqReport?.pctBot ?? 0;
    const suspiciousPct = aqReport?.pctSuspicious ?? 0;
    const authScore = authReport?.score ?? 100;
    const connectionsCount = farmConnections.length;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (botPct > 40 || suspiciousPct > 50 || authScore < 30 || connectionsCount > 5) {
      riskLevel = 'CRITICAL';
    } else if (botPct > 25 || suspiciousPct > 35 || authScore < 50 || connectionsCount > 3) {
      riskLevel = 'HIGH';
    } else if (botPct > 15 || suspiciousPct > 20 || authScore < 70 || connectionsCount > 1) {
      riskLevel = 'MEDIUM';
    }

    // 6. Generate summary
    const summaryParts: string[] = [];
    if (aqReport) {
      summaryParts.push(`Audience: ${aqReport.pctHuman}% human, ${aqReport.pctBot}% bots`);
    }
    if (authReport) {
      summaryParts.push(`Authenticity: ${authReport.score}/100 (${authReport.label})`);
    }
    if (farmConnections.length > 0) {
      summaryParts.push(`Connected to ${farmConnections.length} other suspicious accounts`);
    }
    if (botFarmsData.length > 0) {
      summaryParts.push(`Part of ${botFarmsData.length} detected bot farm(s)`);
    }

    const summary = summaryParts.length > 0 
      ? summaryParts.join('. ') + '.'
      : 'No detailed data available for this actor.';

    return {
      actorId,
      audienceQuality: aqReport ? {
        aqi: aqReport.aqi,
        level: aqReport.level,
        pctBot: aqReport.pctBot,
        pctHuman: aqReport.pctHuman,
        pctSuspicious: aqReport.pctSuspicious,
        pctDormant: aqReport.pctDormant,
        reasons: aqReport.reasons || [],
        totalFollowers: aqReport.totalFollowers
      } : null,
      authenticity: authReport ? {
        score: authReport.score,
        label: authReport.label,
        breakdown: authReport.breakdown
      } : null,
      farmConnections,
      botFarms: botFarmsData,
      riskLevel,
      summary
    };
  }
}
