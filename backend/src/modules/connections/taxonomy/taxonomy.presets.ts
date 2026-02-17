/**
 * Taxonomy v2 - Presets
 * 
 * Maps UI preset keys to taxonomy groups
 */

import { TaxonomyGroupKey } from './taxonomy.types.js';

export type PresetKey =
  | 'EARLY'
  | 'VC'
  | 'SMART'
  | 'INFLUENCE'
  | 'MEDIA'
  | 'NFT'
  | 'TRADING'
  | 'POPULAR'
  | 'MOST_SEARCHED';

export const PRESET_TO_GROUP: Record<PresetKey, TaxonomyGroupKey> = {
  EARLY: 'EARLY_PROJECTS',
  VC: 'VC',
  SMART: 'SMART',
  INFLUENCE: 'INFLUENCE',
  MEDIA: 'MEDIA',
  NFT: 'NFT',
  TRADING: 'TRENDING_TRADING',
  POPULAR: 'POPULAR_PROJECTS',
  MOST_SEARCHED: 'MOST_SEARCHED',
};

export const PRESET_DEFINITIONS = [
  { key: 'EARLY' as PresetKey, label: 'Early', icon: '✨', group: 'EARLY_PROJECTS' },
  { key: 'VC' as PresetKey, label: 'VC', icon: '🏛️', group: 'VC' },
  { key: 'SMART' as PresetKey, label: 'Smart', icon: '🧠', group: 'SMART' },
  { key: 'INFLUENCE' as PresetKey, label: 'Influence', icon: '⚡', group: 'INFLUENCE' },
  { key: 'MEDIA' as PresetKey, label: 'Media', icon: '📰', group: 'MEDIA' },
  { key: 'NFT' as PresetKey, label: 'NFT', icon: '💎', group: 'NFT' },
  { key: 'TRADING' as PresetKey, label: 'Trading', icon: '📈', group: 'TRENDING_TRADING' },
  { key: 'POPULAR' as PresetKey, label: 'Popular', icon: '🔥', group: 'POPULAR_PROJECTS' },
  { key: 'MOST_SEARCHED' as PresetKey, label: 'Search', icon: '🔎', group: 'MOST_SEARCHED' },
];
