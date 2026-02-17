/**
 * Truth Graph Builder Service
 * 
 * PHASE H1: Builds the causality graph from IPS events
 */

import { Db } from 'mongodb';
import {
  TruthNode, TruthEdge, TruthGraphResult, TruthGraphQuery,
  ActorNode, EventNode, AssetNode, OutcomeNode,
  ActorCorrelation, AssetInfluencePath
} from '../models/truth-graph.types';
import { calculateTruthWeight, calculateActorCorrelation, calculateTimeAlignment } from './truth-weight.service';

const WINDOW_MS = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000
};

export class TruthGraphBuilder {
  constructor(private db: Db) {}
  
  /**
   * Build the truth graph based on query
   */
  async buildGraph(query: TruthGraphQuery): Promise<TruthGraphResult> {
    const nodes: Map<string, TruthNode> = new Map();
    const edges: TruthEdge[] = [];
    
    // 1. Get IPS events matching query
    const events = await this.getIPSEvents(query);
    
    // 2. Build actor nodes
    const actorStats = await this.getActorStats(query.actorIds);
    for (const [actorId, stats] of actorStats) {
      const node: ActorNode = {
        id: `actor:${actorId}`,
        type: 'ACTOR',
        label: actorId,
        handle: actorId,
        avgIPS: stats.avgIPS,
        totalEvents: stats.totalEvents,
        verdict: stats.verdict,
        influence: Math.min(1, stats.avgIPS * 1.2)
      };
      nodes.set(node.id, node);
    }
    
    // 3. Build asset nodes
    const assetStats = await this.getAssetStats(query.assets);
    for (const [symbol, stats] of assetStats) {
      const node: AssetNode = {
        id: `asset:${symbol}`,
        type: 'ASSET',
        label: symbol,
        symbol,
        totalEvents: stats.totalEvents,
        avgOutcomeStrength: stats.avgOutcomeStrength
      };
      nodes.set(node.id, node);
    }
    
    // 4. Build event and outcome nodes, and edges
    let edgeId = 0;
    for (const event of events) {
      // Event node
      const eventNode: EventNode = {
        id: `event:${event.eventId}`,
        type: 'EVENT',
        label: `${event.actorId}:${event.asset}`,
        actorId: event.actorId,
        asset: event.asset,
        timestamp: event.timestamp,
        ips: event.ips,
        outcome: event.outcome,
        window: event.window
      };
      nodes.set(eventNode.id, eventNode);
      
      // Outcome node
      const outcomeNode: OutcomeNode = {
        id: `outcome:${event.eventId}:${event.window}`,
        type: 'OUTCOME',
        label: event.outcome,
        verdict: this.mapOutcomeVerdict(event.outcome),
        priceDelta: event.snapshot?.priceDelta || 0,
        timestamp: event.timestamp + WINDOW_MS[event.window],
        window: event.window
      };
      nodes.set(outcomeNode.id, outcomeNode);
      
      // Edge: Actor → Event (PUBLISHED)
      const actorId = `actor:${event.actorId}`;
      if (nodes.has(actorId)) {
        edges.push({
          id: `edge:${edgeId++}`,
          source: actorId,
          target: eventNode.id,
          type: 'PUBLISHED',
          weight: event.ips,
          metadata: { ips: event.ips }
        });
      }
      
      // Edge: Event → Asset (AFFECTS)
      const assetId = `asset:${event.asset}`;
      if (nodes.has(assetId)) {
        const weight = calculateTruthWeight(
          event.ips,
          WINDOW_MS[event.window] / 2,
          Math.abs(event.snapshot?.priceDelta || 0),
          WINDOW_MS[event.window]
        );
        edges.push({
          id: `edge:${edgeId++}`,
          source: eventNode.id,
          target: assetId,
          type: 'AFFECTS',
          weight: weight.normalized,
          metadata: weight.factors
        });
      }
      
      // Edge: Event → Outcome (CONFIRMED_BY)
      const weight = calculateTruthWeight(
        event.ips,
        0, // Direct confirmation
        Math.abs(event.snapshot?.priceDelta || 0),
        WINDOW_MS[event.window]
      );
      edges.push({
        id: `edge:${edgeId++}`,
        source: eventNode.id,
        target: outcomeNode.id,
        type: 'CONFIRMED_BY',
        weight: weight.normalized,
        metadata: {
          ...weight.factors,
          outcomeStrength: Math.abs(event.snapshot?.priceDelta || 0)
        }
      });
    }
    
    // 5. Build actor correlations if requested
    if (query.includeCorrelations) {
      const correlations = await this.calculateActorCorrelations(events);
      for (const corr of correlations) {
        if (corr.strength >= 0.3) { // Only significant correlations
          edges.push({
            id: `edge:${edgeId++}`,
            source: `actor:${corr.actor1}`,
            target: `actor:${corr.actor2}`,
            type: corr.correlationType,
            weight: corr.strength,
            metadata: {
              correlation: corr.strength
            }
          });
        }
      }
    }
    
    // Apply limits
    const nodeArray = Array.from(nodes.values()).slice(0, query.maxNodes || 500);
    const edgeArray = edges.slice(0, query.maxEdges || 1000);
    
    // Calculate stats
    const avgTruthWeight = edgeArray.length > 0
      ? edgeArray.reduce((sum, e) => sum + e.weight, 0) / edgeArray.length
      : 0;
    
    return {
      nodes: nodeArray,
      edges: edgeArray,
      stats: {
        totalNodes: nodeArray.length,
        totalEdges: edgeArray.length,
        avgTruthWeight: Math.round(avgTruthWeight * 1000) / 1000
      }
    };
  }
  
