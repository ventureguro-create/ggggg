/**
 * Admin Connections Twitter Adapter API Client
 * 
 * Clean API layer for Twitter Adapter admin panel.
 */

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
const PREFIX = '/api/admin/connections/twitter-adapter';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${PREFIX}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error');
  }
  
  return data.data;
}

// Types
export type AdapterMode = 'OFF' | 'READ_ONLY' | 'BLENDED';

export interface QuickStatus {
  mode: AdapterMode;
  data_available: boolean;
  warnings_count: number;
}

export interface FullStatus {
  mode: AdapterMode;
  enabled: boolean;
  weights: {
    engagement: number;
    trend: number;
    network: number;
    authority: number;
  };
  confidence_gate: number;
  caps: {
    confidence_max: number;
    engagement_max: number;
    trend_max: number;
    network_max: number;
    authority_max: number;
  };
  locks: {
    read_only: boolean;
    alerts_disabled: boolean;
    parser_untouched: boolean;
    network_locked: boolean;
    authority_locked: boolean;
  };
  data: {
    available: boolean;
    tweets_count: number;
    authors_count: number;
    newest_at?: string;
    freshness: 'FRESH' | 'STALE' | 'EMPTY';
    freshness_hours?: number;
  };
  confidence: {
    avg: number;
    min: number;
    max: number;
    below_gate_count: number;
    above_gate_count: number;
    warnings: string[];
  };
  diff: {
    avg_delta: number;
    max_delta: number;
    top_deltas: { author: string; delta: number }[];
    divergent_count: number;
  };
  graph: {
    follow_available: boolean;
    co_engagement_available: boolean;
    active_source: string;
  };
  last_change: string;
  changed_by: string;
  warnings: string[];
}

export interface DryRunResult {
  mode: string;
  results_count: number;
  blended_count: number;
  mock_only_count: number;
  avg_delta: number;
  config_used: any;
  sample_results: {
    author: string;
    mock: string;
    blended: string;
    delta: string;
    blend_applied: boolean;
  }[];
  warnings: string[];
}

// API Functions
export async function getStatus(): Promise<QuickStatus> {
  return fetchApi('/status');
}

export async function getFullStatus(): Promise<FullStatus> {
  return fetchApi('/full-status');
}

export async function getConfig(): Promise<any> {
  return fetchApi('/config');
}

export async function setMode(mode: AdapterMode): Promise<any> {
  return fetchApi('/mode', {
    method: 'PATCH',
    body: JSON.stringify({ mode }),
  });
}

export async function setWeights(payload: {
  engagement?: number;
  trend?: number;
  confidence_gate?: number;
}): Promise<any> {
  return fetchApi('/weights', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function runDryRun(): Promise<DryRunResult> {
  return fetchApi('/dry-run', { method: 'POST' });
}

export async function runDiff(payload?: {
  mock_authors?: number;
  mock_engagements?: number;
}): Promise<any> {
  return fetchApi('/diff', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function rollback(): Promise<any> {
  return fetchApi('/rollback', { method: 'POST' });
}

export async function getLocks(): Promise<any> {
  return fetchApi('/locks');
}
