/**
 * Reality Gate Service
 * 
 * PHASE E2: Modifies alert decisions based on Reality + Wallet Credibility
 * 
 * FORMULA:
 * reality_score = 0.55 * onchain_verdict_score + 0.45 * wallet_credibility_score
 * 
 * DECISION RULES (HARD):
 * - CONTRADICTS → SUPPRESS or SEND_LOW_PRIORITY + flag REALITY_CONTRADICTED
 * - reality_score < 0.35 → SUPPRESS
 * - 0.35 <= reality_score < 0.55 → SEND_LOW_PRIORITY
 * - > 0.55 → keep_previous (NO усиление!)
 * 
 * ВАЖНО: Reality НИКОГДА не повышает приоритет, только понижает/блокирует
 */

import { Db } from 'mongodb';
import { 
  RealityVerdict, 
  RealityGateDecision, 
  RealityResult, 
  WalletCredibility 
} from '../contracts/reality.types.js';
import { evaluateReality } from './realityEvaluator.service.js';
import { getWalletCredibility, getBadgeScore } from './walletCredibility.service.js';
import { recordLedgerEntry } from '../stores/realityLedger.store.js';

let db: Db;

export function initRealityGate(database: Db) {
  db = database;
  console.log('[RealityGate] Service initialized');
}

const VERDICT_SCORES: Record<RealityVerdict, number> = {
  CONFIRMS: 1.0,
  NO_DATA: 0.5,
  CONTRADICTS: 0.0,
};

export interface RealityGateInput {
  eventId: string;
  actorId: string;
  symbol?: string;
  originalDecision: string; // SEND, SEND_LOW_PRIORITY, SUPPRESS, BLOCK
  confidence?: number;
}

/**
 * Apply Reality Gate to an alert decision
 * 
 * This is the main entry point called from Alert Policy Engine
 */
export async function applyRealityGate(
  input: RealityGateInput
): Promise<RealityGateDecision> {
  const { eventId, actorId, symbol, originalDecision } = input;
  
  // 1. Get Reality evaluation
  const reality = await evaluateReality(actorId, symbol);
  
  // 2. Get Wallet credibility
  const credibility = await getWalletCredibility(actorId);
  
  // 3. Calculate Reality Score
  const verdictScore = VERDICT_SCORES[reality.verdict];
  const credScore = credibility.score_0_1;
  const realityScore = 0.55 * verdictScore + 0.45 * credScore;
  
  // 4. Determine final decision
  const flags: string[] = [];
  let finalDecision = originalDecision;
  let reason = 'Reality gate passed';
  
  // Rule 1: CONTRADICTS always downgrades
  if (reality.verdict === 'CONTRADICTS') {
    flags.push('REALITY_CONTRADICTED');
    if (originalDecision === 'SEND') {
      finalDecision = 'SEND_LOW_PRIORITY';
      reason = 'Downgraded: on-chain contradicts signal';
    } else if (originalDecision !== 'BLOCK' && originalDecision !== 'SUPPRESS') {
      finalDecision = 'SUPPRESS';
      reason = 'Suppressed: on-chain contradicts signal';
    }
  }
  // Rule 2: Low reality score → SUPPRESS
  else if (realityScore < 0.35) {
    finalDecision = 'SUPPRESS';
    reason = `Suppressed: low reality score (${(realityScore * 100).toFixed(0)}%)`;
  }
  // Rule 3: Medium reality score → LOW_PRIORITY
  else if (realityScore < 0.55 && originalDecision === 'SEND') {
    finalDecision = 'SEND_LOW_PRIORITY';
    reason = `Downgraded: medium reality score (${(realityScore * 100).toFixed(0)}%)`;
  }
  // Rule 4: > 0.55 → keep previous (NO boosting!)
  
  // Add wallet flag if LOW
  if (credibility.badge === 'LOW') {
    flags.push('WALLET_LOW_CRED');
  }
  
  // 5. Record to ledger
  await recordLedgerEntry({
    eventId,
    actorId,
    symbol,
    verdict: reality.verdict,
    score_0_1: realityScore,
    walletBadge: credibility.badge,
    window: reality.window || 'T0',
    evidence: [...reality.evidence, ...(credibility.evidence || [])],
    ts: new Date(),
  });
  
  return {
    originalDecision,
    finalDecision,
    realityScore: Math.round(realityScore * 100) / 100,
    verdict: reality.verdict,
    walletBadge: credibility.badge,
    flags,
    reason,
  };
}

/**
 * Get Reality Gate config
 */
export async function getRealityGateConfig(): Promise<any> {
  const config = await db.collection('connections_reality_config').findOne({ _id: 'default' });
  return config ?? {
    enabled: true,
    contradict_action: 'SEND_LOW_PRIORITY',
    low_score_threshold: 0.35,
    medium_score_threshold: 0.55,
    verdict_weight: 0.55,
    credibility_weight: 0.45,
  };
}

/**
 * Update Reality Gate config
 */
export async function updateRealityGateConfig(patch: any): Promise<any> {
  const current = await getRealityGateConfig();
  const updated = { ...current, ...patch, updatedAt: new Date() };
  
  await db.collection('connections_reality_config').updateOne(
    { _id: 'default' },
    { $set: updated },
    { upsert: true }
  );
  
  return updated;
}
