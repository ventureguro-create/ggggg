/**
 * Explain Service - Why This Matters
 * Generates human-readable explanations for entity importance
 */

import { Db } from 'mongodb';
import { NETWORK_V2_CONFIG } from '../networkv2/network.config.js';

export interface ExplainResult {
  summary: string;
  keyPoints: string[];
  risk: string[];
  scores: {
    authority: number;
    network: number;
    early: number;
    media: number;
  };
}

export async function explainEntity(
  db: Db,
  entityId: string,
  preset?: string
): Promise<ExplainResult> {
  // Get entity from unified accounts
  const entity = await db.collection('connections_unified_accounts').findOne({
    $or: [{ id: entityId }, { slug: entityId }]
  });

  if (!entity) {
    return {
      summary: 'Entity not found',
      keyPoints: [],
      risk: ['Unable to analyze - entity not in database'],
      scores: { authority: 0, network: 0, early: 0, media: 0 }
    };
  }

  const keyPoints: string[] = [];
  const risk: string[] = [];

  // Authority analysis
  const authority = entity.authority ?? entity.seedAuthority ?? 0;
  const network = entity.networkScore ?? entity.influence ?? 0;
  const early = entity.early ?? entity.earlyScore ?? 0;
  const media = entity.mediaScore ?? 0;

  // Generate key points based on scores
  if (authority >= 0.7) {
    keyPoints.push(`High authority score (${Math.round(authority * 100)}%) - trusted source`);
  }

  if (entity.kind === 'BACKER') {
    keyPoints.push('Verified backer/fund with seed authority');
    const edges = await db.collection('backer_coinvest_edges').countDocuments({
      $or: [{ source: `backer:${entity.slug || entityId}` }, { target: `backer:${entity.slug || entityId}` }]
    });
    if (edges > 0) {
      keyPoints.push(`Connected to ${edges} other funds via co-investments`);
    }
  }

  if (early >= 0.6) {
    keyPoints.push(`Strong early signal score (${Math.round(early * 100)}%) - potential breakout`);
  }

  if (network >= 0.6) {
    keyPoints.push(`High network influence (${Math.round(network * 100)}%)`);
  }

  if (entity.smart >= 0.7) {
    keyPoints.push('Identified as smart account with quality audience');
  }

  if (entity.categories?.includes('VC')) {
    keyPoints.push('Categorized as VC/Fund');
  }

  // Generate risks
  if (authority < 0.4) {
    risk.push('Low authority - limited trust signals');
  }

  if (entity.engagement < 0.05) {
    risk.push('Low engagement rate - limited reach');
  }

  if (entity.confidence < 0.6) {
    risk.push('Low data confidence - results may be incomplete');
  }

  if (entity.botRisk > 0.3) {
    risk.push('Elevated bot risk detected');
  }

  // Generate summary
  let summary = '';
  if (entity.kind === 'BACKER') {
    summary = `${entity.title || entity.name} is a ${authority >= 0.7 ? 'high-authority' : 'notable'} backer/fund with ${keyPoints.length} trust indicators.`;
  } else if (preset === 'SMART' || entity.smart >= 0.6) {
    summary = `This account shows smart money characteristics - early engagement patterns and anchor connections.`;
  } else if (preset === 'EARLY' || early >= 0.6) {
    summary = `Emerging account with strong early signal indicators - worth watching.`;
  } else {
    summary = `${entity.title || 'This account'} has ${keyPoints.length} notable characteristics in the network.`;
  }

  return {
    summary,
    keyPoints: keyPoints.slice(0, 5),
    risk: risk.slice(0, 3),
    scores: {
      authority: Math.round(authority * 100) / 100,
      network: Math.round(network * 100) / 100,
      early: Math.round(early * 100) / 100,
      media: Math.round(media * 100) / 100
    }
  };
}
