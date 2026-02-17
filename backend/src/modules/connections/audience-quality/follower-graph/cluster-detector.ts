/**
 * Cluster Detection
 * 
 * Finds connected components in the follower graph.
 * Clusters with high bot ratio are flagged as suspicious.
 */

import type { FollowerEdge, FollowerCluster } from './follower-graph.types.js';
import type { AQEFollowerClassified, AQELabel } from '../contracts/audienceQuality.types.js';

/**
 * Union-Find data structure for efficient clustering
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return;
    
    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;
    
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    
    for (const [node] of this.parent) {
      const root = this.find(node);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(node);
    }
    
    return clusters;
  }
}

/**
 * Detect clusters from edges
 * 
 * Uses Union-Find for O(n * α(n)) complexity.
 */
export function detectClusters(
  classified: AQEFollowerClassified[],
  edges: FollowerEdge[],
  minClusterSize: number = 3,
  minAvgWeight: number = 0.4
): FollowerCluster[] {
  const uf = new UnionFind();
  const labelMap = new Map<string, AQELabel>();
  
  // Build label lookup
  for (const f of classified) {
    labelMap.set(f.followerId, f.label);
    uf.find(f.followerId);  // Initialize in union-find
  }
  
  // Union connected nodes
  for (const edge of edges) {
    if (edge.weight >= minAvgWeight) {
      uf.union(edge.from, edge.to);
    }
  }
  
  // Get clusters
  const rawClusters = uf.getClusters();
  const clusters: FollowerCluster[] = [];
  let clusterId = 0;
  
  for (const [root, members] of rawClusters) {
    if (members.length < minClusterSize) continue;
    
    // Calculate cluster metrics
    let botCount = 0;
    let suspiciousCount = 0;
    const labelCounts: Record<string, number> = { REAL: 0, BOT: 0, SUSPICIOUS: 0 };
    
    for (const m of members) {
      const label = labelMap.get(m);
      if (label === 'BOT_LIKELY' || label === 'FARM_NODE') {
        botCount++;
        labelCounts['BOT']++;
      } else if (label === 'LOW_QUALITY') {
        suspiciousCount++;
        labelCounts['SUSPICIOUS']++;
      } else {
        labelCounts['REAL']++;
      }
    }
    
    const botRatio = (botCount + suspiciousCount * 0.5) / members.length;
    
    // Calculate average edge weight within cluster
    let totalWeight = 0;
    let edgeCount = 0;
    const memberSet = new Set(members);
    
    for (const edge of edges) {
      if (memberSet.has(edge.from) && memberSet.has(edge.to)) {
        totalWeight += edge.weight;
        edgeCount++;
      }
    }
    
    const avgWeight = edgeCount > 0 ? totalWeight / edgeCount : 0;
    
    // Determine dominant label
    const dominantLabel = 
      labelCounts['BOT'] >= labelCounts['SUSPICIOUS'] && labelCounts['BOT'] >= labelCounts['REAL'] ? 'BOT' :
      labelCounts['SUSPICIOUS'] >= labelCounts['REAL'] ? 'SUSPICIOUS' : 'REAL';
    
    // Suspicious if bot ratio > 50% OR avg weight very high with bots
    const suspicious = botRatio > 0.5 || (avgWeight > 0.7 && botCount > 2);
    
    clusters.push({
      clusterId: `cluster_${clusterId++}`,
      nodes: members,
      size: members.length,
      botRatio: Math.round(botRatio * 100) / 100,
      suspicious,
      avgWeight: Math.round(avgWeight * 100) / 100,
      dominantLabel,
    });
  }
  
  // Sort by suspiciousness and size
  return clusters.sort((a, b) => {
    if (a.suspicious !== b.suspicious) return a.suspicious ? -1 : 1;
    return b.size - a.size;
  });
}
