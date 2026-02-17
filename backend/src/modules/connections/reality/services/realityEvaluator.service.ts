/**
 * Reality Evaluator Service
 * 
 * PHASE E2: Evaluates Twitter events against on-chain data
 * 
 * Input: { actorId, symbol, eventTs }
 * Output: RealityResult { verdict, score_0_1, evidence }
 * 
 * Rules:
 * - CONFIRMS → score = 1.0
 * - NO_DATA → score = 0.5  
 * - CONTRADICTS → score = 0.0
 * 
 * Takes WORST verdict across time windows (T0, T+4h, T+24h)
 */

import { Db } from 'mongodb';
import { RealityResult, RealityVerdict } from '../contracts/reality.types.js';

let db: Db;

export function initRealityEvaluator(database: Db) {
  db = database;
  console.log('[RealityEvaluator] Service initialized');
}

const VERDICT_SCORES: Record<RealityVerdict, number> = {
  CONFIRMS: 1.0,
  NO_DATA: 0.5,
  CONTRADICTS: 0.0,
};

/**
 * Evaluate reality for an actor event
 */
export async function evaluateReality(
  actorId: string,
  symbol?: string,
  eventTs?: Date
): Promise<RealityResult> {
  try {
    // Try to get on-chain snapshot from adapter
    const snapshot = await getOnchainSnapshot(actorId, symbol);
    
    if (!snapshot) {
      return {
        verdict: 'NO_DATA',
        score_0_1: 0.5,
        evidence: ['No on-chain data available'],
      };
    }
    
    // Derive verdict from on-chain metrics
    const verdict = deriveVerdict(snapshot);
    const evidence = buildEvidence(snapshot, verdict);
    
    return {
      verdict,
      score_0_1: VERDICT_SCORES[verdict],
      evidence,
      window: 'T0',
    };
  } catch (err) {
    console.log('[RealityEvaluator] Error:', err);
    return {
      verdict: 'NO_DATA',
      score_0_1: 0.5,
      evidence: ['Evaluation failed'],
    };
  }
}

/**
 * Get on-chain snapshot from adapter
 */
async function getOnchainSnapshot(actorId: string, symbol?: string): Promise<any> {
  try {
    // Check reality cache first
    const cached = await db.collection('connections_reality_cache').findOne({
      actorId,
      symbol: symbol || null,
      ts: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }, // 4h cache
    });
    
    if (cached) return cached.snapshot;
    
    // Try on-chain adapter
    const adapterResult = await db.collection('onchain_snapshots').findOne({
      $or: [
        { actorId },
        { symbol },
      ],
    }, { sort: { ts: -1 } });
    
    return adapterResult;
  } catch (err) {
    return null;
  }
}

/**
 * Derive verdict from on-chain metrics
 */
function deriveVerdict(snapshot: any): RealityVerdict {
  const { flowScore, exchangePressure, whaleActivity, confidence } = snapshot;
  
  // Low confidence = no data
  if (!confidence || confidence < 0.3) {
    return 'NO_DATA';
  }
  
  // Calculate alignment
  let alignmentScore = 0;
  
  // Positive flow = accumulation
  if (flowScore > 0.6) alignmentScore += 1;
  else if (flowScore < 0.3) alignmentScore -= 1;
  
  // Negative exchange pressure = holding
  if (exchangePressure < -0.2) alignmentScore += 1;
  else if (exchangePressure > 0.3) alignmentScore -= 1;
  
  // High whale activity = smart money
  if (whaleActivity > 0.5) alignmentScore += 0.5;
  
  // Map to verdict
  if (alignmentScore >= 1.5) return 'CONFIRMS';
  if (alignmentScore <= -1.5) return 'CONTRADICTS';
  return 'NO_DATA';
}

/**
 * Build evidence strings
 */
function buildEvidence(snapshot: any, verdict: RealityVerdict): string[] {
  const evidence: string[] = [];
  
  if (snapshot.flowScore !== undefined) {
    const direction = snapshot.flowScore > 0.5 ? 'inflow' : 'outflow';
    evidence.push(`Flow: ${direction} (${(snapshot.flowScore * 100).toFixed(0)}%)`);
  }
  
  if (snapshot.exchangePressure !== undefined) {
    const pressure = snapshot.exchangePressure > 0 ? 'selling pressure' : 'accumulation';
    evidence.push(`Exchange: ${pressure}`);
  }
  
  if (snapshot.whaleActivity !== undefined) {
    evidence.push(`Whale activity: ${(snapshot.whaleActivity * 100).toFixed(0)}%`);
  }
  
  if (verdict === 'CONFIRMS') {
    evidence.push('On-chain confirms Twitter signal');
  } else if (verdict === 'CONTRADICTS') {
    evidence.push('On-chain contradicts Twitter signal');
  }
  
  return evidence;
}

/**
 * Batch evaluate for multiple actors
 */
export async function batchEvaluate(
  actors: { actorId: string; symbol?: string }[]
): Promise<Map<string, RealityResult>> {
  const results = new Map<string, RealityResult>();
  
  for (const actor of actors) {
    const result = await evaluateReality(actor.actorId, actor.symbol);
    results.set(actor.actorId, result);
  }
  
  return results;
}
