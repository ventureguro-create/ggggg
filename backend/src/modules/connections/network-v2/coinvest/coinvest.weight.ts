/**
 * Co-Investment Weight Calculation - PHASE A3
 * 
 * FORMULA:
 * coinvest_weight = 
 *   overlap_projects        // shared_projects_count
 *   × time_decay            // exp(-years_since / 3)
 *   × round_multiplier      // SEED=1.4, A=1.2, B=1.0, LATE=0.8
 *   × anchor_boost          // 1.3 if one backer is anchor
 * 
 * This creates edges between funds who co-invest together.
 * The more they invest together, the stronger the connection.
 */

export type InvestmentRound = 'SEED' | 'A' | 'B' | 'C' | 'LATE' | 'UNKNOWN';

export interface CoInvestWeightConfig {
  baseWeight: number;              // 0.15
  logCoefficient: number;          // 0.3 for ln-based scaling
  timeDecayYears: number;          // 3 years half-life
  roundMultipliers: Record<InvestmentRound, number>;
  anchorBoostMultiplier: number;   // 1.3
  maxWeight: number;               // 1.0
}

export const DEFAULT_COINVEST_CONFIG: CoInvestWeightConfig = {
  baseWeight: 0.15,
  logCoefficient: 0.3,
  timeDecayYears: 3,
  roundMultipliers: {
    SEED: 1.4,    // Early stage = strongest signal
    A: 1.2,
    B: 1.0,
    C: 0.9,
    LATE: 0.8,    // Late stage = weaker signal
    UNKNOWN: 1.0,
  },
  anchorBoostMultiplier: 1.3,
  maxWeight: 1.0,
};

/**
 * Normalize round string to enum
 */
export function normalizeRound(round: string): InvestmentRound {
  const r = (round || '').toUpperCase().trim();
  if (r === 'SEED' || r === 'PRE-SEED') return 'SEED';
  if (r === 'A' || r === 'SERIES A' || r === 'SERIES_A') return 'A';
  if (r === 'B' || r === 'SERIES B' || r === 'SERIES_B') return 'B';
  if (r === 'C' || r === 'SERIES C' || r === 'SERIES_C') return 'C';
  if (r === 'D' || r === 'E' || r === 'F' || r.includes('LATE')) return 'LATE';
  return 'UNKNOWN';
}

/**
 * Calculate round multiplier
 */
export function roundMultiplier(
  round: string,
  config: CoInvestWeightConfig = DEFAULT_COINVEST_CONFIG
): number {
  const normalized = normalizeRound(round);
  return config.roundMultipliers[normalized] ?? 1.0;
}

/**
 * Calculate time decay based on investment date
 * 
 * Half-life: 3 years
 * Recent investments = stronger signal
 */
export function timeDecay(
  investmentDate: Date,
  config: CoInvestWeightConfig = DEFAULT_COINVEST_CONFIG
): number {
  const now = new Date();
  const yearsSince = (now.getTime() - investmentDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  // Exponential decay: e^(-years / halfLife)
  return Math.max(0.1, Math.exp(-yearsSince / config.timeDecayYears));
}

/**
 * Calculate anchor boost
 * 
 * If one of the backers is an "anchor" (top-tier fund like a16z, paradigm),
 * the edge weight is boosted.
 */
export function anchorBoost(
  isAnchorA: boolean,
  isAnchorB: boolean,
  config: CoInvestWeightConfig = DEFAULT_COINVEST_CONFIG
): number {
  // Both anchors = no extra boost (they already have high authority)
  // One anchor = boost to recognize the connection
  // No anchor = neutral
  if (isAnchorA && isAnchorB) return 1.0;
  if (isAnchorA || isAnchorB) return config.anchorBoostMultiplier;
  return 1.0;
}

export interface CoInvestWeightInput {
  sharedProjectsCount: number;      // how many projects they co-invested
  avgInvestmentDate?: Date;         // average date of co-investments
  dominantRound?: string;           // most common round type
  isAnchorA: boolean;               // is backer A an anchor?
  isAnchorB: boolean;               // is backer B an anchor?
}

export interface CoInvestWeight {
  baseWeight: number;
  overlapScore: number;      // log-scaled shared projects
  timeDecay: number;         // recency factor
  roundMultiplier: number;   // round type factor
  anchorBoost: number;       // anchor presence factor
  finalWeight: number;       // combined weight
}

/**
 * Calculate co-investment edge weight
 */
export function computeCoInvestWeight(
  input: CoInvestWeightInput,
  config: CoInvestWeightConfig = DEFAULT_COINVEST_CONFIG
): CoInvestWeight {
  // 1. Base overlap score (log-scaled)
  const overlapScore = config.baseWeight + 
    config.logCoefficient * Math.log(input.sharedProjectsCount + 1);
  
  // 2. Time decay (if we have dates)
  const decay = input.avgInvestmentDate 
    ? timeDecay(input.avgInvestmentDate, config)
    : 1.0;
  
  // 3. Round multiplier
  const roundMult = input.dominantRound 
    ? roundMultiplier(input.dominantRound, config)
    : 1.0;
  
  // 4. Anchor boost
  const anchor = anchorBoost(input.isAnchorA, input.isAnchorB, config);
  
  // 5. Final weight (capped at 1.0)
  const finalWeight = Math.min(
    config.maxWeight,
    overlapScore * decay * roundMult * anchor
  );
  
  return {
    baseWeight: config.baseWeight,
    overlapScore: Math.round(overlapScore * 1000) / 1000,
    timeDecay: Math.round(decay * 1000) / 1000,
    roundMultiplier: roundMult,
    anchorBoost: anchor,
    finalWeight: Math.round(finalWeight * 1000) / 1000,
  };
}

/**
 * Aggregate co-investment score for a backer
 * 
 * Returns 0-1 score based on quality of their co-investment network
 */
export function aggregateCoInvestScore(
  weights: CoInvestWeight[]
): number {
  if (weights.length === 0) return 0;
  
  // Sum of weights with diminishing returns
  let total = 0;
  const sorted = [...weights].sort((a, b) => b.finalWeight - a.finalWeight);
  
  for (let i = 0; i < sorted.length; i++) {
    // Diminishing returns: each additional edge contributes less
    const diminishing = 1 / (1 + i * 0.2);
    total += sorted[i].finalWeight * diminishing;
  }
  
  // Normalize to 0-1 scale
  return Math.min(1, total);
}
