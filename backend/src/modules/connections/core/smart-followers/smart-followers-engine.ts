/**
 * Smart Followers Engine
 * 
 * Core computation: quality of followers, not quantity
 * 
 * Key concept: Not how many followers, but WHO follows you
 * - 10 elite followers > 10,000 low-tier followers
 * - This is the answer to "why unknown account can have high score"
 */

import {
  SmartFollowersInput,
  SmartFollowersResult,
  SmartFollowersBreakdownItem,
  AuthorityTier,
} from './smart-followers-types.js';
import { smartFollowersConfig as cfg, SMART_FOLLOWERS_VERSION } from './smart-followers-config.js';
import { logistic01, minmax01 } from './smart-followers-normalize.js';
import { explainSmartFollowers } from './smart-followers-explain.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function tierMultiplier(t: AuthorityTier): number {
  return cfg.tier_multiplier[t] ?? 1.0;
}

function safeAuth(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return clamp01(x);
}

/**
 * Compute smart followers score and analysis
 */
export function computeSmartFollowers(input: SmartFollowersInput): SmartFollowersResult {
  const followers = Array.isArray(input.followers) ? input.followers : [];
  const followers_count = followers.length;

  // Compute weights for each follower
  let totalWeight = 0;
  const items: Omit<SmartFollowersBreakdownItem, 'share_of_total'>[] = followers.map(f => {
    const a = safeAuth(f.authority_score_0_1);
    const m = tierMultiplier(f.authority_tier);
    const w = a * m;
    totalWeight += w;
    return {
      follower_id: f.follower_id,
      authority_score_0_1: a,
      authority_tier: f.authority_tier,
      tier_multiplier: m,
      weight: w,
      handle: f.handle,
      label: f.label,
    };
  });

  // Handle empty graph
  if (followers_count === 0) {
    const empty: SmartFollowersResult = {
      version: SMART_FOLLOWERS_VERSION,
      account_id: input.account_id,
      followers_count: 0,
      smart_followers_score_0_1: 0,
      follower_value_index: 0,
      top_followers: [],
      breakdown: {
        total_weight: 0,
        elite_weight_share: 0,
        high_weight_share: 0,
        tier_shares: {
          elite: 0, high: 0, upper_mid: 0, mid: 0, low_mid: 0, low: 0,
        },
        tier_counts: {
          elite: 0, high: 0, upper_mid: 0, mid: 0, low_mid: 0, low: 0,
        },
      },
      explain: {
        summary: 'Нет данных о подписчиках для оценки smart-followers.',
        drivers: [],
        concerns: ['Отсутствуют follower данные (mock/twitter).'],
        recommendations: ['Добавить follower-set (mock сейчас, twitter позже).'],
      },
      integration: {
        suggested_quality_mix: { ...cfg.integration.quality_mix },
      },
    };
    return empty;
  }

  // Score normalization
  let smartScore01 = 0;
  if (cfg.normalize.method === 'logistic') {
    smartScore01 = logistic01(totalWeight, cfg.normalize.logistic.k, cfg.normalize.logistic.clamp);
  } else {
    smartScore01 = minmax01(
      totalWeight,
      cfg.normalize.minmax.min_weight,
      cfg.normalize.minmax.max_weight,
      cfg.normalize.minmax.clamp
    );
  }

  // Calculate shares
  const denom = totalWeight || 1;
  const withShares: SmartFollowersBreakdownItem[] = items
    .map(it => ({ ...it, share_of_total: it.weight / denom }))
    .sort((a, b) => b.weight - a.weight);

  const top_followers = withShares.slice(0, cfg.top_n);

  // Tier shares and counts
  const tierShares: Record<AuthorityTier, number> = {
    elite: 0, high: 0, upper_mid: 0, mid: 0, low_mid: 0, low: 0,
  };
  const tierCounts: Record<AuthorityTier, number> = {
    elite: 0, high: 0, upper_mid: 0, mid: 0, low_mid: 0, low: 0,
  };

  for (const it of withShares) {
    tierShares[it.authority_tier] += it.weight / denom;
    tierCounts[it.authority_tier]++;
  }

  const breakdown = {
    total_weight: Number(totalWeight.toFixed(6)),
    elite_weight_share: Number(tierShares.elite.toFixed(6)),
    high_weight_share: Number(tierShares.high.toFixed(6)),
    tier_shares: Object.fromEntries(
      Object.entries(tierShares).map(([k, v]) => [k, Number(v.toFixed(6))])
    ) as Record<AuthorityTier, number>,
    tier_counts: tierCounts,
  };

  // Follower value index: smart_score / log(1 + n)
  const base = cfg.fvi.log_base || Math.E;
  const log = (x: number) => Math.log(x) / Math.log(base);
  const fvi = smartScore01 / (log(1 + followers_count) || 1);

  // Build result
  const resultBase: SmartFollowersResult = {
    version: SMART_FOLLOWERS_VERSION,
    account_id: input.account_id,
    followers_count,
    smart_followers_score_0_1: Number(smartScore01.toFixed(6)),
    follower_value_index: Number(fvi.toFixed(6)),
    top_followers,
    breakdown,
    explain: { summary: '', drivers: [], concerns: [], recommendations: [] },
    integration: { suggested_quality_mix: { ...cfg.integration.quality_mix } },
  };

  // Generate explanations
  resultBase.explain = explainSmartFollowers(resultBase);

  return resultBase;
}

/**
 * Generate mock followers for testing
 */
export function generateMockFollowers(count: number = 20): SmartFollowersInput {
  const tiers: AuthorityTier[] = ['elite', 'high', 'upper_mid', 'mid', 'low_mid', 'low'];
  const tierWeights = [0.05, 0.10, 0.15, 0.30, 0.20, 0.20]; // Distribution
  
  const followers = [];
  
  for (let i = 0; i < count; i++) {
    // Pick tier based on weighted distribution
    let rand = Math.random();
    let tierIdx = 0;
    let cumulative = 0;
    for (let j = 0; j < tierWeights.length; j++) {
      cumulative += tierWeights[j];
      if (rand <= cumulative) {
        tierIdx = j;
        break;
      }
    }
    
    const tier = tiers[tierIdx];
    
    // Generate authority score based on tier
    const tierRanges: Record<AuthorityTier, [number, number]> = {
      elite: [0.85, 1.0],
      high: [0.70, 0.84],
      upper_mid: [0.55, 0.69],
      mid: [0.40, 0.54],
      low_mid: [0.25, 0.39],
      low: [0.10, 0.24],
    };
    
    const [min, max] = tierRanges[tier];
    const authority = min + Math.random() * (max - min);
    
    followers.push({
      follower_id: `follower_${String(i + 1).padStart(3, '0')}`,
      authority_score_0_1: Number(authority.toFixed(4)),
      authority_tier: tier,
      handle: `user_${i + 1}`,
      label: `Follower ${i + 1}`,
    });
  }
  
  return {
    account_id: 'mock_account',
    followers,
  };
}
