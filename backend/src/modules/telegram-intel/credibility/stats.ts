/**
 * Statistical utilities
 * Phase 3 Step 4: Credibility Engine
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

/**
 * Beta posterior mean for success probability
 * Using conjugate prior: Beta(a0, b0) with binomial likelihood
 */
export function betaPosterior(
  success: number,
  total: number,
  priorMean = 0.25,
  priorStrength = 12
): { a: number; b: number; mean: number } {
  const a = priorMean * priorStrength + success;
  const b = (1 - priorMean) * priorStrength + (total - success);
  const mean = a / (a + b);
  return { a, b, mean };
}

/**
 * Credible interval approximation (normal approx on beta)
 */
export function betaCI(
  a: number,
  b: number,
  z = 1.96
): { low: number; high: number } {
  const mean = a / (a + b);
  const varBeta = (a * b) / ((a + b) ** 2 * (a + b + 1));
  const sd = Math.sqrt(Math.max(1e-9, varBeta));
  const low = clamp01(mean - z * sd);
  const high = clamp01(mean + z * sd);
  return { low, high };
}
