/**
 * BLOCK 26 - Wallet Attribution Clustering
 * 
 * Groups wallets that likely belong to the same actor
 */

export interface WalletProfile {
  address: string;
  transactions: Array<{
    timestamp: Date;
    asset: string;
    direction: 'IN' | 'OUT';
    amount: number;
  }>;
}

/**
 * Calculate wallet similarity score
 * 
 * wallet_similarity = 0.35 * temporal + 0.25 * asset + 0.25 * direction + 0.15 * amount
 */
export function computeWalletSimilarity(a: WalletProfile, b: WalletProfile): number {
  return (
    0.35 * temporalOverlap(a, b) +
    0.25 * assetOverlap(a, b) +
    0.25 * directionMatch(a, b) +
    0.15 * amountSimilarity(a, b)
  );
}

function temporalOverlap(a: WalletProfile, b: WalletProfile): number {
  if (!a.transactions.length || !b.transactions.length) return 0;
  
  const aTimes = a.transactions.map(t => t.timestamp.getTime());
  const bTimes = b.transactions.map(t => t.timestamp.getTime());
  
  // Check how many transactions happen within 1 hour of each other
  let overlaps = 0;
  const hourMs = 3600000;
  
  for (const at of aTimes) {
    for (const bt of bTimes) {
      if (Math.abs(at - bt) < hourMs) {
        overlaps++;
        break;
      }
    }
  }
  
  return Math.min(1, overlaps / Math.max(1, aTimes.length));
}

function assetOverlap(a: WalletProfile, b: WalletProfile): number {
  const aAssets = new Set(a.transactions.map(t => t.asset));
  const bAssets = new Set(b.transactions.map(t => t.asset));
  
  if (!aAssets.size || !bAssets.size) return 0;
  
  let shared = 0;
  for (const asset of aAssets) {
    if (bAssets.has(asset)) shared++;
  }
  
  const union = aAssets.size + bAssets.size - shared;
  return shared / Math.max(1, union);
}

function directionMatch(a: WalletProfile, b: WalletProfile): number {
  if (!a.transactions.length || !b.transactions.length) return 0;
  
  const aIn = a.transactions.filter(t => t.direction === 'IN').length / a.transactions.length;
  const bIn = b.transactions.filter(t => t.direction === 'IN').length / b.transactions.length;
  
  return 1 - Math.abs(aIn - bIn);
}

function amountSimilarity(a: WalletProfile, b: WalletProfile): number {
  const aAmounts = a.transactions.map(t => t.amount);
  const bAmounts = b.transactions.map(t => t.amount);
  
  if (!aAmounts.length || !bAmounts.length) return 0;
  
  const aAvg = aAmounts.reduce((s, x) => s + x, 0) / aAmounts.length;
  const bAvg = bAmounts.reduce((s, x) => s + x, 0) / bAmounts.length;
  
  if (aAvg === 0 && bAvg === 0) return 1;
  
  const maxAvg = Math.max(aAvg, bAvg);
  const diff = Math.abs(aAvg - bAvg) / maxAvg;
  
  return Math.max(0, 1 - diff);
}

export type ClusterConfidence = 'STRONG' | 'PROBABLE' | 'INDEPENDENT';

export function getClusterConfidence(similarity: number): ClusterConfidence {
  if (similarity >= 0.75) return 'STRONG';
  if (similarity >= 0.55) return 'PROBABLE';
  return 'INDEPENDENT';
}

/**
 * Build wallet clusters
 */
export function buildWalletClusters(wallets: WalletProfile[]): Array<{
  representative: WalletProfile;
  members: WalletProfile[];
  confidence: number;
}> {
  const clusters: Array<{
    representative: WalletProfile;
    members: WalletProfile[];
    confidence: number;
  }> = [];

  for (const w of wallets) {
    let placed = false;

    for (const c of clusters) {
      const sim = computeWalletSimilarity(w, c.representative);
      if (sim >= 0.75) {
        c.members.push(w);
        c.confidence = Math.min(c.confidence, sim);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({
        representative: w,
        members: [w],
        confidence: 1.0
      });
    }
  }

  return clusters;
}
