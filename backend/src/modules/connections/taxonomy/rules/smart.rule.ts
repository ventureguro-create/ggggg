/**
 * SMART Group Rule
 * 
 * FORMULA:
 * smart_weight = 
 *   0.40 * smart_followers_score +
 *   0.25 * authority_score +
 *   0.20 * reality_confirm_rate +
 *   0.15 * actor_trust
 */

import { clamp01, safeNum } from '../taxonomy.constants.js';

export interface SmartRuleInput {
  smart_followers_score_0_1?: number;
  authority_score_0_1?: number;
  reality_confirm_rate_0_1?: number;
  actor_trust_0_1?: number;
}

export function computeSmartWeight(m: SmartRuleInput) {
  const smartFollowers = safeNum(m.smart_followers_score_0_1);
  const authority = safeNum(m.authority_score_0_1);
  const reality = safeNum(m.reality_confirm_rate_0_1);
  const trust = safeNum(m.actor_trust_0_1);

  const w =
    0.40 * smartFollowers +
    0.25 * authority +
    0.20 * reality +
    0.15 * trust;

  const reasons: string[] = [];
  if (smartFollowers >= 0.6) reasons.push('High smart followers');
  if (authority >= 0.5) reasons.push('High authority');
  if (reality >= 0.5) reasons.push('On-chain confirms often');
  if (trust >= 0.5) reasons.push('High trust');

  return { 
    weight: clamp01(w), 
    reasons, 
    evidence: { smartFollowers, authority, reality, trust } 
  };
}