  /**
   * Get IPS events matching query
   */
  private async getIPSEvents(query: TruthGraphQuery): Promise<any[]> {
    const col = this.db.collection('ips_events');
    const match: any = {};
    
    if (query.actorIds?.length) match.actorId = { $in: query.actorIds };
    if (query.assets?.length) match.asset = { $in: query.assets.map(a => a.toUpperCase()) };
    if (query.window) match.window = query.window;
    if (query.minIPS) match.ips = { $gte: query.minIPS };
    if (query.verdict?.length) match.verdict = { $in: query.verdict };
    if (query.from || query.to) {
      match.timestamp = {};
      if (query.from) match.timestamp.$gte = query.from;
      if (query.to) match.timestamp.$lte = query.to;
    }
    
    return col
      .find(match)
      .sort({ timestamp: -1 })
      .limit(query.maxNodes || 200)
      .toArray();
  }
  
  /**
   * Get actor stats
   */
  private async getActorStats(actorIds?: string[]): Promise<Map<string, any>> {
    const col = this.db.collection('ips_events');
    const match: any = {};
    if (actorIds?.length) match.actorId = { $in: actorIds };
    
    const stats = await col.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$actorId',
          avgIPS: { $avg: '$ips' },
          totalEvents: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const result = new Map();
    for (const s of stats) {
      result.set(s._id, {
        avgIPS: Math.round(s.avgIPS * 1000) / 1000,
        totalEvents: s.totalEvents,
        verdict: s.avgIPS >= 0.65 ? 'INFORMED' : s.avgIPS < 0.35 ? 'NOISE' : 'MIXED'
      });
    }
    return result;
  }
  
