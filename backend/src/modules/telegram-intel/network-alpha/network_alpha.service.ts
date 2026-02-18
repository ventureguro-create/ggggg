/**
 * Network Alpha Service
 * Cross-channel earliness detection - the "killer feature"
 *
 * For each token:
 * - Find all mentions across channels
 * - Rank by time (who mentioned first)
 * - For successful tokens (+20% in 7d): track who was early
 *
 * Computes networkAlphaScore per channel (0..100)
 */
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';
import { TgNetworkAlphaChannelModel } from '../models/tg.network_alpha_channel.model.js';
import { TgNetworkAlphaTokenModel } from '../models/tg.network_alpha_token.model.js';
import { NETWORK_ALPHA_DEFAULTS as D } from './network_alpha.config.js';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

function tier(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 78) return 'A';
  if (score >= 62) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 1;
  let lo = 0,
    hi = sorted.length - 1,
    pos = sorted.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] >= value) {
      pos = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return pos / sorted.length;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(q * (sorted.length - 1)))
  );
  return sorted[idx];
}

export class NetworkAlphaService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  async compute(lookbackDays = D.lookbackDays) {
    const since = new Date(Date.now() - lookbackDays * 86400000);

    // Load evaluated mentions with returns
    const mentions = await TgTokenMentionModel.find({
      evaluated: true,
      mentionedAt: { $gte: since },
    })
      .select('username token mentionedAt returns')
      .lean();

    // Group by token
    const byToken = new Map<string, any[]>();
    for (const m of mentions) {
      const token = String((m as any).token || '').toUpperCase();
      if (!token) continue;
      if (!byToken.has(token)) byToken.set(token, []);
      byToken.get(token)!.push(m);
    }

    // Per channel accumulators
    const ch = new Map<
      string,
      {
        tokensCovered: number;
        successfulTokens: number;
        earlyHits: number;
        earlyPercentiles: number[];
        qualityWeighted: number;
        qualityWeightTotal: number;
      }
    >();

    let qualifiedTokens = 0;

