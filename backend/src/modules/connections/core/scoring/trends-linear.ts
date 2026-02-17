/**
 * Linear Regression for Trends
 * 
 * Pure math: slope calculation for velocity measurement.
 * No Twitter, no DB, no side effects.
 */

/**
 * Calculate slope of linear regression (y = ax + b)
 * Returns 'a' - the rate of change
 */
export function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0

  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  
  return den === 0 ? 0 : num / den
}

/**
 * Calculate R² (coefficient of determination)
 * Measures how well the linear model fits the data
 * Returns 0..1 (1 = perfect fit)
 */
export function linearRegressionR2(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0

  const meanY = ys.reduce((a, b) => a + b, 0) / n
  const slope = linearRegressionSlope(xs, ys)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const intercept = meanY - slope * meanX

  let ssRes = 0 // Residual sum of squares
  let ssTot = 0 // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept
    ssRes += (ys[i] - predicted) ** 2
    ssTot += (ys[i] - meanY) ** 2
  }

  return ssTot === 0 ? 0 : 1 - ssRes / ssTot
}

/**
 * Compute velocity (rate of change) from time series
 * 
 * @param points Array of {ts: timestamp_ms, value: score}
 * @returns velocity in points/day
 */
export function computeVelocity(points: { ts: number; value: number }[]): number {
  if (points.length < 2) return 0

  const t0 = points[0].ts
  const xs = points.map(p => (p.ts - t0) / 86400000) // convert to days
  const ys = points.map(p => p.value)

  return linearRegressionSlope(xs, ys)
}

/**
 * Compute velocity with R² confidence
 */
export function computeVelocityWithConfidence(
  points: { ts: number; value: number }[]
): { velocity: number; r2: number } {
  if (points.length < 2) {
    return { velocity: 0, r2: 0 }
  }

  const t0 = points[0].ts
  const xs = points.map(p => (p.ts - t0) / 86400000)
  const ys = points.map(p => p.value)

  return {
    velocity: linearRegressionSlope(xs, ys),
    r2: linearRegressionR2(xs, ys),
  }
}
