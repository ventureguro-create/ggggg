/**
 * Taxonomy v2 - Type Definitions
 * 
 * PHASE B: Hard Identity Layer
 * Account can belong to multiple groups with weighted membership
 */

export type TaxonomyGroupKey =
  | 'EARLY_PROJECTS'
  | 'TRENDING_TRADING'
  | 'VC'
  | 'MOST_SEARCHED'
  | 'INFLUENCE'
  | 'SMART'
  | 'NFT'
  | 'MEDIA'
  | 'POPULAR_PROJECTS';

export type TaxonomySource = 'RULE' | 'ADMIN' | 'IMPORT';

export interface TaxonomyMembership {
  _id?: string;
  accountId: string;      // twitter author id OR unified account id
  group: TaxonomyGroupKey;
  weight: number;         // 0..1
  source: TaxonomySource;
  reasons: string[];
  evidence?: Record<string, any>;
  isFrozen?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TaxonomyGroup {
  key: TaxonomyGroupKey;
  title: string;
  icon: string;
  order: number;
  description?: string;
}

export interface TaxonomyRules {
  version: number;
  weights: Record<TaxonomyGroupKey, number>;
  thresholds: Record<string, number>;
}

export interface TaxonomyLabel {
  key: TaxonomyGroupKey;
  weight: number;
  reasons: string[];
}
