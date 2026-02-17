/**
 * Telegram Alert Delivery (Phase 4.5 + 4.6 + 5.A)
 * 
 * Telegram is DELIVERY ONLY - no logic in bot.
 * Uses existing platform telegram.service.
 * Phase 4.6: Added pilot prefix support.
 * Phase 5.A: Added ML explainability (AQM + Patterns).
 */

// Port-based access: use port-access helper instead of direct host import
import { sendTelegramMessage } from '../../ports/port-access.js';
import type { AlertPayload, AlertType } from './alert-policy.engine.js';

// ============================================================
// MESSAGE TEMPLATES
// ============================================================

const ALERT_EMOJI: Record<AlertType, string> = {
  EARLY_BREAKOUT: '🚀',
  STRONG_ACCELERATION: '⚡',
  TREND_REVERSAL: '🔁',
};

const ALERT_TITLE: Record<AlertType, string> = {
  EARLY_BREAKOUT: 'Early Breakout Detected',
  STRONG_ACCELERATION: 'Strong Acceleration',
  TREND_REVERSAL: 'Trend Reversal',
};

const AQM_LABEL_EMOJI: Record<string, string> = {
  HIGH: '🟢',
  MEDIUM: '🟡',
  LOW: '🟠',
  NOISE: '🔴',
};

/**
 * Format alert for Telegram with ML explainability
 * @param payload Alert payload
 * @param pilotPrefix Optional pilot prefix (e.g., "[PILOT]")
 */
export function formatAlertMessage(payload: AlertPayload, pilotPrefix?: string): string {
  const emoji = ALERT_EMOJI[payload.type];
  const title = ALERT_TITLE[payload.type];
  const prefix = pilotPrefix ? `${pilotPrefix} ` : '';
  
  // Priority indicator
  const priority = payload.ml?.priority === 'LOW' ? '⚠️ LOW PRIORITY' : '';
  const priorityLine = priority ? `\n<b>${priority}</b>\n` : '';
  
  // Confidence label
  const confLabel = payload.confidence.level === 'HIGH' ? '✅ HIGH' :
                    payload.confidence.level === 'MEDIUM' ? '⚠️ MEDIUM' : '❓ LOW';
  
  // Build reasons list
  const reasonsList = payload.reasons
    .slice(0, 5)
    .map(r => `• ${r}`)
    .join('\n');
  
  // Delta direction
  const deltaSign = payload.score.delta_pct >= 0 ? '+' : '';
  
  // ML Section (Phase 5.A)
  let mlSection = '';
  if (payload.ml) {
    const aqm = payload.ml.aqm;
    const patterns = payload.ml.patterns;
    
    const aqmEmoji = AQM_LABEL_EMOJI[aqm.label] || '⚪';
    
    // Why section from AQM
    const whyPositive = aqm.explain.top_positive_factors
      .slice(0, 3)
      .map(f => `✓ ${f}`)
      .join('\n');
    const whyNegative = aqm.explain.top_negative_factors
      .slice(0, 2)
      .map(f => `✗ ${f}`)
      .join('\n');
    
    // Patterns section
    let patternsLine = '✅ OK — no manipulation signals';
    if (patterns.flags.length > 0) {
      const flagsStr = patterns.flags.join(', ');
      const severityEmoji = patterns.severity === 'HIGH' ? '🚨' : patterns.severity === 'MEDIUM' ? '⚠️' : '✅';
      patternsLine = `${severityEmoji} ${patterns.severity}: ${flagsStr}`;
    }
    
    mlSection = `
<b>🧠 Quality: ${aqmEmoji} ${aqm.label}</b> (${(aqm.probability * 100).toFixed(0)}%)

<b>Why:</b>
${whyPositive || '• Strong early signal'}
${whyNegative ? `\n${whyNegative}` : ''}

<b>Risks:</b>
${patternsLine}
${patterns.explain.length > 0 ? patterns.explain.map(e => `• ${e}`).join('\n') : ''}`;
  }
  
  // Format message (HTML)
  const message = `
${prefix}${emoji} <b>${title}</b>${priorityLine}

<b>${payload.account.handle}</b>
Score: ${payload.score.from} → ${payload.score.to} (${deltaSign}${payload.score.delta_pct}%)
Confidence: ${confLabel} (${payload.confidence.score}%)
${mlSection}

<b>Network:</b>
• ${payload.network.hops_to_elite} hops to elite nodes
• Authority: ${payload.network.authority_tier}

${payload.graph_link ? `<a href="${payload.graph_link}">📊 Open Graph →</a>` : ''}

<i>Alert ID: ${payload.alert_id?.slice(0, 8) || 'N/A'}</i>
`.trim();
  
  return message;
}

/**
 * Send alert to Telegram
 * @param pilotPrefix Optional prefix for pilot mode alerts
 */
export async function sendAlertToTelegram(
  chatId: string,
  payload: AlertPayload,
  pilotPrefix?: string
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  if (!chatId) {
    return { ok: false, error: 'No chat_id configured' };
  }
  
  try {
    const message = formatAlertMessage(payload, pilotPrefix);
    const result = await sendTelegramMessage(chatId, message, { parseMode: 'HTML' });
    
    if (result.ok) {
      console.log(`[TelegramAlert] Sent ${pilotPrefix || ''}${payload.type} alert for ${payload.account.handle}`);
      return { ok: true, messageId: result.messageId };
    } else {
      console.error('[TelegramAlert] Failed to send:', result.error);
      return { ok: false, error: result.error };
    }
  } catch (err: any) {
    console.error('[TelegramAlert] Error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Format test alert message
 */
export function formatTestAlertMessage(): string {
  return `
🧪 <b>Test Alert (Dry Run)</b>

This is a test message from Connections Alert System.

If you see this, Telegram delivery is working correctly.

<i>Timestamp: ${new Date().toISOString()}</i>
`.trim();
}

/**
 * Send test alert
 */
export async function sendTestAlert(
  chatId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!chatId) {
    return { ok: false, error: 'No chat_id configured' };
  }
  
  try {
    const message = formatTestAlertMessage();
    const result = await sendTelegramMessage(chatId, message, { parseMode: 'HTML' });
    
    if (result.ok) {
      console.log('[TelegramAlert] Test alert sent successfully');
      return { ok: true };
    } else {
      return { ok: false, error: result.error };
    }
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
