/**
 * AI Summary Config (Phase 3.5)
 * Admin-tunable configuration
 */

import type { AiConfig } from './contracts.js';

export const defaultAiConfig: AiConfig = {
  enabled: true,
  model: 'gpt-4o-mini',
  max_output_tokens: 700,
  temperature: 0.25,
  min_confidence_to_run: 35,
  cache_ttl_sec: 86400, // 24 hours
  language: 'en',
};

// Config store (in-memory with persistence)
let currentConfig: AiConfig = { ...defaultAiConfig };

export function getAiConfig(): AiConfig {
  return { ...currentConfig };
}

export function patchAiConfig(updates: Partial<AiConfig>): AiConfig {
  currentConfig = {
    ...currentConfig,
    ...updates,
  };
  return { ...currentConfig };
}

export function resetAiConfig(): AiConfig {
  currentConfig = { ...defaultAiConfig };
  return { ...currentConfig };
}
