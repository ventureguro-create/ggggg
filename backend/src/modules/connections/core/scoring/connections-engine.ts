// /app/backend/src/modules/connections/core/scoring/connections-engine.ts
// Connections Scoring Engine v0.3 (with Time Decay + Scoring Profiles)
// Input: abstract window aggregates (followers + posts)
// Output: scores + metrics + red flags for UI

import { decayWeight, getDecayInfo } from './connections-decay.js';
import { weightedMean, weightedStd, weightedMedian, weightedSum } from './weighted-stats.js';
import { resolveScoringProfile, getProfileThresholds } from './profile-resolver.js';
import { ScoringProfiles, type ScoringProfile } from './connections-profiles.js';

export type ConnectionsPost = {
  views: number
  likes: number
  reposts: number
  replies: number
  created_at: string
}

export type ConnectionsInput = {
  author_id: string
  window_days: number // 7 | 14 | 30 | 90
  followers_now: number
  followers_then?: number // optional (for growth)
  posts: ConnectionsPost[]
}

export type ConnectionsRedFlag = {
  type:
    | 'RATIO_LIKE_HEAVY'
    | 'RATIO_REPOST_FARM'
    | 'VIRAL_SPIKE_DEPENDENCE'
    | 'GROWTH_SPIKE_LOW_REACH'
    | 'LOW_STABILITY'
    | 'LOW_ACTIVITY'
  severity: 1 | 2 | 3
  reason: string
}

export type ConnectionsScoreResult = {
  influence_score: number // 0..1000
  x_score: number // 0..1000
  risk_level: 'low' | 'medium' | 'high'
  signal_noise: number // 0..10 (1 decimal)
  profile: ScoringProfile // 'retail' | 'influencer' | 'whale'

  metrics: {
    real_views: number
    engagement_quality: number // 0..1
    posting_consistency: number // 0..1
    engagement_stability: number // 0..1
    volatility: number // cv (>=0)
    reach_efficiency: number // 0..1 (normalized)
    follower_growth?: number // -1..+inf
  }

  red_flags: ConnectionsRedFlag[]
  explain: {
    inputs_used: {
      posts_count: number
      window_days: number
      followers_now: number
      followers_then?: number
    }
    profile: {
      type: ScoringProfile
      name: string
      description: string
      thresholds: { min: number; max: number }
    }
    components: {
      rve_score: number
      re_score: number
      eq_score: number
      pc_score: number
      es_score: number
      authority_stub: number
      penalty_x: number
      penalty_influence: number
    }
    weights: {
      influence: { rve: number; re: number; eq: number; authority: number }
      x: { pc: number; es: number; eq: number }
    }
    decay: {
      enabled: boolean
      half_life_days: number
      description: string
    }
  }
}

// ------------------------ helpers ------------------------

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x))
}

function safeNum(x: any) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function mean(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function std(arr: number[]) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const v = mean(arr.map(x => (x - m) ** 2))
  return Math.sqrt(v)
}

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function trimmedMean(arr: number[], trim = 0.1) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const k = Math.floor(s.length * trim)
  const sliced = s.slice(k, s.length - k)
  return mean(sliced.length ? sliced : s)
}

function round1(x: number) {
  return Math.round(x * 10) / 10
}

// ------------------------ engine ------------------------

