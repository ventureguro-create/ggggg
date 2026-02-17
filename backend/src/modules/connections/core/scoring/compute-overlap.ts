/**
 * Compute Directional Overlap between two audiences
 * 
 * a_to_b: % of A's audience that also engages with B
 * b_to_a: % of B's audience that also engages with A
 * 
 * This reveals:
 * - If A is copying B's audience (high a_to_b, low b_to_a)
 * - If they share organic audience (both high)
 * - If they're independent (both low)
 */

export interface OverlapResult {
  a_to_b: number;     // 0-1, % of A's audience in B
  b_to_a: number;     // 0-1, % of B's audience in A
  shared: number;     // absolute count of shared users
  a_size: number;     // total unique engaged users for A
  b_size: number;     // total unique engaged users for B
  jaccard: number;    // Jaccard similarity index (intersection/union)
}

/**
 * Compute directional overlap between two sets of engaged user IDs
 */
export function computeDirectionalOverlap(a: string[], b: string[]): OverlapResult {
  const A = new Set(a || []);
  const B = new Set(b || []);
  
  // Handle empty sets
  if (A.size === 0 || B.size === 0) {
    return { 
      a_to_b: 0, 
      b_to_a: 0, 
      shared: 0, 
      a_size: A.size, 
      b_size: B.size,
      jaccard: 0,
    };
  }
  
  // Count shared users
  let shared = 0;
  for (const x of A) {
    if (B.has(x)) shared++;
  }
  
  // Directional percentages
  const a_to_b = shared / A.size;
  const b_to_a = shared / B.size;
  
  // Jaccard similarity: |A ∩ B| / |A ∪ B|
  const unionSize = A.size + B.size - shared;
  const jaccard = unionSize > 0 ? shared / unionSize : 0;
  
  return { 
    a_to_b: Math.round(a_to_b * 10000) / 10000,
    b_to_a: Math.round(b_to_a * 10000) / 10000,
    shared, 
    a_size: A.size, 
    b_size: B.size,
    jaccard: Math.round(jaccard * 10000) / 10000,
  };
}

/**
 * Interpret overlap results
 */
export function interpretOverlap(overlap: OverlapResult): {
  relationship: 'independent' | 'shared_audience' | 'a_copies_b' | 'b_copies_a' | 'symmetric';
  confidence: 'low' | 'medium' | 'high';
  description: string;
} {
  const { a_to_b, b_to_a, a_size, b_size } = overlap;
  
  // Low confidence if small sample size
  const minSize = Math.min(a_size, b_size);
  const confidence: 'low' | 'medium' | 'high' = 
    minSize < 100 ? 'low' : 
    minSize < 1000 ? 'medium' : 'high';
  
  // Interpret relationship
  if (a_to_b < 0.05 && b_to_a < 0.05) {
    return {
      relationship: 'independent',
      confidence,
      description: 'These accounts have largely independent audiences.',
    };
  }
  
  if (a_to_b > 0.3 && b_to_a > 0.3) {
    return {
      relationship: 'shared_audience',
      confidence,
      description: 'These accounts share significant audience overlap.',
    };
  }
  
  if (a_to_b > 0.3 && b_to_a < 0.1) {
    return {
      relationship: 'a_copies_b',
      confidence,
      description: 'A\'s audience heavily overlaps with B, but not vice versa. A may be targeting B\'s followers.',
    };
  }
  
  if (b_to_a > 0.3 && a_to_b < 0.1) {
    return {
      relationship: 'b_copies_a',
      confidence,
      description: 'B\'s audience heavily overlaps with A, but not vice versa. B may be targeting A\'s followers.',
    };
  }
  
  return {
    relationship: 'symmetric',
    confidence,
    description: 'Moderate symmetric overlap between audiences.',
  };
}
