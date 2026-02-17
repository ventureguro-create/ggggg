/**
 * Taxonomy v2 - Constants
 */

import { TaxonomyGroup, TaxonomyRules } from './taxonomy.types.js';

export const TAXONOMY_GROUPS: TaxonomyGroup[] = [
  { key: 'EARLY_PROJECTS', title: 'Early', icon: 'spark', order: 10, description: 'Early stage projects with growth signals' },
  { key: 'VC', title: 'VC', icon: 'bank', order: 20, description: 'Venture capital and funds' },
  { key: 'SMART', title: 'Smart', icon: 'brain', order: 30, description: 'Smart money and informed accounts' },
  { key: 'INFLUENCE', title: 'Influence', icon: 'bolt', order: 40, description: 'High reach and network influence' },
  { key: 'MEDIA', title: 'Media', icon: 'news', order: 50, description: 'News, journalism, media outlets' },
  { key: 'NFT', title: 'NFT', icon: 'diamond', order: 60, description: 'NFT collectors, artists, projects' },
  { key: 'TRENDING_TRADING', title: 'Trading', icon: 'chart', order: 70, description: 'Trading, alpha, DeFi focus' },
  { key: 'POPULAR_PROJECTS', title: 'Popular', icon: 'fire', order: 80, description: 'High visibility projects' },
  { key: 'MOST_SEARCHED', title: 'Searched', icon: 'search', order: 90, description: 'Trending in searches' },
];

export const DEFAULT_TAXONOMY_RULES: TaxonomyRules = {
  version: 1,
  weights: {
    EARLY_PROJECTS: 1.0,
    TRENDING_TRADING: 1.0,
    VC: 1.0,
    MOST_SEARCHED: 1.0,
    INFLUENCE: 1.0,
    SMART: 1.0,
    NFT: 1.0,
    MEDIA: 1.0,
    POPULAR_PROJECTS: 1.0,
  },
  thresholds: {
    influence_score: 0.65,
    smart_followers: 0.60,
    authority_vc: 0.75,
    trending_velocity: 0.55,
    early_signal: 0.50,
    popular_followers: 0.70,
  },
};

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const safeNum = (x: any, fallback = 0): number => (Number.isFinite(+x) ? +x : fallback);
