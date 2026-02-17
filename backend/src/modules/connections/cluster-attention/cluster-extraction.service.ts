/**
 * БЛОК 1 - Cluster Extraction Service
 * Extracts influencer clusters from follow graph using connected components
 */

import { Db, ObjectId } from 'mongodb';
import { InfluencerCluster, ClusterMetrics, ClusterEdge } from './cluster.types.js';

// Thresholds for cluster building
const T_FOLLOW = 0.3;      // minimum follow weight
const T_PATH = 0.2;        // minimum handshake path weight  
const T_REACT = 0.15;      // minimum co-reaction rate
const T_EDGE = 0.4;        // minimum combined edge strength
const MIN_CLUSTER_SIZE = 3;

export class ClusterExtractionService {
  private db: Db | null = null;

  setDb(db: Db) {
    this.db = db;
  }

  /**
   * Build all clusters from network data
   */
  async buildClusters(): Promise<InfluencerCluster[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('[ClusterExtraction] Building clusters from network...');

    // 1. Load network edges
    const edges = await this.loadNetworkEdges();
    console.log(`[ClusterExtraction] Loaded ${edges.length} edges`);

    // 2. Build undirected graph
    const graph = this.buildUndirectedGraph(edges);
    console.log(`[ClusterExtraction] Graph has ${graph.size} nodes`);

    // 3. Find connected components
    const components = this.findConnectedComponents(graph);
    console.log(`[ClusterExtraction] Found ${components.length} components`);

    // 4. Filter by size and convert to clusters
    const clusters = components
      .filter(c => c.length >= MIN_CLUSTER_SIZE)
      .map((members, idx) => this.createCluster(members, edges, idx));

    console.log(`[ClusterExtraction] Created ${clusters.length} clusters (min size ${MIN_CLUSTER_SIZE})`);

    // 5. Save to database
    await this.saveClusters(clusters);

    return clusters;
  }

  /**
   * Load edges from follow graph + parsed edges
   */
  private async loadNetworkEdges(): Promise<ClusterEdge[]> {
    const edges: ClusterEdge[] = [];

    // Load from parser_follow_edges
    const followEdges = await this.db!.collection('parser_follow_edges')
      .find({})
      .limit(5000)
      .toArray();

    for (const e of followEdges) {
      if (e.sourceUsername && e.targetUsername) {
        const weight = this.calculateFollowWeight(e);
        if (weight >= T_FOLLOW) {
          edges.push({
            source: e.sourceUsername.toLowerCase(),
            target: e.targetUsername.toLowerCase(),
            weight,
          });
        }
      }
    }

    // Load from parser_follower_edges (reverse direction)
    const followerEdges = await this.db!.collection('parser_follower_edges')
      .find({})
      .limit(5000)
      .toArray();

    for (const e of followerEdges) {
      if (e.followerUsername && e.targetUsername) {
        const weight = this.calculateFollowerWeight(e);
        if (weight >= T_FOLLOW) {
          edges.push({
            source: e.followerUsername.toLowerCase(),
            target: e.targetUsername.toLowerCase(),
            weight,
          });
        }
      }
    }

    // Load from connections_follow_graph if exists
    const oldFollowGraph = await this.db!.collection('connections_follow_graph')
      .find({})
      .limit(2000)
      .toArray();

    for (const e of oldFollowGraph) {
      if (e.follower_username && e.following_username) {
        edges.push({
          source: e.follower_username.toLowerCase(),
          target: e.following_username.toLowerCase(),
          weight: e.weight || 0.5,
        });
      }
    }

    return edges;
  }

  private calculateFollowWeight(edge: any): number {
    // Higher weight for verified accounts and high follower counts
    let weight = 0.3;
    if (edge.targetVerified) weight += 0.2;
    if (edge.targetFollowers > 100000) weight += 0.3;
    else if (edge.targetFollowers > 10000) weight += 0.2;
    else if (edge.targetFollowers > 1000) weight += 0.1;
    return Math.min(weight, 1.0);
  }

