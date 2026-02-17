/**
 * Similarity Functions - Network v2
 * 
 * Cosine and Pearson similarity for co-engagement vectors
 */

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  
  return dotProduct / denom;
}

/**
 * Pearson correlation coefficient
 */
export function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  const n = a.length;
  
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  
  const meanA = sumA / n;
  const meanB = sumB / n;
  
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  
  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    num += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }
  
  const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
  if (denom === 0) return 0;
  
  return num / denom;
}

/**
 * Calculate similarity between two interaction maps
 * Converts maps to aligned vectors and computes similarity
 */
export function mapSimilarity(
  mapA: Map<string, number>,
  mapB: Map<string, number>,
  method: 'cosine' | 'pearson' = 'cosine'
): { similarity: number; shared_keys: string[] } {
  // Get all unique keys
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  
  if (allKeys.size === 0) {
    return { similarity: 0, shared_keys: [] };
  }
  
  // Build aligned vectors
  const keysArray = Array.from(allKeys);
  const vecA: number[] = [];
  const vecB: number[] = [];
  const sharedKeys: string[] = [];
  
  for (const key of keysArray) {
    const valA = mapA.get(key) || 0;
    const valB = mapB.get(key) || 0;
    vecA.push(valA);
    vecB.push(valB);
    
    if (valA > 0 && valB > 0) {
      sharedKeys.push(key);
    }
  }
  
  const similarity = method === 'cosine' 
    ? cosineSimilarity(vecA, vecB)
    : pearsonCorrelation(vecA, vecB);
  
  return { similarity: Math.max(0, similarity), shared_keys: sharedKeys };
}

/**
 * Calculate temporal synchronization between two activity patterns
 */
export function temporalSync(
  hourlyA: number[],
  hourlyB: number[],
  dailyA: number[],
  dailyB: number[]
): number {
  const hourlySim = cosineSimilarity(hourlyA, hourlyB);
  const dailySim = cosineSimilarity(dailyA, dailyB);
  
  // Weight daily more (0.6) vs hourly (0.4)
  return hourlySim * 0.4 + dailySim * 0.6;
}

console.log('[CoEngagement] Similarity module loaded');
