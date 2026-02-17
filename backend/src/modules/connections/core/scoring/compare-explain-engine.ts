/**
 * Compare Explain Engine v0
 * 
 * Explains WHY A > B (or vice versa) by decomposing score deltas
 * into metric contributions.
 * 
 * No Twitter dependency. Pure math over ConnectionsScoreResult.
 */

export type MetricDelta = {
  metric:
    | 'real_views'
    | 'reach_efficiency'
    | 'engagement_quality'
    | 'posting_consistency'
    | 'engagement_stability'
    | 'authority'
    | 'penalty';
  a: number;
  b: number;
  delta: number;        // a - b (signed)
  contribution: number; // contribution to score delta (signed)
  weight: number;
};

export type CompareExplainResult = {
  winner: 'A' | 'B' | 'TIE';
  score_type: 'influence' | 'x';
  score_a: number;
  score_b: number;
  delta: number;

  profile: {
    a: string;
    b: string;
  };

  drivers: {
    positive: MetricDelta[]; // pushing A above B
    negative: MetricDelta[]; // pushing A below B
  };

  summary: string;
  bullets: string[];
};

function round(x: number, d = 4) {
  const p = 10 ** d;
  return Math.round(x * p) / p;
}

function topK<T>(arr: T[], k: number): T[] {
  return arr.slice(0, Math.max(0, k));
}

export function explainCompare(params: {
  scoreType: 'influence' | 'x';
  A: {
    score: number;
    profileType: string;
    components: {
      rve_score?: number;
      re_score?: number;
      eq_score: number;
      pc_score: number;
      es_score: number;
      authority_stub?: number;
      penalty_influence?: number;
      penalty_x?: number;
    };
  };
  B: {
    score: number;
    profileType: string;
    components: {
      rve_score?: number;
      re_score?: number;
      eq_score: number;
      pc_score: number;
      es_score: number;
      authority_stub?: number;
      penalty_influence?: number;
      penalty_x?: number;
    };
  };
  weights: {
    influence?: {
      rve: number;
      re: number;
      eq: number;
      authority: number;
    };
    x?: {
      pc: number;
      es: number;
      eq: number;
    };
  };
}): CompareExplainResult {
  const { scoreType, A, B } = params;

  const scoreA = A.score;
  const scoreB = B.score;
  const delta = scoreA - scoreB;

  const winner: 'A' | 'B' | 'TIE' =
    Math.abs(delta) < 5 ? 'TIE' : delta > 0 ? 'A' : 'B';

  const deltas: MetricDelta[] = [];

  if (scoreType === 'influence') {
    const w = params.weights.influence!;

    deltas.push({
      metric: 'real_views',
      a: A.components.rve_score ?? 0,
      b: B.components.rve_score ?? 0,
      delta: round((A.components.rve_score ?? 0) - (B.components.rve_score ?? 0)),
      weight: w.rve,
      contribution: round(w.rve * ((A.components.rve_score ?? 0) - (B.components.rve_score ?? 0))),
    });

    deltas.push({
      metric: 'reach_efficiency',
      a: A.components.re_score ?? 0,
      b: B.components.re_score ?? 0,
      delta: round((A.components.re_score ?? 0) - (B.components.re_score ?? 0)),
      weight: w.re,
      contribution: round(w.re * ((A.components.re_score ?? 0) - (B.components.re_score ?? 0))),
    });

    deltas.push({
      metric: 'engagement_quality',
      a: A.components.eq_score,
      b: B.components.eq_score,
      delta: round(A.components.eq_score - B.components.eq_score),
      weight: w.eq,
      contribution: round(w.eq * (A.components.eq_score - B.components.eq_score)),
    });

    deltas.push({
      metric: 'authority',
      a: A.components.authority_stub ?? 0,
      b: B.components.authority_stub ?? 0,
      delta: round((A.components.authority_stub ?? 0) - (B.components.authority_stub ?? 0)),
      weight: w.authority,
      contribution: round(w.authority * ((A.components.authority_stub ?? 0) - (B.components.authority_stub ?? 0))),
    });

    deltas.push({
      metric: 'penalty',
      a: A.components.penalty_influence ?? 0,
      b: B.components.penalty_influence ?? 0,
      delta: round((A.components.penalty_influence ?? 0) - (B.components.penalty_influence ?? 0)),
      weight: -1,
      contribution: round(-((A.components.penalty_influence ?? 0) - (B.components.penalty_influence ?? 0))),
    });
  } else {
    const w = params.weights.x!;

    deltas.push({
      metric: 'posting_consistency',
      a: A.components.pc_score,
      b: B.components.pc_score,
      delta: round(A.components.pc_score - B.components.pc_score),
      weight: w.pc,
      contribution: round(w.pc * (A.components.pc_score - B.components.pc_score)),
    });

    deltas.push({
      metric: 'engagement_stability',
      a: A.components.es_score,
      b: B.components.es_score,
      delta: round(A.components.es_score - B.components.es_score),
      weight: w.es,
      contribution: round(w.es * (A.components.es_score - B.components.es_score)),
    });

    deltas.push({
      metric: 'engagement_quality',
      a: A.components.eq_score,
      b: B.components.eq_score,
      delta: round(A.components.eq_score - B.components.eq_score),
      weight: w.eq,
      contribution: round(w.eq * (A.components.eq_score - B.components.eq_score)),
    });

    deltas.push({
      metric: 'penalty',
      a: A.components.penalty_x ?? 0,
      b: B.components.penalty_x ?? 0,
      delta: round((A.components.penalty_x ?? 0) - (B.components.penalty_x ?? 0)),
      weight: -1,
      contribution: round(-((A.components.penalty_x ?? 0) - (B.components.penalty_x ?? 0))),
    });
  }

  // Sort by absolute contribution
  const sorted = [...deltas].sort(
    (x, y) => Math.abs(y.contribution) - Math.abs(x.contribution)
  );

  const positive = sorted.filter(d => d.contribution > 0);
  const negative = sorted.filter(d => d.contribution < 0);

  // Human summary
  const bullets: string[] = [];

  if (winner === 'TIE') {
    bullets.push('Аккаунты близки по ключевым метрикам — явного лидера нет.');
  } else {
    const winnerLabel = winner === 'A' ? 'A' : 'B';
    const drivers = winner === 'A' ? positive : negative;
    bullets.push(`${winnerLabel} опережает за счёт:`);
    
    topK(drivers, 3).forEach(d => {
      const points = Math.round(Math.abs(d.contribution) * 1000);
      bullets.push(`• ${d.metric}: +${points} пунктов`);
    });
  }

  const summary =
    winner === 'TIE'
      ? 'Сравнение не выявило устойчивого превосходства.'
      : `${winner} лидирует на ${Math.abs(Math.round(delta))} пунктов.`;

  return {
    winner,
    score_type: scoreType,
    score_a: scoreA,
    score_b: scoreB,
    delta: Math.round(delta),
    profile: {
      a: A.profileType,
      b: B.profileType,
    },
    drivers: {
      positive,
      negative,
    },
    summary,
    bullets,
  };
}