  /**
   * Get asset stats
   */
  private async getAssetStats(assets?: string[]): Promise<Map<string, any>> {
    const col = this.db.collection('ips_events');
    const match: any = {};
    if (assets?.length) match.asset = { $in: assets.map(a => a.toUpperCase()) };
    
    const stats = await col.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$asset',
          totalEvents: { $sum: 1 },
          avgOutcomeStrength: { $avg: { $abs: '$snapshot.priceDelta' } }
        }
      }
    ]).toArray();
    
    const result = new Map();
    for (const s of stats) {
      result.set(s._id, {
        totalEvents: s.totalEvents,
        avgOutcomeStrength: Math.round((s.avgOutcomeStrength || 0) * 100) / 100
      });
    }
    return result;
  }
  
  /**
   * Calculate correlations between actors
   */
  private async calculateActorCorrelations(events: any[]): Promise<ActorCorrelation[]> {
    // Group events by actor
    const actorEvents = new Map<string, any[]>();
    for (const e of events) {
      const list = actorEvents.get(e.actorId) || [];
      list.push(e);
      actorEvents.set(e.actorId, list);
    }
    
    const correlations: ActorCorrelation[] = [];
    const actors = Array.from(actorEvents.keys());
    
    // Compare each pair
    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const actor1 = actors[i];
        const actor2 = actors[j];
        const events1 = actorEvents.get(actor1) || [];
        const events2 = actorEvents.get(actor2) || [];
        
        // Find shared assets
        const assets1 = new Set(events1.map(e => e.asset));
        const assets2 = new Set(events2.map(e => e.asset));
        const sharedAssets = [...assets1].filter(a => assets2.has(a));
        
        if (sharedAssets.length === 0) continue;
        
        // Calculate time alignment
        const timestamps1 = events1.map(e => e.timestamp);
        const timestamps2 = events2.map(e => e.timestamp);
        const timeAlignment = calculateTimeAlignment(timestamps1, timestamps2);
        
        // Calculate IPS alignment
        const avgIPS1 = events1.reduce((s, e) => s + e.ips, 0) / events1.length;
        const avgIPS2 = events2.reduce((s, e) => s + e.ips, 0) / events2.length;
        const ipsAlignment = 1 - Math.abs(avgIPS1 - avgIPS2);
        
        const strength = calculateActorCorrelation(
          sharedAssets.length,
          assets1.size,
          assets2.size,
          timeAlignment,
          ipsAlignment
        );
        
        // Determine correlation type
        let correlationType: ActorCorrelation['correlationType'] = 'CORRELATED_WITH';
        if (timeAlignment > 0.6) {
          // Check if one precedes the other
          const avgTime1 = timestamps1.reduce((s, t) => s + t, 0) / timestamps1.length;
          const avgTime2 = timestamps2.reduce((s, t) => s + t, 0) / timestamps2.length;
          if (avgTime1 < avgTime2 - 60 * 60 * 1000) {
            correlationType = 'PRECEDES';
          } else if (avgIPS1 > avgIPS2 + 0.1) {
            correlationType = 'AMPLIFIES';
          }
        }
        
        correlations.push({
          actor1,
          actor2,
          correlationType,
          strength,
          sharedAssets,
          eventOverlap: sharedAssets.length / Math.max(assets1.size, assets2.size),
          timeAlignment
        });
      }
    }
    
    return correlations.sort((a, b) => b.strength - a.strength);
  }
  
  /**
   * Map outcome string to verdict
   */
  private mapOutcomeVerdict(outcome: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'VOLATILE' {
    switch (outcome) {
      case 'POSITIVE_MOVE': return 'POSITIVE';
      case 'NEGATIVE_MOVE': return 'NEGATIVE';
      case 'VOLATILITY_SPIKE': return 'VOLATILE';
      default: return 'NEUTRAL';
    }
  }
  
  /**
   * Get influence paths for an asset
   */
  async getAssetInfluencePath(asset: string): Promise<AssetInfluencePath> {
    const col = this.db.collection('ips_events');
    const assetUpper = asset.toUpperCase();
    
    const actorStats = await col.aggregate([
      { $match: { asset: assetUpper } },
      {
        $group: {
          _id: '$actorId',
          avgIPS: { $avg: '$ips' },
          eventCount: { $sum: 1 },
          confirmed: {
            $sum: {
              $cond: [{ $in: ['$outcome', ['POSITIVE_MOVE', 'NEGATIVE_MOVE', 'VOLATILITY_SPIKE']] }, 1, 0]
            }
          }
        }
      },
      { $sort: { avgIPS: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    const totalEvents = await col.countDocuments({ asset: assetUpper });
    const confirmedEvents = await col.countDocuments({
      asset: assetUpper,
      outcome: { $in: ['POSITIVE_MOVE', 'NEGATIVE_MOVE', 'VOLATILITY_SPIKE'] }
    });
    
    return {
      asset: assetUpper,
      topActors: actorStats.map(s => ({
        actorId: s._id,
        avgIPS: Math.round(s.avgIPS * 1000) / 1000,
        eventCount: s.eventCount,
        confirmationRate: s.eventCount > 0 ? Math.round((s.confirmed / s.eventCount) * 100) / 100 : 0
      })),
      avgTimeToOutcome: 4 * 60 * 60 * 1000, // Simplified - would need real calculation
      totalConfirmedEvents: confirmedEvents
    };
  }
}
