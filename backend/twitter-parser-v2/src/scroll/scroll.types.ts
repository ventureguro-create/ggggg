/**
 * Scroll Types - типы для scroll engine
 */

export interface ScrollTelemetry {
  /** Получено постов в этой итерации */
  fetchedThisBatch: number;
  
  /** Всего получено постов */
  fetchedTotal: number;
  
  /** Latency XHR запроса (ms) */
  latencyMs: number;
  
  /** Количество XHR ошибок */
  xhrErrors: number;
  
  /** Обнаружена captcha */
  captchaSeen: boolean;
  
  /** Обнаружен rate limit */
  rateLimitSeen: boolean;
  
  /** Пустой ответ (0 твитов) */
  emptyResponse: boolean;
  
  /** Timestamp */
  timestamp: Date;
}

export interface RuntimeRisk {
  /** Score 0-100 */
  score: number;
  
  /** Risk level */
  level: RiskLevel;
  
  /** Факторы риска */
  factors: string[];
}

export enum RiskLevel {
  LOW = 'LOW',         // 0-24
  MEDIUM = 'MEDIUM',   // 25-49
  HIGH = 'HIGH',       // 50-74
  CRITICAL = 'CRITICAL', // 75+
}

export enum ScrollProfile {
  SAFE = 'SAFE',
  NORMAL = 'NORMAL',
  AGGRESSIVE = 'AGGRESSIVE',
}

export interface ScrollPolicy {
  /** Min delay between scrolls (ms) */
  minDelayMs: number;
  
  /** Max delay between scrolls (ms) */
  maxDelayMs: number;
  
  /** Min scroll distance (px) */
  scrollPxMin: number;
  
  /** Max scroll distance (px) */
  scrollPxMax: number;
  
  /** Micro jitter range (ms) */
  microJitterMax: number;
  
  /** Expected posts per batch */
  batchSizeMin: number;
  batchSizeMax: number;
  
  /** Expected posts per hour */
  expectedPostsPerHour: number;
}

export interface ScrollEngineState {
  /** Current profile */
  profile: ScrollProfile;
  
  /** Fetched posts count */
  fetchedPosts: number;
  
  /** Scroll iterations */
  scrolls: number;
  
  /** Started at */
  startedAt: Date;
  
  /** Last risk assessment */
  lastRisk: RuntimeRisk | null;
  
  /** Was aborted */
  aborted: boolean;
  
  /** Downgrade count */
  downgrades: number;
  
  /** Empty responses in a row */
  emptyResponsesStreak: number;
  
  /** Same delay count (for pattern detection) */
  sameDelayCount: number;
  lastDelay: number;
}

export interface ScrollEngineConfig {
  /** Target posts to fetch */
  plannedPosts: number;
  
  /** Initial profile */
  initialProfile: ScrollProfile;
  
  /** Task ID (for logging) */
  taskId?: string;
  
  /** Account ID (for per-account memory) */
  accountId?: string;
}
