/**
 * BLOCK 25 - Wallet-Bot Correlation
 * 
 * Links Twitter manipulation with on-chain money movement
 */

export type CorrelationLabel = 'CAPITAL_BACKED' | 'POSSIBLE' | 'SOCIAL_NOISE';

/**
 * Correlate bot activity with on-chain flow
 * 
 * Time windows:
 * - T-2h → T+2h: strong correlation (1.0)
 * - T-6h → T+6h: acceptable (0.7)
 * - >6h: weak/noise (0.3)
 */
export function correlateBotAndOnchain(
  bms: number,
  onchain: { intensity: number },
  timeDeltaHours: number
): { correlation: number; label: CorrelationLabel } {
  // Time factor
  let timeFactor = 0.3;
  if (timeDeltaHours <= 2) timeFactor = 1.0;
  else if (timeDeltaHours <= 6) timeFactor = 0.7;

  // On-chain factor (normalized)
  const onchainFactor = Math.min(1, onchain.intensity / 100);
  
  // BMS factor (normalized)
  const bmsFactor = Math.min(1, bms / 100);

  const correlation = timeFactor * onchainFactor * bmsFactor;

  // Label interpretation
  let label: CorrelationLabel;
  if (correlation >= 0.7) label = 'CAPITAL_BACKED';
  else if (correlation >= 0.4) label = 'POSSIBLE';
  else label = 'SOCIAL_NOISE';

  return { correlation, label };
}
