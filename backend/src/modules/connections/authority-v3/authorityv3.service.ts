/**
 * Authority v3 Service
 * 
 * PHASE A1 UPDATE: Added follow_score component
 * PHASE A2 UPDATE: Added AQE (Audience Quality) penalty
 * 
 * Formula: Authority = clamp(
 *   0.35*seed + 
 *   0.35*network + 
 *   0.15*engagement + 
 *   0.15*follow
 * ) * TrustPenalty * AQEPenalty
 */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export interface AuthorityV3Input {
  seed: number;        // 0..1 from Backers Registry
  network: number;     // 0..1 network authority (PageRank-like)
  engagement: number;  // 0..1 engagement score (likes, retweets)
  follow: number;      // 0..1 follow score (who follows them)
  botRisk: number;     // 0..1 bot/spam risk
  confidence: number;  // 0..1 data confidence
  
  // NEW: AQE fields
  aqe_realAudiencePct?: number;   // 0..1 real audience percentage
  aqe_botPressurePct?: number;    // 0..1 bot pressure percentage
  aqe_confidence?: number;         // 0..1 AQE confidence
}

export interface AuthorityV3Result {
  score: number;
  components: {
    base: number;
    trustPenalty: number;
    aqePenalty: number;
  };
  weights: {
    seed: number;
    network: number;
    engagement: number;
    follow: number;
  };
  aqeImpact?: {
    applied: boolean;
    reason?: string;
  };
}

/**
 * Calculate AQE Penalty
 * 
 * Rules:
 * - High real audience (>75%): no penalty (1.0)
 * - Mixed audience (55-75%): slight penalty (0.9)
 * - Low real audience (<55%): significant penalty (0.7-0.8)
 * - Very low (<40%): heavy penalty (0.5-0.6)
 * 
 * Penalty is weighted by AQE confidence
 */
function calculateAqePenalty(input: AuthorityV3Input): { penalty: number; reason?: string } {
  const realPct = input.aqe_realAudiencePct;
  const botPct = input.aqe_botPressurePct;
  const aqeConf = input.aqe_confidence ?? 0.5;

  // No AQE data - minimal penalty for uncertainty
  if (realPct == null || realPct === undefined) {
    return { penalty: 0.95, reason: 'NO_AQE_DATA' };
  }

  let basePenalty = 1.0;
  let reason = 'AQE_OK';

  if (realPct >= 0.75) {
    basePenalty = 1.0;
    reason = 'HIGH_QUALITY_AUDIENCE';
  } else if (realPct >= 0.55) {
    basePenalty = 0.90;
    reason = 'MIXED_AUDIENCE';
  } else if (realPct >= 0.40) {
    basePenalty = 0.75;
    reason = 'LOW_QUALITY_AUDIENCE';
  } else {
    basePenalty = 0.55;
    reason = 'VERY_LOW_QUALITY_AUDIENCE';
  }

  // Additional penalty for high bot pressure
  if (botPct != null && botPct > 0.40) {
    basePenalty *= 0.85;
    reason += '+HIGH_BOT_PRESSURE';
  }

  // Weight penalty by AQE confidence (low confidence = softer penalty)
  // penalty = basePenalty weighted towards 1.0 by (1 - confidence)
  const weightedPenalty = basePenalty * aqeConf + 1.0 * (1 - aqeConf);

  return { penalty: clamp01(weightedPenalty), reason };
}

/**
 * Authority v3 with Follow Score and AQE Penalty
 * 
 * FOLLOW ≠ engagement
 * FOLLOW = подтверждение признания (proof of recognition)
 * AQE = качество аудитории (audience quality)
 */
export function authorityV3(input: AuthorityV3Input): AuthorityV3Result {
  const base = clamp01(
    0.35 * clamp01(input.seed) +
    0.35 * clamp01(input.network) +
    0.15 * clamp01(input.engagement) +
    0.15 * clamp01(input.follow)
  );

  // TrustPenalty = (1 - bot_risk*0.6) * (0.85 + 0.15*confidence)
  const trustPenalty =
    (1 - clamp01(input.botRisk) * 0.6) *
    (0.85 + 0.15 * clamp01(input.confidence));

  // AQE Penalty (NEW)
  const { penalty: aqePenalty, reason: aqeReason } = calculateAqePenalty(input);

  const score = clamp01(base * trustPenalty * aqePenalty);

  return {
    score,
    components: { 
      base, 
      trustPenalty,
      aqePenalty,
    },
    weights: { seed: 0.35, network: 0.35, engagement: 0.15, follow: 0.15 },
    aqeImpact: {
      applied: aqePenalty < 1.0,
      reason: aqeReason,
    },
  };
}

/**
 * Legacy function for backward compatibility
 */
export interface AuthorityV3LegacyInput {
  seed: number;
  network: number;
  media: number;
  onchain: number;
  botRisk: number;
  confidence: number;
}

export function authorityV3Legacy(input: AuthorityV3LegacyInput): AuthorityV3Result {
  return authorityV3({
    seed: input.seed,
    network: input.network,
    engagement: input.media,  // map media to engagement
    follow: input.onchain,    // map onchain to follow (temp)
    botRisk: input.botRisk,
    confidence: input.confidence,
  });
}

/**
 * Batch compute Authority v3 for multiple accounts
 * Now includes AQE data from cache
 */
export async function computeAuthorityV3Batch(
  db: any,
  accountIds: string[],
  followScores?: Map<string, number>,
  aqeData?: Map<string, { realPct: number; botPct: number; confidence: number }>
): Promise<Map<string, AuthorityV3Result>> {
  const results = new Map<string, AuthorityV3Result>();

  // Get accounts from unified collection
  const accounts = await db.collection('connections_unified_accounts')
    .find({ id: { $in: accountIds } })
    .toArray();

  for (const acc of accounts) {
    const aqe = aqeData?.get(acc.id);
    
    const input: AuthorityV3Input = {
      seed: acc.authority ?? acc.seedAuthority ?? 0,
      network: acc.networkScore ?? acc.influence ?? 0,
      engagement: acc.engagementScore ?? acc.mediaScore ?? 0,
      follow: followScores?.get(acc.id) ?? acc.followScore ?? 0,
      botRisk: acc.botRisk ?? 0,
      confidence: acc.confidence ?? 0.7,
      
      // AQE data
      aqe_realAudiencePct: aqe?.realPct,
      aqe_botPressurePct: aqe?.botPct,
      aqe_confidence: aqe?.confidence,
    };

    results.set(acc.id, authorityV3(input));
  }

  return results;
}

/**
 * Helper to get AQE data for batch processing
 */
export async function getAqeDataBatch(
  db: any,
  actorIds: string[]
): Promise<Map<string, { realPct: number; botPct: number; confidence: number }>> {
  const results = new Map();

  const docs = await db.collection('connections_aqe_cache')
    .find({ _id: { $in: actorIds } })
    .toArray();

  for (const doc of docs) {
    results.set(doc._id, {
      realPct: doc.real_audience_pct,
      botPct: doc.bot_pressure_pct,
      confidence: doc.confidence,
    });
  }

  return results;
}
