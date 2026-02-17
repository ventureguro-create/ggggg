/**
 * Taxonomy v2 - Engine
 * 
 * Computes taxonomy labels for accounts using rules
 */

import { Db } from 'mongodb';
import { TaxonomyMembership, TaxonomyGroupKey, TaxonomyLabel, TaxonomyRules } from './taxonomy.types.js';
import { DEFAULT_TAXONOMY_RULES, clamp01, safeNum } from './taxonomy.constants.js';
import { computeSmartWeight } from './rules/smart.rule.js';
import { computeInfluenceWeight } from './rules/influence.rule.js';
import { computeEarlyWeight } from './rules/early.rule.js';
import { computeVcWeight } from './rules/vc.rule.js';

let db: Db;

export function initTaxonomyEngine(database: Db) {
  db = database;
  console.log('[Taxonomy] Engine initialized');
}

/**
 * Get rules from DB or use defaults
 */
export async function getRules(): Promise<TaxonomyRules> {
  try {
    const doc = await db.collection('connections_taxonomy_rules').findOne({ _id: 'default' });
    if (doc) {
      return {
        version: doc.version ?? 1,
        weights: doc.weights ?? DEFAULT_TAXONOMY_RULES.weights,
        thresholds: doc.thresholds ?? DEFAULT_TAXONOMY_RULES.thresholds,
      };
    }
  } catch (err) {
    console.log('[Taxonomy] Using default rules');
  }
  return DEFAULT_TAXONOMY_RULES;
}

/**
 * Compute all taxonomy labels for an account
 */
export function computeTaxonomyLabels(
  metrics: any,
  rules: TaxonomyRules = DEFAULT_TAXONOMY_RULES
): TaxonomyLabel[] {
  const t = rules.thresholds;
  const labels: TaxonomyLabel[] = [];

  // SMART
  const smart = computeSmartWeight(metrics);
  if (smart.weight >= 0.3) {
    labels.push({ key: 'SMART', weight: smart.weight, reasons: smart.reasons });
  }

  // INFLUENCE
  const influence = computeInfluenceWeight(metrics);
  if (influence.weight >= 0.3) {
    labels.push({ key: 'INFLUENCE', weight: influence.weight, reasons: influence.reasons });
  }

  // EARLY_PROJECTS
  const early = computeEarlyWeight(metrics);
  if (early.weight >= 0.25) {
    labels.push({ key: 'EARLY_PROJECTS', weight: early.weight, reasons: early.reasons });
  }

  // VC
  const vc = computeVcWeight(metrics);
  if (vc.weight >= 0.4) {
    labels.push({ key: 'VC', weight: vc.weight, reasons: vc.reasons });
  }

  // MEDIA (simple keyword/flag based)
  if (safeNum(metrics.media_keywords_score_0_1) > 0.5 || metrics.is_media === true) {
    labels.push({
      key: 'MEDIA',
      weight: clamp01(safeNum(metrics.media_keywords_score_0_1, 0.6)),
      reasons: ['media_keywords', 'profile_flag'],
    });
  }

  // NFT
  if (safeNum(metrics.nft_keywords_score_0_1) > 0.5 || metrics.is_nft === true) {
    labels.push({
      key: 'NFT',
      weight: clamp01(safeNum(metrics.nft_keywords_score_0_1, 0.6)),
      reasons: ['nft_keywords', 'profile_flag'],
    });
  }

  // TRENDING_TRADING
  if (safeNum(metrics.trading_keywords_score_0_1) > 0.5 || 
      safeNum(metrics.trending_velocity_0_1) >= t.trending_velocity ||
      metrics.is_trading === true) {
    labels.push({
      key: 'TRENDING_TRADING',
      weight: clamp01(Math.max(
        safeNum(metrics.trading_keywords_score_0_1),
        safeNum(metrics.trending_velocity_0_1)
      )),
      reasons: ['trading_keywords', 'trending_velocity'],
    });
  }

  // POPULAR_PROJECTS
  if (safeNum(metrics.followers_norm_0_1) >= t.popular_followers ||
      safeNum(metrics.popularity_mass_0_1) >= 0.7) {
    labels.push({
      key: 'POPULAR_PROJECTS',
      weight: clamp01(Math.max(
        safeNum(metrics.followers_norm_0_1),
        safeNum(metrics.popularity_mass_0_1)
      )),
      reasons: ['high_followers', 'high_visibility'],
    });
  }

  // MOST_SEARCHED
  if (safeNum(metrics.search_proxy_0_1) > 0.5) {
    labels.push({
      key: 'MOST_SEARCHED',
      weight: clamp01(safeNum(metrics.search_proxy_0_1)),
      reasons: ['search_proxy'],
    });
  }

  return labels.sort((a, b) => b.weight - a.weight);
}

/**
 * Upsert membership (skip if frozen)
 */
export async function upsertMembership(
  accountId: string,
  group: TaxonomyGroupKey,
  payload: { weight: number; reasons: string[]; evidence?: any }
): Promise<{ ok?: boolean; skipped?: boolean }> {
  const existing = await db.collection('connections_taxonomy_membership')
    .findOne({ accountId, group });
  
  if (existing?.isFrozen) {
    return { skipped: true };
  }

  await db.collection('connections_taxonomy_membership').updateOne(
    { accountId, group },
    {
      $set: {
        accountId,
        group,
        weight: payload.weight,
        reasons: payload.reasons,
        evidence: payload.evidence ?? {},
        source: 'RULE',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  
  return { ok: true };
}

/**
 * Batch recompute taxonomy for multiple accounts
 */
export async function recomputeTaxonomy(
  rows: { accountId: string; metrics: any }[]
): Promise<{ updated: number; skipped: number }> {
  const rules = await getRules();
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const labels = computeTaxonomyLabels(row.metrics, rules);
    
    for (const label of labels) {
      const result = await upsertMembership(row.accountId, label.key, {
        weight: label.weight,
        reasons: label.reasons,
      });
      
      if (result.ok) updated++;
      if (result.skipped) skipped++;
    }
  }

  return { updated, skipped };
}

/**
 * Get memberships for an account
 */
export async function getAccountMemberships(accountId: string): Promise<TaxonomyMembership[]> {
  return db.collection('connections_taxonomy_membership')
    .find({ accountId })
    .sort({ weight: -1 })
    .toArray() as Promise<TaxonomyMembership[]>;
}

/**
 * Get accounts by group
 */
export async function getAccountsByGroup(
  group: TaxonomyGroupKey,
  options: { limit?: number; minWeight?: number } = {}
): Promise<TaxonomyMembership[]> {
  const { limit = 100, minWeight = 0.2 } = options;
  
  return db.collection('connections_taxonomy_membership')
    .find({ group, weight: { $gte: minWeight } })
    .sort({ weight: -1 })
    .limit(limit)
    .toArray() as Promise<TaxonomyMembership[]>;
}
