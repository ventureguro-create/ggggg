/**
 * Connections Telegram Notifications - Types
 * Phase 2.3: Telegram Alerts Delivery
 * Phase 5.A: ML Layer integration
 */

export type ConnectionsAlertType =
  | 'EARLY_BREAKOUT'
  | 'STRONG_ACCELERATION'
  | 'TREND_REVERSAL'
  | 'TEST';

export type AlertDeliveryStatus =
  | 'PREVIEW'     // created by engine, not delivered
  | 'SENT'        // sent to Telegram
  | 'SKIPPED'     // skipped by policy (disabled/cooldown)
  | 'SUPPRESSED'  // manually suppressed or ML-suppressed
  | 'FAILED';     // send attempt failed

/**
 * ML Layer results for alert (Phase 5.A)
 */
export interface AlertMLData {
  aqm: {
    probability: number;       // 0-1
    label: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
    recommendation: 'SEND' | 'SEND_LOW_PRIORITY' | 'SUPPRESS';
    explain: {
      top_positive_factors: string[];
      top_negative_factors: string[];
      reason: string;
    };
  };
  patterns: {
    risk_score: number;        // 0-100
    flags: string[];           // e.g., ['LIKE_FARM', 'SPIKE_PUMP']
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    explain: string[];
  };
  priority: 'HIGH' | 'LOW';
}

export interface ConnectionsAlertEvent {
  _id?: any;
  id: string;
  type: ConnectionsAlertType;
  created_at: string;
  account_id: string;
  username?: string;

  // Snapshot for message
  influence_score?: number;       // 0..1000
  velocity_per_day?: number;      // pts/day
  acceleration_pct?: number;      // %
  profile?: 'retail' | 'influencer' | 'whale';
  risk?: 'low' | 'medium' | 'high';
  prev_trend_state?: 'growing' | 'cooling' | 'stable' | 'volatile';
  trend_state?: 'growing' | 'cooling' | 'stable' | 'volatile';

  // Human explanation
  explain_summary?: string;

  // Phase 4.1.6: Confidence warning (if data quality is not HIGH)
  confidence_warning?: string;
  
  // Phase 5.A: ML Layer results
  ml?: AlertMLData;

  // Delivery state
  delivery_status: AlertDeliveryStatus;
  delivery_reason?: string;
  sent_at?: string;
  target?: {
    telegram_chat_id?: string;
  };
}

export interface TelegramDeliverySettings {
  enabled: boolean;
  preview_only: boolean;
  chat_id: string;
  cooldown_hours: Record<ConnectionsAlertType, number>;
  type_enabled: Record<ConnectionsAlertType, boolean>;
  updated_at?: string;
}

export const DEFAULT_TELEGRAM_SETTINGS: TelegramDeliverySettings = {
  enabled: false,
  preview_only: true,
  chat_id: '',
  cooldown_hours: {
    TEST: 0,
    EARLY_BREAKOUT: 24,
    STRONG_ACCELERATION: 12,
    TREND_REVERSAL: 12,
  },
  type_enabled: {
    TEST: true,
    EARLY_BREAKOUT: true,
    STRONG_ACCELERATION: true,
    TREND_REVERSAL: true,
  },
};
