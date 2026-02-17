/**
 * Similarity Engine
 * 
 * Calculates similarity between engagement vectors.
 * Supports multiple metrics: cosine, pearson, euclidean.
 */

import type { EngagementVector } from '../../adapters/twitter/readers/twitterCoEngagement.reader.js';

export type SimilarityMetric = 'cosine' | 'pearson' | 'euclidean';

export interface SimilarityResult {
  from_id: string;
  to_id: string;
  similarity: number;        // 0-1 (normalized)
  metric: SimilarityMetric;
  components: {
    like_rate_diff: number;
    repost_rate_diff: number;
    reply_rate_diff: number;
    engagement_rate_diff: number;
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Pearson correlation between two vectors
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const n = a.length;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  
  let num = 0;
  let denA = 0;
  let denB = 0;
  
  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    num += diffA * diffB;
    denA += diffA * diffA;
    denB += diffB * diffB;
  }
  
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

/**
 * Calculate Euclidean distance (normalized to 0-1 similarity)
 */
function euclideanSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    sumSq += (a[i] - b[i]) ** 2;
  }
  
  const distance = Math.sqrt(sumSq);
  // Normalize: smaller distance = higher similarity
  return 1 / (1 + distance);
}

/**
 * Convert engagement vector to numeric array
 */
function vectorToArray(v: EngagementVector): number[] {
  return [
    v.like_rate,
    v.repost_rate,
    v.reply_rate,
    v.engagement_rate,
  ];
}

/**
 * Calculate similarity between two engagement vectors
 */
export function calculateSimilarity(
  a: EngagementVector,
  b: EngagementVector,
  metric: SimilarityMetric = 'cosine'
): SimilarityResult {
  const arrA = vectorToArray(a);
  const arrB = vectorToArray(b);
  
  let similarity: number;
  
  switch (metric) {
    case 'cosine':
      similarity = cosineSimilarity(arrA, arrB);
      break;
    case 'pearson':
      similarity = (pearsonCorrelation(arrA, arrB) + 1) / 2; // Normalize to 0-1
      break;
    case 'euclidean':
      similarity = euclideanSimilarity(arrA, arrB);
      break;
    default:
      similarity = cosineSimilarity(arrA, arrB);
  }
  
  return {
    from_id: a.author_id,
    to_id: b.author_id,
    similarity: Math.max(0, Math.min(1, similarity)),
    metric,
    components: {
      like_rate_diff: Math.abs(a.like_rate - b.like_rate),
      repost_rate_diff: Math.abs(a.repost_rate - b.repost_rate),
      reply_rate_diff: Math.abs(a.reply_rate - b.reply_rate),
      engagement_rate_diff: Math.abs(a.engagement_rate - b.engagement_rate),
    },
  };
}

/**
 * Calculate all pairwise similarities
 */
export function calculateAllSimilarities(
  vectors: EngagementVector[],
  metric: SimilarityMetric = 'cosine',
  minThreshold: number = 0.3
): SimilarityResult[] {
  const results: SimilarityResult[] = [];
  
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = calculateSimilarity(vectors[i], vectors[j], metric);
      if (sim.similarity >= minThreshold) {
        results.push(sim);
      }
    }
  }
  
  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  
  return results;
}
