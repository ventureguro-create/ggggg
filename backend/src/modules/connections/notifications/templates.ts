/**
 * Connections Telegram Notifications - Message Templates
 * Phase 2.3: Telegram Alerts Delivery
 * Phase 5.A: ML-enhanced templates with AQM + Patterns explanation
 * 
 * Messaging Specification v2.0
 */

import type { ConnectionsAlertEvent, ConnectionsAlertType } from './types.js';

// ============================================================
// FORMATTERS
// ============================================================

function fmtInt(n?: number): string {
  if (n === undefined || n === null) return '—';
  return Math.round(n).toString();
}

function fmtPct(n?: number): string {
  if (n === undefined || n === null) return '—';
  const v = Math.round(n);
  return `${v > 0 ? '+' : ''}${v}%`;
}

function fmtProfile(p?: string): string {
  if (!p) return '—';
  if (p === 'retail') return 'Retail';
  if (p === 'influencer') return 'Influencer';
  if (p === 'whale') return 'Whale';
  return p;
}

function fmtRisk(r?: string): string {
  if (!r) return '—';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function fmtTrend(t?: string): string {
  if (!t) return '—';
  return t.toUpperCase();
}

function fmtAQMLabel(label?: string): string {
  if (!label) return '';
  switch (label) {
    case 'HIGH': return '✅ HIGH CONFIDENCE';
    case 'MEDIUM': return '🟡 MEDIUM CONFIDENCE';
    case 'LOW': return '🟠 LOW PRIORITY';
    case 'NOISE': return '⚠️ NOISE';
    default: return label;
  }
}

function fmtPatternFlags(flags?: string[]): string[] {
  if (!flags || flags.length === 0) return [];
  const mapping: Record<string, string> = {
    'LIKE_FARM': '⚠️ Like Farm detected',
    'SPIKE_PUMP': '⚠️ Spike/Pump detected',
    'OVERLAP_FARM': '⚠️ Audience overlap detected',
  };
  return flags.map(f => mapping[f] || f);
}

// ============================================================
// LINK BUILDERS
// ============================================================

export function buildConnectionsLink(baseUrl: string, accountId: string): string {
  const clean = baseUrl?.replace(/\/+$/, '') || '';
  return `${clean}/connections/${encodeURIComponent(accountId)}`;
}

export function buildRadarLink(baseUrl: string): string {
  const clean = baseUrl?.replace(/\/+$/, '') || '';
  return `${clean}/connections/radar`;
}

/**
 * P2.2.4: Build Graph link with state (highlight specific node)
 */
export function buildGraphLinkWithState(baseUrl: string, accountId: string): string {
  const clean = baseUrl?.replace(/\/+$/, '') || '';
  // Simple state: just highlight the account
  const state = {
    version: '1.0',
    highlight: accountId,
    view: 'graph',
  };
  const encoded = Buffer.from(JSON.stringify(state), 'utf-8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${clean}/connections/graph?state=${encoded}`;
}

// ============================================================
// MESSAGE TEMPLATES
// ============================================================

/**
 * Format ML section for alert message
 * Phase 5.A: AQM + Patterns explanation
 */
function formatMLSection(e: ConnectionsAlertEvent): string {
  const lines: string[] = [];
  
  // AQM section
  if (e.ml?.aqm) {
    const { label, probability, explain } = e.ml.aqm;
    lines.push('');
    lines.push('🧠 AI Verdict: ' + fmtAQMLabel(label));
    lines.push(`📊 Confidence: ${Math.round((probability || 0) * 100)}%`);
    
    // Add top factors if available
    if (explain?.top_positive_factors?.length) {
      lines.push('✓ ' + explain.top_positive_factors.slice(0, 2).join(', '));
    }
    if (explain?.top_negative_factors?.length) {
      lines.push('✗ ' + explain.top_negative_factors.slice(0, 2).join(', '));
    }
  }
  
  // Patterns section
  if (e.ml?.patterns) {
    const { flags, severity, risk_score } = e.ml.patterns;
    if (flags && flags.length > 0) {
      lines.push('');
      lines.push('🔍 Patterns Detected:');
      const patternLines = fmtPatternFlags(flags);
      patternLines.forEach(p => lines.push(p));
      lines.push(`Risk: ${severity} (${risk_score}%)`);
    } else {
      lines.push('');
      lines.push('🔍 Patterns: Clean ✓');
    }
  }
  
  // Priority indicator
  if (e.ml?.priority === 'LOW') {
    lines.push('');
    lines.push('📌 Priority: LOW (review at your convenience)');
  }
  
  return lines.join('\n');
}

/**
 * Format suppressed alert message (for audit/admin)
 * Phase 5.A: Explain why alert was NOT sent
 */
export function formatSuppressedMessage(baseUrl: string, e: ConnectionsAlertEvent): string {
  const username = e.username ? `@${e.username}` : e.account_id;
  
  const lines = [
    '🚫 SIGNAL SUPPRESSED',
    '',
    username,
    '',
    'Reason:',
  ];
  
  // Add AQM reason
  if (e.ml?.aqm) {
    const { label, probability, explain } = e.ml.aqm;
    if (label === 'NOISE' || label === 'LOW') {
      lines.push(`• Low AQM score (${Math.round((probability || 0) * 100)}%)`);
    }
    if (explain?.reason) {
      lines.push(`• ${explain.reason}`);
    }
  }
  
  // Add pattern reason
  if (e.ml?.patterns) {
    const { flags, severity } = e.ml.patterns;
    if (severity === 'HIGH') {
      lines.push(`• Pattern detected: ${flags?.join(', ')}`);
    }
  }
  
  // Add delivery reason
  if (e.delivery_reason) {
    lines.push(`• ${e.delivery_reason}`);
  }
  
  lines.push('');
  lines.push('Action: No alert sent');
  
  return lines.join('\n');
}

/**
 * Format Telegram message based on alert type
 * Following Messaging Specification v2.0
 * Phase 5.A: Added ML explanation (AQM + Patterns)
 */
export function formatTelegramMessage(baseUrl: string, e: ConnectionsAlertEvent): string {
  const username = e.username ? `@${e.username}` : e.account_id;
  const link = buildConnectionsLink(baseUrl, e.account_id);
  
  // Phase 4.1.6: Confidence warning line
  const confidenceWarning = e.confidence_warning 
    ? `\n⚠️ ${e.confidence_warning}\n`
    : '';
  
  // Phase 5.A: ML explanation section
  const mlSection = formatMLSection(e);
  
  // Priority indicator for header
  const priorityBadge = e.ml?.priority === 'LOW' ? ' [LOW PRIORITY]' : '';

  // TEST message
  if (e.type === 'TEST') {
    return [
      '🧪 TEST ALERT',
      '',
      'This is a test notification from Connections module.',
      '',
      'If you see this message — Telegram delivery is configured correctly.',
      'No real signals were used.',
    ].join('\n');
  }

  // 🚀 EARLY BREAKOUT
  if (e.type === 'EARLY_BREAKOUT') {
    const graphLink = buildGraphLinkWithState(baseUrl, e.account_id);
    return [
      `🚀 EARLY BREAKOUT${priorityBadge}`,
      '',
      username,
      confidenceWarning,
      'Account shows early influence growth that the market hasn\'t noticed yet.',
      '',
      `• Influence: ${fmtInt(e.influence_score)}`,
      `• Acceleration: ${fmtPct(e.acceleration_pct)}`,
      `• Profile: ${fmtProfile(e.profile)}`,
      `• Risk: ${fmtRisk(e.risk)}`,
      mlSection,
      '',
      e.explain_summary || 'Signal based on sustained growth and positive dynamics.',
      '',
      '🔗 View details:',
      link,
      '',
      '📊 Open in Graph:',
      graphLink,
    ].filter(l => l !== '').join('\n');
  }

  // 📈 STRONG ACCELERATION
  if (e.type === 'STRONG_ACCELERATION') {
    const graphLink = buildGraphLinkWithState(baseUrl, e.account_id);
    return [
      `📈 STRONG ACCELERATION${priorityBadge}`,
      '',
      username,
      confidenceWarning,
      'Sharp acceleration of influence growth over a short period.',
      '',
      `• Influence: ${fmtInt(e.influence_score)}`,
      `• Velocity: +${fmtInt(e.velocity_per_day)}/day`,
      `• Acceleration: ${fmtPct(e.acceleration_pct)}`,
      `• Trend: ${fmtTrend(e.trend_state)}`,
      mlSection,
      '',
      e.explain_summary || 'Dynamics intensifying, possible transition to breakout.',
      '',
      '🔗 View trend:',
      link,
      '',
      '📊 Open in Graph:',
      graphLink,
    ].filter(l => l !== '').join('\n');
  }

  // 🔄 TREND REVERSAL
  if (e.type === 'TREND_REVERSAL') {
    const graphLink = buildGraphLinkWithState(baseUrl, e.account_id);
    return [
      `🔄 TREND CHANGE${priorityBadge}`,
      '',
      username,
      confidenceWarning,
      'Influence trend has changed.',
      '',
      `• Previous: ${fmtTrend(e.prev_trend_state)}`,
      `• Current: ${fmtTrend(e.trend_state)}`,
      `• Influence: ${fmtInt(e.influence_score)}`,
      mlSection,
      '',
      e.explain_summary || 'Account dynamics changed — reassessment recommended.',
      '',
      '🔗 View analysis:',
      link,
      '',
      '📊 Open in Graph:',
      graphLink,
    ].filter(l => l !== '').join('\n');
  }

  // Fallback
  return [
    '🔔 CONNECTIONS ALERT',
    '',
    username,
    confidenceWarning,
    e.explain_summary || 'Alert triggered.',
    mlSection,
    '',
    link,
  ].filter(l => l !== '').join('\n');
}
