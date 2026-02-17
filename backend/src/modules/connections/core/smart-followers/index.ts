/**
 * Smart Followers Module - Main Export
 */

export { computeSmartFollowers, generateMockFollowers } from './smart-followers-engine.js';

export { 
  smartFollowersConfig, 
  updateSmartFollowersConfig, 
  getSmartFollowersConfig,
  SMART_FOLLOWERS_VERSION,
} from './smart-followers-config.js';
export type { SmartFollowersConfig } from './smart-followers-config.js';

export { explainSmartFollowers, getTierLabel, getTierColor } from './smart-followers-explain.js';

export { logistic01, minmax01 } from './smart-followers-normalize.js';

export type {
  AuthorityTier,
  SmartFollower,
  SmartFollowersInput,
  SmartFollowersBreakdownItem,
  SmartFollowersResult,
} from './smart-followers-types.js';
