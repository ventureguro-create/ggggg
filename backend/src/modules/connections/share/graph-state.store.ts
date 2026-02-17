/**
 * Graph Snapshot Store
 * 
 * In-memory store for graph snapshots used by Authority Engine
 * Stores the latest graph state for authority computation
 */

export interface GraphNode {
  id: string;
  score?: number;
  influence_score?: number;
  label?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength?: number;
  jaccard?: number;
  shared?: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: Date;
  source?: string;
}

class GraphSnapshotStore {
  private snapshot: GraphSnapshot | null = null;
  
  /**
   * Store a new graph snapshot
   */
  setSnapshot(snapshot: GraphSnapshot): void {
    this.snapshot = {
      ...snapshot,
      timestamp: new Date(),
    };
  }
  
  /**
   * Get the latest snapshot
   */
  getLatest(): GraphSnapshot | null {
    return this.snapshot;
  }
  
  /**
   * Check if we have a snapshot
   */
  hasSnapshot(): boolean {
    return this.snapshot !== null;
  }
  
  /**
   * Get snapshot stats
   */
  getStats(): { nodes: number; edges: number; timestamp: Date | null } {
    if (!this.snapshot) {
      return { nodes: 0, edges: 0, timestamp: null };
    }
    return {
      nodes: this.snapshot.nodes.length,
      edges: this.snapshot.edges.length,
      timestamp: this.snapshot.timestamp,
    };
  }
  
  /**
   * Clear the snapshot
   */
  clear(): void {
    this.snapshot = null;
  }
  
  /**
   * Generate mock graph snapshot for testing
   */
  generateMockSnapshot(nodeCount: number = 20): GraphSnapshot {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Generate nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node_${String(i + 1).padStart(3, '0')}`,
        score: 300 + Math.random() * 600,
        influence_score: 200 + Math.random() * 600,
        label: `Account ${i + 1}`,
      });
    }
    
    // Generate edges (random connections)
    const edgeCount = Math.floor(nodeCount * 1.5);
    for (let i = 0; i < edgeCount; i++) {
      const sourceIdx = Math.floor(Math.random() * nodeCount);
      let targetIdx = Math.floor(Math.random() * nodeCount);
      if (targetIdx === sourceIdx) {
        targetIdx = (targetIdx + 1) % nodeCount;
      }
      
      edges.push({
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        strength: 0.3 + Math.random() * 0.6,
        jaccard: 0.1 + Math.random() * 0.5,
        shared: Math.floor(10 + Math.random() * 100),
      });
    }
    
    const snapshot: GraphSnapshot = {
      nodes,
      edges,
      timestamp: new Date(),
      source: 'mock',
    };
    
    this.snapshot = snapshot;
    return snapshot;
  }
}

// Singleton instance
export const graphSnapshotStore = new GraphSnapshotStore();
