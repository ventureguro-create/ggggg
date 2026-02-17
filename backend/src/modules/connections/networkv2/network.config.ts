/**
 * Network V2+ Configuration
 * All weights and limits in one place for easy tuning
 */

export const NETWORK_V2_CONFIG = {
  // Authority v3 weights
  authorityWeights: {
    seed: 0.35,      // Backers Registry
    network: 0.30,   // Network centrality + anchor proximity
    media: 0.20,     // Media coverage / reach
    onchain: 0.15    // Onchain reputation (future)
  },

  // Handshake v2 settings
  handshake: {
    maxHops: 3,
    hopPenalty: [1.0, 0.7, 0.4], // 1 hop = 1.0, 2 hops = 0.7, 3 hops = 0.4
    anchorBoostMultiplier: 1.5,   // boost when path goes through anchor
    minConfidence: 0.6
  },

  // Graph caps
  caps: {
    maxNetworkWeight: 0.25,
    maxNodes: 500,
    maxEdges: 2000
  },

  // Preset configurations
  presets: {
    SMART: {
      highlight: ['SMART', 'BACKER'],
      hide: ['NOISE'],
      edgeWeight: 'handshakeScore',
      filters: {
        minAuthority: 0.65,
        minHandshakeToAnchor: 0.5,
        botRisk: 'LOW'
      },
      sort: { field: 'smartScore', order: -1 },
      formula: {
        earlyScore: 0.4,
        anchorProximity: 0.4,
        accuracy: 0.2
      }
    },
    VC: {
      highlight: ['BACKER', 'PROJECT'],
      edgeWeight: 'coInvestmentWeight',
      filters: {
        backerType: ['VC', 'FUND'],
        minSeedAuthority: 0.7
      },
      sort: { field: 'seedAuthority', order: -1 }
    },
    EARLY: {
      highlight: ['EARLY'],
      edgeWeight: 'earlySignalWeight',
      filters: {
        minEarlyScore: 0.6,
        firstMentionBeforePump: true
      },
      sort: { field: 'earlyScore', order: -1 }
    },
    MEDIA: {
      highlight: ['MEDIA'],
      edgeWeight: 'reach',
      filters: {
        minMediaAuthority: 0.6,
        minTopicDiversity: 0.5
      },
      sort: { field: 'mediaAuthority', order: -1 }
    },
    INFLUENCE: {
      highlight: ['INFLUENCER'],
      edgeWeight: 'engagementWeight',
      filters: {
        minFollowers: 50000,
        minEngagementRate: 0.02
      },
      sort: { field: 'influenceScore', order: -1 }
    },
    NFT: {
      highlight: ['NFT'],
      edgeWeight: 'categoryWeight',
      filters: {
        categories: ['NFT']
      },
      sort: { field: 'influence', order: -1 }
    },
    TRENDING: {
      highlight: ['TRENDING'],
      edgeWeight: 'velocityWeight',
      filters: {
        tags: ['trading']
      },
      sort: { field: 'engagement', order: -1 }
    },
    POPULAR: {
      highlight: ['POPULAR'],
      edgeWeight: 'sizeWeight',
      filters: {
        minFollowers: 100000
      },
      sort: { field: 'followers', order: -1 }
    }
  },

  // Score thresholds
  thresholds: {
    highAuthority: 0.75,
    mediumAuthority: 0.5,
    lowAuthority: 0.25,
    strongHandshake: 0.6,
    weakHandshake: 0.3
  }
};

export type PresetKey = keyof typeof NETWORK_V2_CONFIG.presets;
