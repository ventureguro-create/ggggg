/**
 * Co-Investment Builder Service
 * 
 * Executes pipeline and saves edges to network_v2_edges collection.
 */

import { Db } from 'mongodb';
import { buildCoInvestmentPipeline, buildBackerProjectPipeline } from './coinvest.pipeline.js';
import type { BuildCoInvestParams, BuildResult, NetworkEdge } from '../network-v2-plus.types.js';

export class CoInvestmentBuilder {
  constructor(private db: Db) {}

  /**
   * Build co-investment edges snapshot
   */
  async buildCoInvestment(params: BuildCoInvestParams): Promise<BuildResult> {
    const startTime = Date.now();
    const snapshotId = `coinvest_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const warnings: string[] = [];

    console.log(`[CoInvestBuilder] Starting build with params:`, params);

    try {
      // Check if investments collection exists
      const collections = await this.db.listCollections({ name: 'backer_investments' }).toArray();
      if (collections.length === 0) {
        // Create collection with sample data for development
        console.log('[CoInvestBuilder] Creating backer_investments collection...');
        await this.createSampleInvestments();
        warnings.push('Created sample investments data');
      }

      // Run pipeline
      const pipeline = buildCoInvestmentPipeline(params);
      const edges = await this.db
        .collection('backer_investments')
        .aggregate(pipeline, { allowDiskUse: true })
        .toArray();

      console.log(`[CoInvestBuilder] Pipeline returned ${edges.length} edges`);

      if (edges.length === 0) {
        return {
          snapshotId,
          edgesBuilt: 0,
          nodesProcessed: 0,
          durationMs: Date.now() - startTime,
          warnings: [...warnings, 'No edges found'],
        };
      }

      // Prepare documents
      const docs = edges.map((e: any) => ({
        ...e,
        snapshotId,
        source: 'backers',
        createdAt: new Date(),
      }));

      // Insert edges
      await this.db.collection('network_v2_edges').insertMany(docs);

      // Count unique nodes
      const nodeSet = new Set<string>();
      edges.forEach((e: any) => {
        nodeSet.add(e.from);
        nodeSet.add(e.to);
      });

      // Save snapshot metadata
      await this.db.collection('network_v2_snapshots').insertOne({
        id: snapshotId,
        type: 'CO_INVESTMENT',
        createdAt: new Date(),
        edgesCount: docs.length,
        nodesCount: nodeSet.size,
        params,
      });

      console.log(`[CoInvestBuilder] Build complete: ${docs.length} edges, ${nodeSet.size} nodes`);

      return {
        snapshotId,
        edgesBuilt: docs.length,
        nodesProcessed: nodeSet.size,
        durationMs: Date.now() - startTime,
        warnings,
      };
    } catch (err: any) {
      console.error('[CoInvestBuilder] Build failed:', err);
      throw err;
    }
  }

  /**
   * Build Backer → Project edges
   */
  async buildBackerProjects(minConfidence = 0.6): Promise<BuildResult> {
    const startTime = Date.now();
    const snapshotId = `backer_projects_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    const pipeline = buildBackerProjectPipeline(minConfidence);
    const edges = await this.db
      .collection('backer_investments')
      .aggregate(pipeline)
      .toArray();

    if (edges.length === 0) {
      return {
        snapshotId,
        edgesBuilt: 0,
        nodesProcessed: 0,
        durationMs: Date.now() - startTime,
        warnings: ['No backer-project edges found'],
      };
    }

    const docs = edges.map((e: any) => ({
      ...e,
      snapshotId,
      source: 'backers',
      createdAt: new Date(),
    }));

    await this.db.collection('network_v2_edges').insertMany(docs);

    return {
      snapshotId,
      edgesBuilt: docs.length,
      nodesProcessed: new Set(docs.flatMap((d: any) => [d.from, d.to])).size,
      durationMs: Date.now() - startTime,
      warnings: [],
    };
  }

  /**
   * Create sample investments for development
   */
  private async createSampleInvestments(): Promise<void> {
    const backers = [
      'bkr_a16z', 'bkr_paradigm', 'bkr_binance_labs', 'bkr_sequoia',
      'bkr_polychain', 'bkr_coinbase_ventures', 'bkr_multicoin',
    ];
    const projects = [
      'prj_uniswap', 'prj_aave', 'prj_compound', 'prj_opensea',
      'prj_dydx', 'prj_arbitrum', 'prj_optimism', 'prj_blur',
    ];
    const rounds = ['Seed', 'A', 'B', 'C'];

    const investments: any[] = [];

    // Generate realistic investment patterns
    projects.forEach((project, pi) => {
      // Each project has 2-4 backers
      const numBackers = 2 + Math.floor(Math.random() * 3);
      const selectedBackers = backers
        .sort(() => Math.random() - 0.5)
        .slice(0, numBackers);

      selectedBackers.forEach((backer) => {
        investments.push({
          backerId: backer,
          projectId: project,
          round: rounds[Math.floor(Math.random() * rounds.length)],
          amountUsd: 1000000 + Math.floor(Math.random() * 10000000),
          announcedAt: new Date(2023 + Math.floor(pi / 4), pi % 12, 1),
          source: 'manual',
          confidence: 0.8 + Math.random() * 0.2,
        });
      });
    });

    await this.db.collection('backer_investments').insertMany(investments);
    console.log(`[CoInvestBuilder] Created ${investments.length} sample investments`);
  }
}

console.log('[CoInvestBuilder] Service loaded');
