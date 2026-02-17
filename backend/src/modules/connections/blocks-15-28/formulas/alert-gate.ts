/**
 * BLOCK 24 - Alert Authenticity Gate
 * 
 * Final shield before user - decides if alert should be sent
 */

export type AlertDecision = 'SEND' | 'SEND_LOW_PRIORITY' | 'BLOCKED';

export interface AlertGateInput {
  alertId: string;
  confidence: number;
  priority?: string;
  flags?: string[];
}

export interface AlertGateOutput extends AlertGateInput {
  blocked: boolean;
  reason?: string;
  decision: AlertDecision;
}

/**
 * Apply authenticity gate to an alert
 * 
 * Logic:
 * - authenticity < 0.35: BLOCKED
 * - bms > 60: confidence *= 0.6, flag MANIPULATION
 * - authenticity < 0.55: confidence *= 0.75, LOW priority
 * - else: SEND
 */
export function applyAuthenticityGate(
  alert: AlertGateInput,
  metrics: { authenticity: number; bms: number }
): AlertGateOutput {
  const result: AlertGateOutput = {
    ...alert,
    flags: [...(alert.flags || [])],
    blocked: false,
    decision: 'SEND'
  };

  const { authenticity, bms } = metrics;

  // Block low authenticity
  if (authenticity < 0.35) {
    result.blocked = true;
    result.reason = 'LOW_AUTHENTICITY';
    result.decision = 'BLOCKED';
    return result;
  }

  // Penalize high BMS
  if (bms > 60) {
    result.confidence *= 0.6;
    result.flags!.push('MANIPULATION_SUSPECTED');
  }

  // Lower priority for questionable sources
  if (authenticity < 0.55) {
    result.confidence *= 0.75;
    result.priority = 'LOW';
    result.decision = 'SEND_LOW_PRIORITY';
    return result;
  }

  return result;
}
