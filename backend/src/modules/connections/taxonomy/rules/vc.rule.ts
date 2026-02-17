/**
 * VC Group Rule
 * 
 * FORMULA:
 * vc_weight =
 *   0.50 * seed_authority +
 *   0.30 * coinvest_centrality +
 *   0.20 * wallet_credibility
 * 
 * VC doesn't require Twitter activity - relies on:
 * - Backers Registry seed
 * - Co-investment graph
 * - Wallet attribution
 */

import { clamp01, safeNum } from '../taxonomy.constants.js';

export interface VcRuleInput {
  seed_authority_0_1?: number;
  coinvest_centrality_0_1?: number;
  wallet_credibility_0_1?: number;
  is_backer?: boolean;
  kind?: string;
}

export function computeVcWeight(m: VcRuleInput) {
  const seed = safeNum(m.seed_authority_0_1);
  const coinvest = safeNum(m.coinvest_centrality_0_1);
  const walletCred = safeNum(m.wallet_credibility_0_1);
  
  // Boost if explicitly marked as backer
  const backerBoost = (m.is_backer || m.kind === 'BACKER') ? 0.3 : 0;

  const w = 0.50 * seed + 0.30 * coinvest + 0.20 * walletCred + backerBoost;

  const reasons: string[] = [];
  if (seed >= 0.6) reasons.push('High seed authority');
  if (coinvest >= 0.5) reasons.push('Strong co-investment centrality');
  if (walletCred >= 0.5) reasons.push('Credible wallets linked');
  if (backerBoost > 0) reasons.push('Registered backer');

  return { 
    weight: clamp01(w), 
    reasons, 
    evidence: { seed, coinvest, walletCred, backerBoost } 
  };
}