    for (const [token, arr] of byToken) {
      if (arr.length < D.success.minMentions) continue;

      // Sort mentions by time
      const sorted = [...arr].sort(
        (a, b) =>
          new Date((a as any).mentionedAt).getTime() -
          new Date((b as any).mentionedAt).getTime()
      );

      const t0 = new Date((sorted[0] as any).mentionedAt).getTime();

      // Compute delays (hours from first mention)
      const delaysH = sorted.map(
        (m) =>
          (new Date((m as any).mentionedAt).getTime() - t0) / 3600000
      );
      const delaysSorted = [...delaysH].sort((a, b) => a - b);

      // Success qualification: max7d or r7d
      const max7d = sorted
        .map((m) =>
          Number((m as any).returns?.max7d ?? (m as any).returns?.r7d ?? 0)
        )
        .reduce((mx, v) => Math.max(mx, v), 0);

      const qualified = max7d >= D.success.minReturn7d;
      if (!qualified) continue;

      qualifiedTokens++;

      // Store token-level doc
      const firstMentions = sorted.slice(0, 10).map((m, i) => ({
        username: String((m as any).username),
        mentionedAt: new Date((m as any).mentionedAt),
        delayHours: delaysH[i],
      }));

      await TgNetworkAlphaTokenModel.updateOne(
        { token },
        {
          $set: {
            token,
            lookbackDays,
            mentionsCount: sorted.length,
            channelsCount: new Set(sorted.map((m) => String((m as any).username))).size,
            firstMentionAt: new Date(t0),
            p50MentionDelayHours: quantile(delaysSorted, 0.5),
            p90MentionDelayHours: quantile(delaysSorted, 0.9),
            success: { max7dReturn: max7d, qualified: true },
            firstMentions,
            computedAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Process each mention for channel stats
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i];
        const u = String((m as any).username).toLowerCase();
        const delay = delaysH[i];

        const p = percentileRank(delaysSorted, delay);

        const isEarlyByPercent = p <= D.early.topPercent;
        const isEarlyByHours = delay <= D.early.maxHoursFromFirst;
        const early = isEarlyByPercent || isEarlyByHours;

        if (!ch.has(u)) {
          ch.set(u, {
            tokensCovered: 0,
            successfulTokens: 0,
            earlyHits: 0,
            earlyPercentiles: [],
            qualityWeighted: 0,
            qualityWeightTotal: 0,
          });
        }

        const acc = ch.get(u)!;
        acc.tokensCovered += 1;
        acc.successfulTokens += 1;

        if (early) acc.earlyHits += 1;

        acc.earlyPercentiles.push(p);

        // Quality-weighted earliness: reward being early on big winners
        const qW = clamp01(max7d / 100);
        const earliness01 = 1 - clamp01(p);
        acc.qualityWeighted += earliness01 * qW;
        acc.qualityWeightTotal += qW;
      }
    }

    // Compute channel scores
    for (const [username, a] of ch) {
      const tokensCovered = a.tokensCovered;
      const successfulTokens = a.successfulTokens;

      const earlyHitRate =
        successfulTokens > 0 ? a.earlyHits / successfulTokens : 0;
      const avgEarlyPercentile = a.earlyPercentiles.length
        ? a.earlyPercentiles.reduce((s, v) => s + v, 0) / a.earlyPercentiles.length
        : 1;

      const qualityWeightedEarliness =
        a.qualityWeightTotal > 0
          ? a.qualityWeighted / a.qualityWeightTotal
          : 0;

      // Coverage score: more tokens => higher confidence
      const coverageScore = clamp01(Math.sqrt(tokensCovered / 60));

      // Convert avgEarlyPercentile to "goodness": lower is better
      const earlyPercentileGoodness = 1 - clamp01(avgEarlyPercentile);

      // Combined score
      const raw01 =
        D.weights.earlyHitRate * earlyHitRate +
        D.weights.avgEarlyPercentile * earlyPercentileGoodness +
        D.weights.qualityWeightedEarliness * qualityWeightedEarliness +
        D.weights.coverage * coverageScore;

      const networkAlphaScore = clamp100(raw01 * 100);

      const doc = {
        username,
        networkAlphaScore,
        tier: tier(networkAlphaScore),
        stats: {
          lookbackDays,
          tokensCovered,
          successfulTokens,
          earlyHitRate,
          avgEarlyPercentile,
          qualityWeightedEarliness,
          coverageScore,
        },
        explain: {
          qualifiedTokens,
          config: D,
          raw01,
          earlyPercentileGoodness,
        },
        computedAt: new Date(),
      };

      await TgNetworkAlphaChannelModel.updateOne(
        { username },
        { $set: doc },
        { upsert: true }
      );
    }

    this.log('[net-alpha] computed', {
      lookbackDays,
      qualifiedTokens,
      channels: ch.size,
    });

    return { ok: true, lookbackDays, qualifiedTokens, channels: ch.size };
  }

  /**
   * Get channel network alpha
   */
  async getChannelNetworkAlpha(username: string) {
    const u = username.toLowerCase();
    const doc = await TgNetworkAlphaChannelModel.findOne({ username: u })
      .select('-_id -__v')
      .lean();
    return { ok: !!doc, doc };
  }

  /**
   * Get token network alpha
   */
  async getTokenNetworkAlpha(token: string) {
    const t = token.toUpperCase();
    const doc = await TgNetworkAlphaTokenModel.findOne({ token: t })
      .select('-_id -__v')
      .lean();
    return { ok: !!doc, doc };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 50, minScore?: number) {
    const filter: any = {};
    if (minScore != null) filter.networkAlphaScore = { $gte: minScore };

    const items = await TgNetworkAlphaChannelModel.find(filter)
      .sort({ networkAlphaScore: -1 })
      .limit(limit)
      .select('-_id -__v')
      .lean();

    return { ok: true, count: items.length, items };
  }

