export const FacetKeys = [
  "SMART",
  "INFLUENCE",
  "EARLY",
  "VC",
  "MEDIA",
  "NFT",
  "POPULAR",
  "TRENDING",
  "MOST_SEARCHED",
  "REAL_TWITTER"
] as const;

export type FacetKey = typeof FacetKeys[number];

export const FACETS: Record<FacetKey, {
  title: string;
  filter: any;
  sort: { by: string; dir: -1 | 1 };
}> = {
  SMART: {
    title: "Smart Accounts",
    filter: { min: { smart: 0.65 } },
    sort: { by: "smart", dir: -1 }
  },

  INFLUENCE: {
    title: "Influencers",
    filter: { min: { influence: 0.6 } },
    sort: { by: "influence", dir: -1 }
  },

  EARLY: {
    title: "Early Signals",
    filter: { min: { early: 0.6 } },
    sort: { by: "early", dir: -1 }
  },

  VC: {
    title: "Funds & VCs",
    filter: { kind: "BACKER" },
    sort: { by: "authority", dir: -1 }
  },

  MEDIA: {
    title: "Crypto Media",
    filter: { tags: ["media"] },
    sort: { by: "influence", dir: -1 }
  },

  NFT: {
    title: "NFT Accounts",
    filter: { categories: ["NFT"] },
    sort: { by: "influence", dir: -1 }
  },

  POPULAR: {
    title: "Popular",
    filter: { min: { followers: 100000 } },
    sort: { by: "followers", dir: -1 }
  },

  TRENDING: {
    title: "Trending (Trading)",
    filter: { tags: ["trading"] },
    sort: { by: "engagement", dir: -1 }
  },

  MOST_SEARCHED: {
    title: "Most Searched",
    filter: {},
    sort: { by: "searchScore", dir: -1 }
  },

  REAL_TWITTER: {
    title: "Real Twitter Data",
    filter: { source: "PLAYWRIGHT_PARSER" },
    sort: { by: "lastSeen", dir: -1 }
  }
};
