/**
 * Telegram Alert Formatter
 * 
 * Formats alerts for Telegram delivery.
 * Pilot alerts have special format with safety labels.
 */

import type { AlertCandidate, PolicyDecision } from '../alerts/alert-policy.engine.js';

export interface FormattedAlert {
  text: string;
  parse_mode: 'HTML' | 'Markdown';
  disable_notification?: boolean;
}

/**
 * Format pilot alert (Twitter source)
 */
export function formatPilotAlert(
  candidate: AlertCandidate,
  decision: PolicyDecision
): FormattedAlert | null {
  // Suppressed alerts not formatted
  if (decision.decision !== 'SEND') {
    return null;
  }

  const confidencePercent = (candidate.confidence * 100).toFixed(0);
  const aqmVerdict = candidate.context.aqm_level || 'N/A';
  const ml2Score = candidate.context.ml2_score 
    ? (candidate.context.ml2_score * 100).toFixed(0) + '%'
    : 'N/A';

  const text = `
🧪 <b>PILOT ALERT</b>

<b>Signal:</b> ${candidate.signal_type}
<b>Account:</b> ${candidate.account_id}
<b>Source:</b> Twitter (${candidate.source})

<b>Confidence:</b> ${confidencePercent}%
<b>AQM:</b> ${aqmVerdict}
<b>ML2 Shadow:</b> ${ml2Score}

${candidate.context.pattern ? `<b>Pattern:</b> ${candidate.context.pattern}` : ''}
${candidate.context.diff_delta ? `<b>Delta:</b> ${(candidate.context.diff_delta * 100).toFixed(1)}%` : ''}

<i>⚠️ This is a pilot alert. No action required.</i>
<i>Review only. Feedback welcome.</i>
`.trim();

  return {
    text,
    parse_mode: 'HTML',
    disable_notification: true, // Silent for pilot
  };
}

/**
 * Format core alert (non-Twitter)
 */
export function formatCoreAlert(
  candidate: AlertCandidate,
  decision: PolicyDecision
): FormattedAlert | null {
  if (decision.decision !== 'SEND') {
    return null;
  }

  const confidencePercent = (candidate.confidence * 100).toFixed(0);

  const text = `
🔔 <b>ALERT</b>

<b>Signal:</b> ${candidate.signal_type}
<b>Account:</b> ${candidate.account_id}
<b>Confidence:</b> ${confidencePercent}%

${candidate.context.pattern ? `<b>Pattern:</b> ${candidate.context.pattern}` : ''}
`.trim();

  return {
    text,
    parse_mode: 'HTML',
    disable_notification: false,
  };
}

/**
 * Format alert based on source
 */
export function formatAlert(
  candidate: AlertCandidate,
  decision: PolicyDecision
): FormattedAlert | null {
  if (candidate.source === 'twitter') {
    return formatPilotAlert(candidate, decision);
  }
  return formatCoreAlert(candidate, decision);
}

/**
 * Format suppression notice (for admin debugging)
 */
export function formatSuppressionNotice(
  candidate: AlertCandidate,
  decision: PolicyDecision
): string {
  return `Alert suppressed: ${candidate.signal_type} for ${candidate.account_id}. Reason: ${decision.reason || 'Unknown'}`;
}

/**
 * Format enriched pilot alert (T2.4)
 */
export function formatEnrichedPilotAlert(
  enrichedAlert: any, // EnrichedAlert
  decision: any // PolicyDecision
): FormattedAlert | null {
  if (decision.decision !== 'SEND') return null;

  const confidencePercent = (enrichedAlert.confidence * 100).toFixed(0);
  const networkScore = enrichedAlert.enrichment?.network_score 
    ? (enrichedAlert.enrichment.network_score * 100).toFixed(0) + '%'
    : 'N/A';
  
  // Build flags section
  const flagsText = (enrichedAlert.flags || [])
    .map((f: string) => {
      const explanations: Record<string, string> = {
        'NETWORK_SUPPORTED': '🔗 Network supported',
        'NETWORK_WEAK': '⚠️ Weak network',
        'ISOLATED_SPIKE': '🔺 Isolated spike',
        'SMART_CLUSTER_CONFIRMED': '🧠 Smart cluster',
        'BOT_CLUSTER_WARNING': '🤖 Bot cluster warning',
        'HIGH_CONFIDENCE': '✅ High confidence',
        'MEDIUM_CONFIDENCE': '🟡 Medium confidence',
        'FRESH_DATA': '🆕 Fresh data',
        'STALE_DATA': '⏳ Stale data',
      };
      return explanations[f] || f;
    })
    .join('\n');

  const text = `
🧪 <b>PILOT ALERT (T2.4)</b>

<b>Signal:</b> ${enrichedAlert.signal_type}
<b>Account:</b> ${enrichedAlert.account_id}
<b>Source:</b> Twitter

<b>Confidence:</b> ${confidencePercent}%
<b>Network Score:</b> ${networkScore}
<b>Cluster:</b> ${enrichedAlert.enrichment?.cluster_type || 'unknown'}

<b>Flags:</b>
${flagsText || 'None'}

<i>⚠️ Pilot alert - review only</i>
`.trim();

  return {
    text,
    parse_mode: 'HTML',
    disable_notification: true,
  };
}
