/**
 * Connections Sensitivity Analysis
 * 
 * Answers: "If metric X changes by Y%, how does the score change?"
 * 
 * Critical for:
 * - Understanding what really drives scores
 * - Debugging formula issues
 * - Product explanations
 * - A/B testing impact
 */

import { computeConnectionsScore, ConnectionsInput, ConnectionsScoreResult } from './connections-engine.js';

export interface SensitivityPoint {
  metric: string;
  delta: number;           // % change (-0.3 = -30%)
  influence_delta: number; // absolute change in influence_score
  x_delta: number;         // absolute change in x_score
  influence_pct: number;   // % change in influence_score
  x_pct: number;           // % change in x_score
}

export interface SensitivityResult {
  base_scores: {
    influence_score: number;
    x_score: number;
  };
  points: SensitivityPoint[];
  most_sensitive: {
    for_influence: string;
    for_x: string;
  };
  summary: string[];
}

/**
 * Compute sensitivity analysis for an input
 */
export function computeSensitivity(
  baseInput: ConnectionsInput,
  deltas: number[] = [-0.3, -0.1, 0.1, 0.3]
): SensitivityResult {
  // Compute base scores
  const base = computeConnectionsScore(baseInput);
  
  const metrics = [
    'followers_now',
    'likes',
    'reposts', 
    'replies',
    'views',
  ];

  const points: SensitivityPoint[] = [];
  const maxDeltas: Record<string, { influence: number; x: number }> = {};

  for (const metric of metrics) {
    maxDeltas[metric] = { influence: 0, x: 0 };
    
    for (const d of deltas) {
      // Deep clone input
      const mutated = JSON.parse(JSON.stringify(baseInput)) as ConnectionsInput;

      // Apply mutation
      if (metric === 'followers_now') {
        mutated.followers_now = Math.max(0, mutated.followers_now * (1 + d));
      } else {
        // Mutate all posts
        for (const p of mutated.posts) {
          const key = metric as keyof typeof p;
          if (key in p && typeof p[key] === 'number') {
            (p as any)[key] = Math.max(0, (p[key] as number) * (1 + d));
          }
        }
      }

      // Compute new scores
      const next = computeConnectionsScore(mutated);

      const influenceDelta = next.influence_score - base.influence_score;
      const xDelta = next.x_score - base.x_score;
      
      const influencePct = base.influence_score > 0 
        ? (influenceDelta / base.influence_score) * 100 
        : 0;
      const xPct = base.x_score > 0 
        ? (xDelta / base.x_score) * 100 
        : 0;

      points.push({
        metric,
        delta: d,
        influence_delta: Math.round(influenceDelta * 10) / 10,
        x_delta: Math.round(xDelta * 10) / 10,
        influence_pct: Math.round(influencePct * 10) / 10,
        x_pct: Math.round(xPct * 10) / 10,
      });

      // Track max absolute deltas
      if (Math.abs(influenceDelta) > Math.abs(maxDeltas[metric].influence)) {
        maxDeltas[metric].influence = influenceDelta;
      }
      if (Math.abs(xDelta) > Math.abs(maxDeltas[metric].x)) {
        maxDeltas[metric].x = xDelta;
      }
    }
  }

  // Find most sensitive metrics
  let mostSensitiveInfluence = metrics[0];
  let mostSensitiveX = metrics[0];
  let maxInfluenceImpact = 0;
  let maxXImpact = 0;

  for (const metric of metrics) {
    if (Math.abs(maxDeltas[metric].influence) > maxInfluenceImpact) {
      maxInfluenceImpact = Math.abs(maxDeltas[metric].influence);
      mostSensitiveInfluence = metric;
    }
    if (Math.abs(maxDeltas[metric].x) > maxXImpact) {
      maxXImpact = Math.abs(maxDeltas[metric].x);
      mostSensitiveX = metric;
    }
  }

  // Generate summary
  const summary: string[] = [];
  
  if (mostSensitiveInfluence === mostSensitiveX) {
    summary.push(`Both scores are most sensitive to ${mostSensitiveInfluence}.`);
  } else {
    summary.push(`Influence is most sensitive to ${mostSensitiveInfluence}.`);
    summary.push(`X Score is most sensitive to ${mostSensitiveX}.`);
  }

  // Check for low sensitivity (potential issue)
  if (maxInfluenceImpact < 10) {
    summary.push('Warning: Low sensitivity detected. Scores may not differentiate well.');
  }

  return {
    base_scores: {
      influence_score: base.influence_score,
      x_score: base.x_score,
    },
    points,
    most_sensitive: {
      for_influence: mostSensitiveInfluence,
      for_x: mostSensitiveX,
    },
    summary,
  };
}

/**
 * Quick sensitivity check - just returns most impactful metrics
 */
export function quickSensitivityCheck(baseInput: ConnectionsInput): {
  influence_driver: string;
  x_driver: string;
} {
  const result = computeSensitivity(baseInput, [0.3]); // Just +30%
  return {
    influence_driver: result.most_sensitive.for_influence,
    x_driver: result.most_sensitive.for_x,
  };
}
