/**
 * Twitter Adapter Configuration
 * 
 * Controls how Twitter data flows into Connections.
 * READ-ONLY mode - never writes back to Twitter collections.
 * 
 * PHASE 4.1 — Twitter → Connections Adapter
 * PHASE T0-T1 — READ-ONLY binding
 */

/**
 * Adapter operating modes
 */
export type AdapterMode = 'off' | 'dry-run' | 'live';
export type ReaderStatus = 'disabled' | 'enabled' | 'no_data';

export interface AdapterSources {
  followers: boolean;
  engagements: boolean;
  graph: boolean;
}

export interface AdapterSourceCollections {
  primary: string;
  authors_from: 'aggregate_from_results' | 'direct';
  engagements_from: 'direct_from_results' | 'separate';
  follow_edges_from: 'disabled' | 'separate_collection';
}

export interface AdapterSafetyConfig {
  max_followers_spike_pct: number;
  max_events_per_hour: number;
  spike_lookback_hours: number;
  max_data_age_hours: { author: number; engagement: number; follow: number; };
  block_on_anomaly: boolean;
}

export interface TwitterAdapterConfig {
  enabled: boolean;
  mode: AdapterMode;
  read_only: boolean;
  writes_disabled: boolean;
  alerts_disabled: boolean;
  sources: AdapterSources;
  source_collections: AdapterSourceCollections;
  safety: AdapterSafetyConfig;
  confidence_cap: number;
  batch_size: number;
  sync_interval_minutes: number;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  log_dry_run_writes: boolean;
}

export const DEFAULT_ADAPTER_CONFIG: TwitterAdapterConfig = {
  enabled: false,
  mode: 'dry-run',
  read_only: true,
  writes_disabled: true,
  alerts_disabled: true,
  sources: { followers: true, engagements: true, graph: false },
  source_collections: {
    primary: 'twitter_results',
    authors_from: 'aggregate_from_results',
    engagements_from: 'direct_from_results',
    follow_edges_from: 'disabled',
  },
  safety: {
    max_followers_spike_pct: 30,
    max_events_per_hour: 1000,
    spike_lookback_hours: 6,
    max_data_age_hours: { author: 336, engagement: 336, follow: 336 },
    block_on_anomaly: false,
  },
  confidence_cap: 0.75,
  batch_size: 100,
  sync_interval_minutes: 15,
  log_level: 'info',
  log_dry_run_writes: true,
};

let adapterConfig: TwitterAdapterConfig = { ...DEFAULT_ADAPTER_CONFIG };

export function getAdapterConfig(): TwitterAdapterConfig {
  return { ...adapterConfig };
}

export function updateAdapterConfig(partial: Partial<TwitterAdapterConfig>): TwitterAdapterConfig {
  adapterConfig = {
    ...adapterConfig,
    ...partial,
    read_only: true,
    writes_disabled: true,
    sources: { ...adapterConfig.sources, ...(partial.sources || {}), graph: false },
    source_collections: { ...adapterConfig.source_collections, ...(partial.source_collections || {}), follow_edges_from: 'disabled' },
    safety: { ...adapterConfig.safety, ...(partial.safety || {}), max_data_age_hours: { ...adapterConfig.safety.max_data_age_hours, ...(partial.safety?.max_data_age_hours || {}) } },
  };
  console.log('[TwitterAdapter] Config updated:', { enabled: adapterConfig.enabled, mode: adapterConfig.mode, read_only: adapterConfig.read_only });
  return { ...adapterConfig };
}

export function resetAdapterConfig(): TwitterAdapterConfig {
  adapterConfig = { ...DEFAULT_ADAPTER_CONFIG };
  return { ...adapterConfig };
}

export function getAdapterStatus() {
  return {
    enabled: adapterConfig.enabled,
    mode: adapterConfig.mode,
    read_only: adapterConfig.read_only,
    readers: { authors: adapterConfig.sources.followers ? 'enabled' : 'disabled', engagements: adapterConfig.sources.engagements ? 'enabled' : 'disabled', graph: 'disabled' as const },
    confidence_cap: adapterConfig.confidence_cap,
    source: adapterConfig.source_collections.primary,
  };
}
