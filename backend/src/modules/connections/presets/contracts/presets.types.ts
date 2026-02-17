/**
 * Presets Types
 * 
 * PHASE D: UI Groups + Preset system.
 */

export type PresetId = 
  | 'EARLY'
  | 'VC'
  | 'SMART'
  | 'INFLUENCE'
  | 'MEDIA'
  | 'NFT'
  | 'TRADING'
  | 'POPULAR'
  | 'MOST_SEARCHED';

export type Preset = {
  id: PresetId;
  label: string;
  description: string;
  icon: string;
  
  // Filters applied
  filters: {
    facet?: string;
    minAuthority?: number;
    minEngagement?: number;
    accountTypes?: string[];
    tags?: string[];
    graphLayer?: string;
  };
  
  // Sorting
  sortBy: 'authority' | 'engagement' | 'followers' | 'earlySignal' | 'trending';
  sortOrder: 'asc' | 'desc';
  
  // Display
  badges?: string[];
  color?: string;
};

export const PRESETS: Preset[] = [
  {
    id: 'EARLY',
    label: 'Early Projects',
    description: 'Discover projects before they trend',
    icon: 'Sparkles',
    filters: { facet: 'EARLY', minAuthority: 0.3 },
    sortBy: 'earlySignal',
    sortOrder: 'desc',
    badges: ['Early Signal'],
    color: '#10B981',
  },
  {
    id: 'VC',
    label: 'VC / Funds',
    description: 'Top venture capital and investment funds',
    icon: 'Building2',
    filters: { facet: 'VC', accountTypes: ['BACKER'] },
    sortBy: 'authority',
    sortOrder: 'desc',
    badges: ['Seed Authority'],
    color: '#8B5CF6',
  },
  {
    id: 'SMART',
    label: 'Smart Money',
    description: 'Accounts with high on-chain confirmation rate',
    icon: 'Brain',
    filters: { facet: 'SMART', minAuthority: 0.6 },
    sortBy: 'authority',
    sortOrder: 'desc',
    badges: ['Reality Confirmed'],
    color: '#3B82F6',
  },
  {
    id: 'INFLUENCE',
    label: 'Influence Leaders',
    description: 'Most influential accounts in the network',
    icon: 'Users',
    filters: { facet: 'INFLUENCE' },
    sortBy: 'authority',
    sortOrder: 'desc',
    color: '#F59E0B',
  },
  {
    id: 'MEDIA',
    label: 'Media',
    description: 'News and media outlets',
    icon: 'Newspaper',
    filters: { facet: 'MEDIA', tags: ['media', 'news'] },
    sortBy: 'followers',
    sortOrder: 'desc',
    color: '#EC4899',
  },
  {
    id: 'NFT',
    label: 'NFT',
    description: 'NFT focused accounts and collectors',
    icon: 'Image',
    filters: { facet: 'NFT', tags: ['nft', 'art'] },
    sortBy: 'engagement',
    sortOrder: 'desc',
    color: '#14B8A6',
  },
  {
    id: 'TRADING',
    label: 'Trading / Alpha',
    description: 'Active traders and alpha hunters',
    icon: 'TrendingUp',
    filters: { facet: 'ALPHA', tags: ['trading', 'alpha'] },
    sortBy: 'trending',
    sortOrder: 'desc',
    badges: ['Active'],
    color: '#EF4444',
  },
  {
    id: 'POPULAR',
    label: 'Popular Projects',
    description: 'Most popular and established projects',
    icon: 'Star',
    filters: { facet: 'POPULAR' },
    sortBy: 'followers',
    sortOrder: 'desc',
    color: '#F97316',
  },
  {
    id: 'MOST_SEARCHED',
    label: 'Most Searched',
    description: 'Trending searches in the platform',
    icon: 'Search',
    filters: {},
    sortBy: 'trending',
    sortOrder: 'desc',
    color: '#6366F1',
  },
];