  private calculateFollowerWeight(edge: any): number {
    let weight = 0.3;
    if (edge.followerVerified) weight += 0.2;
    if (edge.followerFollowers > 100000) weight += 0.3;
    else if (edge.followerFollowers > 10000) weight += 0.2;
    else if (edge.followerFollowers > 1000) weight += 0.1;
    return Math.min(weight, 1.0);
  }

  /**
   * Build undirected graph from edges
   */
  private buildUndirectedGraph(edges: ClusterEdge[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    // Aggregate edge weights between same pairs
    const edgeWeights = new Map<string, number>();
    
    for (const edge of edges) {
      const key1 = `${edge.source}:${edge.target}`;
      const key2 = `${edge.target}:${edge.source}`;
      
      // Use max weight between bidirectional edges
      const currentWeight = edgeWeights.get(key1) || edgeWeights.get(key2) || 0;
      const newWeight = Math.max(currentWeight, edge.weight);
      edgeWeights.set(key1, newWeight);
    }

    // Build adjacency list for edges above threshold
    for (const [key, weight] of edgeWeights) {
      if (weight < T_EDGE) continue;

      const [source, target] = key.split(':');
      
      if (!graph.has(source)) graph.set(source, new Set());
      if (!graph.has(target)) graph.set(target, new Set());
      
      graph.get(source)!.add(target);
      graph.get(target)!.add(source);
    }

    return graph;
  }

  /**
   * Find connected components using BFS
   */
  private findConnectedComponents(graph: Map<string, Set<string>>): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const node of graph.keys()) {
      if (visited.has(node)) continue;

      // BFS to find all connected nodes
      const component: string[] = [];
      const queue = [node];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        component.push(current);

        const neighbors = graph.get(current) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Create cluster object from members
   */
  private createCluster(members: string[], edges: ClusterEdge[], index: number): InfluencerCluster {
    const memberSet = new Set(members);
    
    // Calculate cohesion (internal edges / max possible edges)
    let internalEdges = 0;
    for (const edge of edges) {
      if (memberSet.has(edge.source) && memberSet.has(edge.target)) {
        internalEdges++;
      }
    }
    const maxEdges = (members.length * (members.length - 1)) / 2;
    const cohesion = maxEdges > 0 ? internalEdges / maxEdges : 0;

    // Sum authority (placeholder - will be enhanced with real authority)
    const authority = members.length * 0.5; // Base authority per member

    return {
      id: `cluster_${Date.now()}_${index}`,
      members,
      metrics: {
        size: members.length,
        cohesion: Math.min(cohesion, 1.0),
        authority,
        avgTrust: 0.7, // Default trust
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Save clusters to MongoDB
   */
  private async saveClusters(clusters: InfluencerCluster[]): Promise<void> {
    const collection = this.db!.collection('influencer_clusters');

    // Clear old clusters
    await collection.deleteMany({});

    if (clusters.length > 0) {
      await collection.insertMany(clusters);
      console.log(`[ClusterExtraction] Saved ${clusters.length} clusters to database`);
    }

    // Create indexes
    await collection.createIndex({ 'metrics.authority': -1 });
    await collection.createIndex({ 'metrics.cohesion': -1 });
    await collection.createIndex({ members: 1 });
  }

  /**
   * Get all clusters
   */
  async getClusters(): Promise<InfluencerCluster[]> {
    if (!this.db) return [];
    return this.db.collection('influencer_clusters')
      .find({})
      .sort({ 'metrics.authority': -1 })
      .toArray() as Promise<InfluencerCluster[]>;
  }

  /**
   * Get cluster by ID
   */
  async getCluster(clusterId: string): Promise<InfluencerCluster | null> {
    if (!this.db) return null;
    return this.db.collection('influencer_clusters')
      .findOne({ id: clusterId }) as Promise<InfluencerCluster | null>;
  }

  /**
   * Find cluster containing a specific user
   */
  async findClusterByMember(username: string): Promise<InfluencerCluster | null> {
    if (!this.db) return null;
    return this.db.collection('influencer_clusters')
      .findOne({ members: username.toLowerCase() }) as Promise<InfluencerCluster | null>;
  }
}

export const clusterExtractionService = new ClusterExtractionService();
