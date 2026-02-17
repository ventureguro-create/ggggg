/**
 * BLOCK 23 - Bot Market Signals (BMS)
 * 
 * Turns bot activity into market manipulation signals
 * 
 * BMS = 0.4 * botInflowRate + 0.35 * overlapScore + 0.25 * burstScore
 */

export type BMSLabel = 
  | 'CLEAN' 
  | 'WATCH' 
  | 'MANIPULATED' 
  | 'STRONGLY_MANIPULATED' 
  | 'ARTIFICIAL';

/**
 * Calculate Bot Market Signal score
 */
export function calculateBMS(params: {
  botInflowRate: number;   // 0-1: new_bot_followers_24h / total_new_followers_24h
  overlapScore: number;    // 0-1: shared_bot_followers / total_bot_followers
  burstScore: number;      // 0-1: normalized bot_follows_in_1h / avg_bot_follows_24h
}): number {
  const score =
    0.4 * params.botInflowRate +
    0.35 * params.overlapScore +
    0.25 * params.burstScore;

  return Math.min(100, Math.round(score * 100));
}

/**
 * Get BMS label from score
 * 
 * | BMS    | Label               | Meaning                    |
 * |--------|---------------------|----------------------------|
 * | 0-20   | CLEAN               | Organic                    |
 * | 20-40  | WATCH               | Suspicious                 |
 * | 40-60  | MANIPULATED         | Likely manipulation        |
 * | 60-80  | STRONGLY_MANIPULATED| Active campaign            |
 * | 80-100 | ARTIFICIAL          | Fake growth                |
 */
export function getBMSLabel(bms: number): BMSLabel {
  if (bms < 20) return 'CLEAN';
  if (bms < 40) return 'WATCH';
  if (bms < 60) return 'MANIPULATED';
  if (bms < 80) return 'STRONGLY_MANIPULATED';
  return 'ARTIFICIAL';
}