export function computeConnectionsScore(input: ConnectionsInput): ConnectionsScoreResult {
  const authorId = String(input.author_id || '')
  const windowDays = Math.max(1, Math.floor(safeNum(input.window_days || 30)))
  const followersNow = Math.max(0, safeNum(input.followers_now))

  const posts = Array.isArray(input.posts) ? input.posts : []
  const nPosts = posts.length

  // Get decay info for explain
  const decayInfo = getDecayInfo(windowDays)
  const now = Date.now()

  // --- 0) Calculate time decay weights for each post
  const decayWeights = posts.map(p => 
    decayWeight(p.created_at || new Date().toISOString(), now, windowDays)
  )

  // --- 1) Views list with proxy fallback (if views=0 or missing)
  const proxyFromReactions = (likes: number, reposts: number, replies: number) =>
    likes * 40 + reposts * 80 + replies * 120

  const viewsList: number[] = posts.map(p => {
    const likes = Math.max(0, safeNum(p.likes))
    const reposts = Math.max(0, safeNum(p.reposts))
    const replies = Math.max(0, safeNum(p.replies))
    const views = Math.max(0, safeNum(p.views))
    const proxy = proxyFromReactions(likes, reposts, replies)
    return Math.max(views, proxy, 0)
  })

  // Weighted views (recent posts matter more)
  const weightedViewsMean = weightedMean(viewsList, decayWeights)
  const weightedViewsMedian = weightedMedian(viewsList, decayWeights)
  const medianViews = median(viewsList) // for spike detection
  const realViews = Math.max(weightedViewsMean, weightedViewsMedian, 1)

  // --- 2) Engagement lists (weighted)
  const engPerPost: number[] = posts.map(p => {
    const likes = Math.max(0, safeNum(p.likes))
    const reposts = Math.max(0, safeNum(p.reposts))
    const replies = Math.max(0, safeNum(p.replies))
    return likes + 2 * reposts + 3 * replies
  })

  // Use weighted stats for engagement
  const engMean = weightedMean(engPerPost, decayWeights)
  const engStd = weightedStd(engPerPost, decayWeights)
  const cv = engMean > 0 ? engStd / engMean : 999
  const volatility = cv

  const engagementStability = clamp(engMean > 0 ? 1 - cv : 0, 0, 1)

  // --- 3) Posting consistency (fallback: rate-based)
  const postsPerDay = nPosts / windowDays
  const postingConsistency = clamp(Math.log1p(postsPerDay) / Math.log1p(5), 0, 1)

  // --- 4) Engagement quality EQ (weighted rates per views)
  // Use weighted sums so recent posts matter more
  const likesArr = posts.map(p => Math.max(0, safeNum(p.likes)))
  const repostsArr = posts.map(p => Math.max(0, safeNum(p.reposts)))
  const repliesArr = posts.map(p => Math.max(0, safeNum(p.replies)))
  
  const weightedLikes = weightedSum(likesArr, decayWeights)
  const weightedReposts = weightedSum(repostsArr, decayWeights)
  const weightedReplies = weightedSum(repliesArr, decayWeights)
  const weightedViewsSum = weightedSum(viewsList, decayWeights)

  // denom: prefer actual weighted views sum
  const denomViews = Math.max(weightedViewsSum, realViews * Math.max(1, nPosts), 1)

  const likeRate = weightedLikes / denomViews
  const repostRate = weightedReposts / denomViews
  const replyRate = weightedReplies / denomViews

  const eqRaw = 1.0 * likeRate + 2.0 * repostRate + 3.0 * replyRate
  const engagementQuality = clamp(1 - Math.exp(-20 * eqRaw), 0, 1) // 0..1

  // --- 5) Reach efficiency (normalized)
  // RE_norm: compares log-scale of reach vs followers (0..1)
  const reNorm = followersNow > 0
    ? clamp((clamp(Math.log10(1 + realViews) / Math.max(Math.log10(1 + followersNow), 1e-9), 0, 2)) / 2, 0, 1)
    : 0

  // --- 6) Growth (optional)
  let followerGrowth: number | undefined = undefined
  const followersThen = input.followers_then
  if (followersThen != null) {
    const ft = safeNum(followersThen)
    if (ft > 0) followerGrowth = (followersNow - ft) / ft
  }

  // --- 7) Red flags (rule-based)
  const redFlags: ConnectionsRedFlag[] = []

  if (likeRate > 0.02 && repostRate < 0.0005 && replyRate < 0.0002) {
    redFlags.push({
      type: 'RATIO_LIKE_HEAVY',
      severity: 2,
      reason: `Высокий like_rate (${(likeRate * 100).toFixed(2)}%) при почти нулевых repost/reply → подозрение на искусственное вовлечение.`,
    })
  }

  if (repostRate > 0.01 && likeRate < 0.002) {
    redFlags.push({
      type: 'RATIO_REPOST_FARM',
      severity: 2,
      reason: `Высокий repost_rate (${(repostRate * 100).toFixed(2)}%) при низком like_rate (${(likeRate * 100).toFixed(2)}%) → похоже на репост-ферму.`,
    })
  }

  if (viewsList.length >= 5 && medianViews > 0) {
    const maxV = Math.max(...viewsList)
    if (maxV / medianViews > 10) {
      redFlags.push({
        type: 'VIRAL_SPIKE_DEPENDENCE',
        severity: 1,
        reason: `Зависимость от редких всплесков: max_views/median_views = ${(maxV / medianViews).toFixed(1)} (>10).`,
      })
    }
  }

  if (followerGrowth != null && followerGrowth > 0.25 && reNorm < 0.2) {
    redFlags.push({
      type: 'GROWTH_SPIKE_LOW_REACH',
      severity: 3,
      reason: `Рост подписчиков ${(followerGrowth * 100).toFixed(1)}% за окно при низкой reach_efficiency → риск накрутки/неестественного роста.`,
    })
  }

  if (engagementStability < 0.25) {
    redFlags.push({
      type: 'LOW_STABILITY',
      severity: 1,
      reason: `Низкая стабильность вовлечения (stability=${engagementStability.toFixed(2)}) → высокая вариативность и шум.`,
    })
  }

  if (postsPerDay < 0.05) {
    redFlags.push({
      type: 'LOW_ACTIVITY',
      severity: 1,
      reason: `Низкая активность: ${postsPerDay.toFixed(2)} постов/день. Рейтинг по влиянию будет консервативным.`,
    })
  }

  // --- 8) Risk level
  let riskPoints = 0
  for (const f of redFlags) riskPoints += f.severity

  const riskLevel: 'low' | 'medium' | 'high' =
    riskPoints >= 6 ? 'high' : riskPoints >= 3 ? 'medium' : 'low'

  // --- 9) Resolve scoring profile based on followers
  const profileType = resolveScoringProfile(followersNow)
  const profileConfig = ScoringProfiles[profileType]
  const profileWeights = profileConfig.weights
  const thresholds = getProfileThresholds()

  // --- 10) Scores with profile-specific weights
  // RVE score saturates at 1M views (tune later)
  const rveScore = clamp(Math.log10(1 + realViews) / Math.log10(1 + 1_000_000), 0, 1)

  // authority stub: neutral placeholder until graph/TNI подключится
  const authorityStub = 0.5

  // X Score with profile weights
  const penaltyX = clamp(riskPoints / 10, 0, profileWeights.x.penalty_cap)
  const xScoreRaw = 
    profileWeights.x.pc * postingConsistency +
    profileWeights.x.es * engagementStability +
    profileWeights.x.eq * engagementQuality -
    penaltyX
  const xScore = Math.round(1000 * clamp(xScoreRaw, 0, 1))

  // Influence Score with profile weights
  const penaltyInfluence = clamp(riskPoints / 10, 0, profileWeights.influence.penalty_cap)
  const influenceScoreRaw =
    profileWeights.influence.rve * rveScore +
    profileWeights.influence.re * reNorm +
    profileWeights.influence.eq * engagementQuality +
    profileWeights.influence.authority * authorityStub -
    penaltyInfluence
  const influenceScore = Math.round(1000 * clamp(influenceScoreRaw, 0, 1))

  // Signal/Noise (0..10)
  const signal = 0.5 * engagementStability + 0.3 * postingConsistency + 0.2 * engagementQuality
  const noise = clamp(riskPoints / 10 + volatility / 3, 0, 1)
  const signalNoise = round1(10 * clamp(signal - noise, 0, 1))

  return {
    influence_score: influenceScore,
    x_score: xScore,
    risk_level: riskLevel,
    signal_noise: signalNoise,
    profile: profileType,

    metrics: {
      real_views: Math.round(realViews),
      engagement_quality: Number(engagementQuality.toFixed(4)),
      posting_consistency: Number(postingConsistency.toFixed(4)),
      engagement_stability: Number(engagementStability.toFixed(4)),
      volatility: Number(volatility.toFixed(4)),
      reach_efficiency: Number(reNorm.toFixed(4)),
      follower_growth: followerGrowth != null ? Number(followerGrowth.toFixed(4)) : undefined,
    },

    red_flags: redFlags,

    explain: {
      inputs_used: {
        posts_count: nPosts,
        window_days: windowDays,
        followers_now: followersNow,
        followers_then: followersThen,
      },
      profile: {
        type: profileType,
        name: profileConfig.name,
        description: profileConfig.description,
        thresholds: thresholds[profileType],
      },
      components: {
        rve_score: Number(rveScore.toFixed(4)),
        re_score: Number(reNorm.toFixed(4)),
        eq_score: Number(engagementQuality.toFixed(4)),
        pc_score: Number(postingConsistency.toFixed(4)),
        es_score: Number(engagementStability.toFixed(4)),
        authority_stub: authorityStub,
        penalty_x: Number(penaltyX.toFixed(4)),
        penalty_influence: Number(penaltyInfluence.toFixed(4)),
      },
      weights: {
        influence: {
          rve: profileWeights.influence.rve,
          re: profileWeights.influence.re,
          eq: profileWeights.influence.eq,
          authority: profileWeights.influence.authority,
        },
        x: {
          pc: profileWeights.x.pc,
          es: profileWeights.x.es,
          eq: profileWeights.x.eq,
        },
      },
      decay: {
        enabled: true,
        half_life_days: decayInfo.half_life_days,
        description: decayInfo.description,
      },
    },
  }
}
