/**
 * Presets Constants
 * 
 * PHASE B: UI Presets v2
 */

export const PRESETS = [
  { key: 'EARLY', label: 'Early', icon: '✨', description: 'Early stage projects' },
  { key: 'VC', label: 'VC', icon: '🏛️', description: 'Venture capital' },
  { key: 'SMART', label: 'Smart', icon: '🧠', description: 'Smart money' },
  { key: 'INFLUENCE', label: 'Influence', icon: '⚡', description: 'High reach' },
  { key: 'MEDIA', label: 'Media', icon: '📰', description: 'News & media' },
  { key: 'NFT', label: 'NFT', icon: '💎', description: 'NFT ecosystem' },
  { key: 'TRADING', label: 'Trading', icon: '📈', description: 'Trading & alpha' },
  { key: 'POPULAR', label: 'Popular', icon: '🔥', description: 'High visibility' },
  { key: 'MOST_SEARCHED', label: 'Search', icon: '🔎', description: 'Trending searches' },
] as const;

export type PresetKey = typeof PRESETS[number]['key'];

export const DEFAULT_PRESET: PresetKey = 'SMART';
