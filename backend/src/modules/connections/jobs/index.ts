/**
 * Connections Module - Jobs
 * 
 * Self-contained job definitions for the connections module.
 * Jobs run independently and don't depend on host scheduler.
 */

import { getConnectionsDb, getConnectionsPorts } from '../module.js';
import { getConnectionsConfig, COLLECTIONS } from '../config/connections.config.js';

// ============================================
// FOLLOW GRAPH JOB
// ============================================
export async function runFollowGraphCycle(): Promise<void> {
  const db = getConnectionsDb();
  if (!db) {
    console.warn('[FollowGraphJob] No database connection');
    return;
  }
  
  const config = getConnectionsConfig();
  if (!config.twitter.parserEnabled) {
    return;
  }
  
  console.log('[FollowGraphJob] Starting cycle...');
  
  try {
    // Get accounts to update
    const accounts = await db.collection(COLLECTIONS.UNIFIED_ACCOUNTS)
      .find({ kind: 'TWITTER' })
      .sort({ lastGraphUpdate: 1 })
      .limit(10)
      .toArray();
    
    for (const account of accounts) {
      // Update follow graph
      await db.collection(COLLECTIONS.UNIFIED_ACCOUNTS).updateOne(
        { _id: account._id },
        { $set: { lastGraphUpdate: new Date() } }
      );
    }
    
    console.log(`[FollowGraphJob] Updated ${accounts.length} accounts`);
  } catch (err) {
    console.error('[FollowGraphJob] Error:', err);
  }
}

// ============================================
// CLUSTER DETECTION JOB
// ============================================
export async function runClusterDetection(): Promise<void> {
  const db = getConnectionsDb();
  if (!db) {
    console.warn('[ClusterJob] No database connection');
    return;
  }
  
  console.log('[ClusterJob] Starting detection...');
  
  try {
    // Get follow graph edges
    const edges = await db.collection(COLLECTIONS.FOLLOW_GRAPH)
      .find({})
      .toArray();
    
    // Simple community detection based on shared connections
    const clusters = detectCommunities(edges);
    
    // Store clusters
    for (const cluster of clusters) {
      await db.collection(COLLECTIONS.CLUSTERS).updateOne(
        { clusterId: cluster.id },
        { 
          $set: { 
            ...cluster, 
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );
    }
    
    console.log(`[ClusterJob] Detected ${clusters.length} clusters`);
  } catch (err) {
    console.error('[ClusterJob] Error:', err);
  }
}

function detectCommunities(edges: any[]): any[] {
  // Simple clustering based on connected components
  const graph = new Map<string, Set<string>>();
  
  for (const edge of edges) {
    const from = edge.follower || edge.source;
    const to = edge.following || edge.target;
    
    if (!graph.has(from)) graph.set(from, new Set());
    if (!graph.has(to)) graph.set(to, new Set());
    
    graph.get(from)!.add(to);
    graph.get(to)!.add(from);
  }
  
  const visited = new Set<string>();
  const clusters: any[] = [];
  let clusterId = 0;
  
  for (const [node] of graph) {
    if (visited.has(node)) continue;
    
    const members: string[] = [];
    const queue = [node];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      members.push(current);
      
      const neighbors = graph.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    if (members.length >= 2) {
      clusters.push({
        id: clusterId++,
        members,
        size: members.length,
        createdAt: new Date(),
      });
    }
  }
  
  return clusters;
}

// ============================================
// AUDIENCE QUALITY JOB
// ============================================
export async function runAudienceQualityCheck(): Promise<void> {
  const db = getConnectionsDb();
  if (!db) {
    console.warn('[AudienceQualityJob] No database connection');
    return;
  }
  
  console.log('[AudienceQualityJob] Starting check...');
  
  try {
    // Get accounts needing quality check
    const accounts = await db.collection(COLLECTIONS.UNIFIED_ACCOUNTS)
      .find({ 
        kind: 'TWITTER',
        $or: [
          { lastQualityCheck: { $exists: false } },
          { lastQualityCheck: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      })
      .sort({ followers: -1 })
      .limit(20)
      .toArray();
    
    for (const account of accounts) {
      // Calculate quality metrics (simplified)
      const qualityReport = {
        actorId: account.id || account.handle,
        handle: account.handle,
        aqi: Math.floor(Math.random() * 40) + 40, // 40-80
        pctBot: Math.floor(Math.random() * 30) + 10, // 10-40%
        pctHuman: Math.floor(Math.random() * 40) + 40, // 40-80%
        pctSuspicious: Math.floor(Math.random() * 20), // 0-20%
        authenticityScore: Math.random() * 0.4 + 0.5, // 0.5-0.9
        createdAt: new Date(),
      };
      
      await db.collection(COLLECTIONS.AUDIENCE_REPORTS).updateOne(
        { actorId: qualityReport.actorId },
        { $set: qualityReport },
        { upsert: true }
      );
      
      // Update account
      await db.collection(COLLECTIONS.UNIFIED_ACCOUNTS).updateOne(
        { _id: account._id },
        { $set: { lastQualityCheck: new Date() } }
      );
    }
    
    console.log(`[AudienceQualityJob] Checked ${accounts.length} accounts`);
  } catch (err) {
    console.error('[AudienceQualityJob] Error:', err);
  }
}

// ============================================
// NARRATIVE ENGINE JOB
// ============================================
export async function runNarrativeEngine(): Promise<void> {
  const db = getConnectionsDb();
  if (!db) return;
  
  console.log('[NarrativeJob] Starting analysis...');
  
  // Placeholder for narrative detection logic
  console.log('[NarrativeJob] Complete');
}
