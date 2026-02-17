/**
 * Account Groups Classifier
 * 
 * Classifies accounts into groups based on metrics.
 */

import type { AccountGroup, AccountGroupMembership, TwitterScoreV2, AuthorityV3 } from '../network-v2-plus.types.js';

export interface ClassificationInput {
  accountId: string;
  
  // From TwitterScoreV2
  influence: number;
  smart: number;
  network: number;
  early: number;
  activity: number;
  
  // From Authority
  seedAuthority: number;
  
  // Additional signals
  categories?: string[];
  searchCount?: number;  // Internal search hits
  followers?: number;
  isProject?: boolean;
}

/**
 * Group thresholds
 */
const THRESHOLDS = {
  VC: { seedAuthority: 0.7 },
  EARLY_PROJECTS: { early: 0.65 },
  TRENDING: { activity: 0.7, influence: 0.5 },
  SMART: { smart: 0.7 },
  NFT: { categories: ['NFT'] },
  MEDIA: { influence: 0.6, seedAuthority: 0.3 }, // High reach, low seed
  POPULAR_PROJECT: { followers: 50000, network: 0.5, isProject: true },
  MOST_SEARCHED: { searchCount: 100 },
};

/**
 * Check if account belongs to VC group
 */
export function isVC(input: ClassificationInput): boolean {
  return input.seedAuthority >= THRESHOLDS.VC.seedAuthority;
}

/**
 * Check if account is Early Project
 */
export function isEarlyProject(input: ClassificationInput): boolean {
  return input.early >= THRESHOLDS.EARLY_PROJECTS.early && (input.isProject ?? false);
}

/**
 * Check if account is Trending
 */
export function isTrending(input: ClassificationInput): boolean {
  return (
    input.activity >= THRESHOLDS.TRENDING.activity &&
    input.influence >= THRESHOLDS.TRENDING.influence
  );
}

/**
 * Check if account is Smart (high quality connections, low noise)
 */
export function isSmart(input: ClassificationInput): boolean {
  return input.smart >= THRESHOLDS.SMART.smart;
}

/**
 * Check if account is NFT-related
 */
export function isNFT(input: ClassificationInput): boolean {
  return input.categories?.some(c => 
    c.toUpperCase().includes('NFT')
  ) ?? false;
}

/**
 * Check if account is Media
 */
export function isMedia(input: ClassificationInput): boolean {
  return (
    input.influence >= THRESHOLDS.MEDIA.influence &&
    input.seedAuthority < THRESHOLDS.MEDIA.seedAuthority
  );
}

/**
 * Check if account is Popular Project
 */
export function isPopularProject(input: ClassificationInput): boolean {
  return (
    (input.followers ?? 0) >= THRESHOLDS.POPULAR_PROJECT.followers &&
    input.network >= THRESHOLDS.POPULAR_PROJECT.network &&
    (input.isProject ?? false)
  );
}

/**
 * Check if account is Most Searched
 */
export function isMostSearched(input: ClassificationInput): boolean {
  return (input.searchCount ?? 0) >= THRESHOLDS.MOST_SEARCHED.searchCount;
}

/**
 * Get group score (how strongly account fits in group)
 */
export function getGroupScore(input: ClassificationInput, group: AccountGroup): number {
  switch (group) {
    case 'VC':
      return input.seedAuthority;
    case 'EARLY_PROJECTS':
      return input.early;
    case 'TRENDING':
      return (input.activity + input.influence) / 2;
    case 'SMART':
      return input.smart;
    case 'NFT':
      return isNFT(input) ? 0.8 : 0;
    case 'MEDIA':
      return isMedia(input) ? input.influence : 0;
    case 'POPULAR_PROJECT':
      return isPopularProject(input) ? input.network : 0;
    case 'MOST_SEARCHED':
      return Math.min(1, (input.searchCount ?? 0) / 500);
    default:
      return 0;
  }
}

/**
 * Classify account into groups
 */
export function classifyAccount(input: ClassificationInput): AccountGroupMembership {
  const groups: AccountGroup[] = [];
  const scores: Record<AccountGroup, number> = {
    VC: 0,
    EARLY_PROJECTS: 0,
    TRENDING: 0,
    SMART: 0,
    NFT: 0,
    MEDIA: 0,
    POPULAR_PROJECT: 0,
    MOST_SEARCHED: 0,
  };
  
  // Check each group
  if (isVC(input)) {
    groups.push('VC');
    scores.VC = getGroupScore(input, 'VC');
  }
  
  if (isEarlyProject(input)) {
    groups.push('EARLY_PROJECTS');
    scores.EARLY_PROJECTS = getGroupScore(input, 'EARLY_PROJECTS');
  }
  
  if (isTrending(input)) {
    groups.push('TRENDING');
    scores.TRENDING = getGroupScore(input, 'TRENDING');
  }
  
  if (isSmart(input)) {
    groups.push('SMART');
    scores.SMART = getGroupScore(input, 'SMART');
  }
  
  if (isNFT(input)) {
    groups.push('NFT');
    scores.NFT = getGroupScore(input, 'NFT');
  }
  
  if (isMedia(input)) {
    groups.push('MEDIA');
    scores.MEDIA = getGroupScore(input, 'MEDIA');
  }
  
  if (isPopularProject(input)) {
    groups.push('POPULAR_PROJECT');
    scores.POPULAR_PROJECT = getGroupScore(input, 'POPULAR_PROJECT');
  }
  
  if (isMostSearched(input)) {
    groups.push('MOST_SEARCHED');
    scores.MOST_SEARCHED = getGroupScore(input, 'MOST_SEARCHED');
  }
  
  // Determine primary group (highest score)
  let primaryGroup: AccountGroup = 'SMART'; // Default
  let maxScore = 0;
  
  for (const group of groups) {
    if (scores[group] > maxScore) {
      maxScore = scores[group];
      primaryGroup = group;
    }
  }
  
  // If no groups matched, use SMART as fallback
  if (groups.length === 0) {
    groups.push('SMART');
    scores.SMART = input.smart;
  }
  
  return {
    accountId: input.accountId,
    groups,
    primaryGroup,
    scores,
  };
}

/**
 * Get accounts by group (filter function)
 */
export function filterByGroup(
  accounts: ClassificationInput[],
  group: AccountGroup
): ClassificationInput[] {
  return accounts.filter(acc => {
    const membership = classifyAccount(acc);
    return membership.groups.includes(group);
  }).sort((a, b) => {
    return getGroupScore(b, group) - getGroupScore(a, group);
  });
}

console.log('[GroupsClassifier] Loaded');
