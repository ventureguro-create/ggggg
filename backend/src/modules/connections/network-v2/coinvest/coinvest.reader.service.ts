/**
 * Co-Investment Reader Service
 * 
 * Reads edges from network_v2_edges for UI/API.
 */

import { Db } from 'mongodb';
import type { NetworkEdge, NetworkSnapshot } from '../network-v2-plus.types.js';

export class CoInvestmentReader {
  constructor(private db: Db) {}

  /**
   * List co-investment edges
   */
  async listEdges(
    snapshotId?: string,
    minWeight = 0.2,
    limit = 2000
  ): Promise<any[]> {
    const query: any = {
      type: 'CO_INVESTMENT',
      weight: { $gte: minWeight },
    };
    if (snapshotId) query.snapshotId = snapshotId;

    return this.db
      .collection('network_v2_edges')
      .find(query)
      .sort({ weight: -1 })
      .limit(limit)
      .project({ _id: 0 })
      .toArray();
  }

  /**
   * Get network around a backer
   */
  async backerNetwork(
    backerId: string,
    snapshotId?: string,
    depth = 1
  ): Promise<{ nodes: any[]; edges: any[] }> {
    const query: any = {
      $or: [{ from: backerId }, { to: backerId }],
    };
    if (snapshotId) query.snapshotId = snapshotId;

    const directEdges = await this.db
      .collection('network_v2_edges')
      .find(query)
      .project({ _id: 0 })
      .toArray();

    // Collect connected nodes
    const connectedIds = new Set<string>();
    directEdges.forEach((e: any) => {
      connectedIds.add(e.from);
      connectedIds.add(e.to);
    });

    let allEdges = directEdges;

    // Depth 2: get edges between connected nodes
    if (depth >= 2 && connectedIds.size > 0) {
      const connectedArray = Array.from(connectedIds);
      const secondQuery: any = {
        from: { $in: connectedArray },
        to: { $in: connectedArray },
      };
      if (snapshotId) secondQuery.snapshotId = snapshotId;

      const secondEdges = await this.db
        .collection('network_v2_edges')
        .find(secondQuery)
        .project({ _id: 0 })
        .toArray();

      allEdges = [...directEdges, ...secondEdges];
      secondEdges.forEach((e: any) => {
        connectedIds.add(e.from);
        connectedIds.add(e.to);
      });
    }

    // Get node info from backers collection
    const nodeIds = Array.from(connectedIds);
    const backers = await this.db
      .collection('connections_backers')
      .find({ _id: { $in: nodeIds.map(id => id) } })
      .project({ _id: 1, name: 1, type: 1, seedAuthority: 1, categories: 1 })
      .toArray();

    const backersById = Object.fromEntries(
      backers.map((b: any) => [b._id.toString(), b])
    );

    const nodes = nodeIds.map(id => {
      const backer = backersById[id];
      return backer
        ? {
            id,
            name: backer.name,
            type: backer.type,
            authority: (backer.seedAuthority || 0) / 100,
            categories: backer.categories || [],
          }
        : { id, name: id, type: 'UNKNOWN', authority: 0 };
    });

    // Deduplicate edges
    const edgeKey = (e: any) => `${e.from}-${e.to}-${e.type}`;
    const uniqueEdges = Array.from(
      new Map(allEdges.map(e => [edgeKey(e), e])).values()
    );

    return { nodes, edges: uniqueEdges };
  }

  /**
   * Get pair details
   */
  async pairDetails(a: string, b: string, snapshotId?: string): Promise<any | null> {
    const query: any = {
      type: 'CO_INVESTMENT',
      $or: [
        { from: a, to: b },
        { from: b, to: a },
      ],
    };
    if (snapshotId) query.snapshotId = snapshotId;

    return this.db.collection('network_v2_edges').findOne(query, {
      projection: { _id: 0 },
    });
  }

  /**
   * List snapshots
   */
  async listSnapshots(type?: string): Promise<NetworkSnapshot[]> {
    const query: any = {};
    if (type) query.type = type;

    return this.db
      .collection('network_v2_snapshots')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray() as Promise<NetworkSnapshot[]>;
  }

  /**
   * Get latest snapshot ID
   */
  async getLatestSnapshotId(type = 'CO_INVESTMENT'): Promise<string | null> {
    const snapshot = await this.db
      .collection('network_v2_snapshots')
      .findOne({ type }, { sort: { createdAt: -1 } });
    return snapshot?.id || null;
  }

  /**
   * Get co-investors for a backer (top N)
   */
  async getCoInvestors(backerId: string, limit = 10): Promise<any[]> {
    const edges = await this.db
      .collection('network_v2_edges')
      .find({
        type: 'CO_INVESTMENT',
        $or: [{ from: backerId }, { to: backerId }],
      })
      .sort({ weight: -1 })
      .limit(limit)
      .project({ _id: 0 })
      .toArray();

    return edges.map((e: any) => ({
      backerId: e.from === backerId ? e.to : e.from,
      sharedCount: e.sharedCount,
      sharedProjects: e.sharedProjects,
      weight: e.weight,
    }));
  }

  /**
   * Get backer's portfolio investments
   */
  async getBackerInvestments(backerId: string, limit = 50): Promise<any[]> {
    return this.db
      .collection('backer_investments')
      .aggregate([
        { $match: { backerId } },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'project'
          }
        },
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
        { $sort: { announcedAt: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            projectId: 1,
            round: 1,
            confidence: 1,
            announcedAt: 1,
            project: {
              name: '$project.name',
              categories: '$project.categories',
              stage: '$project.stage'
            }
          }
        }
      ])
      .toArray();
  }
}

console.log('[CoInvestReader] Service loaded');