  /**
   * Get channel's network alpha evidence - tokens where channel was early
   * Block UI-4: Shows WHY the networkAlphaScore is what it is
   */
  async getChannelNetworkEvidence(username: string, limit = 25) {
    const u = username.toLowerCase();

    // Find tokens where this channel appears in firstMentions
    const tokens = await TgNetworkAlphaTokenModel.find({
      'firstMentions.username': u,
      'success.qualified': true,
    })
      .sort({ 'success.max7dReturn': -1 })
      .limit(limit * 2) // Fetch more to ensure we have enough after processing
      .select('-_id -__v')
      .lean();

    const items = [];

    for (const t of tokens) {
      const sorted = [...(t.firstMentions || [])].sort(
        (a: any, b: any) => a.delayHours - b.delayHours
      );

      const idx = sorted.findIndex((x: any) => x.username === u);
      if (idx === -1) continue;

      const cohortSize = t.channelsCount || sorted.length;
      const earlyRank = idx + 1;
      const percentile = cohortSize > 0 ? earlyRank / cohortSize : 1;
      const mention = sorted[idx] as any;

      items.push({
        token: t.token,
        earlyRank,
        cohortSize,
        delayHours: Number(mention.delayHours.toFixed(1)),
        percentile: Number(percentile.toFixed(3)),
        return7d: t.success?.max7dReturn ?? 0,
        isHit: (t.success?.max7dReturn ?? 0) >= 20,
        mentionedAt: mention.mentionedAt,
      });
    }

    // Sort by percentile (best first), then by return
    const sorted = items
      .sort((a, b) => {
        if (a.percentile !== b.percentile) return a.percentile - b.percentile;
        return b.return7d - a.return7d;
      })
      .slice(0, limit);

    // Compute summary stats
    const totalHits = sorted.filter((x) => x.isHit).length;
    const avgPercentile =
      sorted.length > 0
        ? sorted.reduce((s, x) => s + x.percentile, 0) / sorted.length
        : null;
    const firstPlaces = sorted.filter((x) => x.earlyRank === 1).length;

    return {
      ok: true,
      username: u,
      count: sorted.length,
      summary: {
        totalTokens: sorted.length,
        hitsCount: totalHits,
        avgPercentile: avgPercentile !== null ? Number(avgPercentile.toFixed(3)) : null,
        firstPlaces,
      },
      items: sorted,
    };
  }

  /**
   * Get channel's position comparison in the network
   * Block UI-5: Shows WHERE the channel stands relative to others
   */
  async getChannelCompare(username: string) {
    const u = username.toLowerCase();

    // Get all channels sorted by intelScore
    const { TgIntelRankingModel } = await import('../models/tg.intel_ranking.model.js');

    const all = await TgIntelRankingModel.find({})
      .sort({ intelScore: -1 })
      .select('username intelScore tier components')
      .lean();

    const total = all.length;
    const index = all.findIndex((x: any) => x.username === u);

    if (index === -1) {
      return { ok: false, error: 'not_found' };
    }

    const current = all[index] as any;
    const rank = index + 1;
    const percentile = rank / total;

    // Get neighbors
    const prev = index > 0 ? all[index - 1] : null;
    const next = index < total - 1 ? all[index + 1] : null;
    const prev2 = index > 1 ? all[index - 2] : null;
    const next2 = index < total - 2 ? all[index + 2] : null;

    // Tier thresholds (from intel ranking config)
    const tierSThreshold = 85;
    const tierAThreshold = 72;
    const tierBThreshold = 55;

    // Calculate gaps
    const gapUp = prev ? (prev as any).intelScore - current.intelScore : null;
    const gapDown = next ? current.intelScore - (next as any).intelScore : null;
    const distanceToTierS = current.tier === 'S' ? 0 : tierSThreshold - current.intelScore;

    // Peer stats (same tier)
    const peers = all.filter((x: any) => x.tier === current.tier);
    const peerAvg =
      peers.length > 0
        ? peers.reduce((s: number, x: any) => s + x.intelScore, 0) / peers.length
        : current.intelScore;

    const formatNeighbor = (n: any) =>
      n
        ? {
            username: n.username,
            intelScore: Number(n.intelScore.toFixed(1)),
            tier: n.tier,
          }
        : null;

    return {
      ok: true,
      username: u,
      current: {
        intelScore: Number(current.intelScore.toFixed(1)),
        tier: current.tier,
        components: current.components,
      },
      position: {
        rank,
        total,
        percentile: Number(percentile.toFixed(3)),
        percentileLabel: `Top ${(percentile * 100).toFixed(1)}%`,
      },
      gaps: {
        up: gapUp !== null ? Number(gapUp.toFixed(2)) : null,
        down: gapDown !== null ? Number(gapDown.toFixed(2)) : null,
        toTierS: Number(distanceToTierS.toFixed(1)),
        toTierA: current.tier !== 'S' && current.tier !== 'A' 
          ? Number((tierAThreshold - current.intelScore).toFixed(1)) 
          : null,
      },
      neighbors: {
        prev: formatNeighbor(prev),
        next: formatNeighbor(next),
        prev2: formatNeighbor(prev2),
        next2: formatNeighbor(next2),
      },
      peerContext: {
        tier: current.tier,
        peersInTier: peers.length,
        tierAverage: Number(peerAvg.toFixed(1)),
        vsAverage: Number((current.intelScore - peerAvg).toFixed(1)),
      },
    };
  }
}
