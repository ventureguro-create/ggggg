/**
 * INFLUENCE Group Rule
 * 
 * FORMULA:
 * influence_weight =
 *   0.35 * influence_score +
 *   0.30 * network_embedding +
 *   0.20 * authority_score +
 *   0.15 * engagement_quality
 */

import { clamp01, safeNum } from '../taxonomy.constants.js';

export interface InfluenceRuleInput {
  twitter_score_influence_0_1?: number;
  influence_score_0_1?: number;
  network_embedding_0_1?: number;
  authority_score_0_1?: number;
  engagement_quality_0_1?: number;
}

export function computeInfluenceWeight(m: InfluenceRuleInput) {
  const influence = safeNum(m.twitter_score_influence_0_1 ?? m.influence_score_0_1);
  const network = safeNum(m.network_embedding_0_1);
  const authority = safeNum(m.authority_score_0_1);
  const engQ = safeNum(m.engagement_quality_0_1);

  const w =
    0.35 * influence +
    0.30 * network +
    0.20 * authority +
    0.15 * engQ;

  const reasons: string[] = [];
  if (influence >= 0.6) reasons.push('High reach/influence');
  if (network >= 0.5) reasons.push('Strong network embedding');
  if (authority >= 0.5) reasons.push('High authority');
  if (engQ >= 0.5) reasons.push('Good engagement quality');

  return { 
    weight: clamp01(w), 
    reasons, 
    evidence: { influence, network, authority, engQ } 
  };
}
