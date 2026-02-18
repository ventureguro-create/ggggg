/**
 * Network Alpha Config
 * Cross-channel earliness detection settings
 */
export const NETWORK_ALPHA_DEFAULTS = {
  lookbackDays: 90,

  // Token qualifies as "successful event"
  success: {
    minReturn7d: 20, // +20% in 7d
    minMentions: 5, // at least 5 mentions across channels
  },

  // Early definition
  early: {
    topPercent: 0.1, // top 10% earliest
    maxHoursFromFirst: 24, // alternatively: within 24h of first mention
  },

  // Scoring weights
  weights: {
    earlyHitRate: 0.45,
    avgEarlyPercentile: 0.25,
    qualityWeightedEarliness: 0.2,
    coverage: 0.1,
  },

  // Anti-spam: ignore channels that mention too many tokens/day
  channelGuards: {
    maxMentionsPerDay: 40,
  },
};
