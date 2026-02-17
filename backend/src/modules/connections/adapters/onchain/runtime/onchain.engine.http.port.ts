/**
 * On-chain Engine HTTP Port
 * 
 * E1: HTTP adapter to connect to external on-chain engine API.
 * Implements IOnchainEnginePort interface.
 */

import { IOnchainEnginePort } from './onchain.engine.runtime.js';

export interface OnchainEngineHttpPortConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class OnchainEngineHttpPort implements IOnchainEnginePort {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: OnchainEngineHttpPortConfig) {
    // Remove trailing slash
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 10000;
  }

  private async fetchJson(path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Engine API error: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        throw new Error(`Engine API timeout after ${this.timeout}ms`);
      }
      throw err;
    }
  }

  /**
   * Get market snapshot for an asset at specific time
   */
  async getMarketSnapshot(asset: string, timestampIso?: string): Promise<any> {
    // Try common on-chain engine API patterns
    const endpoints = [
      `/api/snapshot/${asset}`,
      `/api/market/${asset}/snapshot`,
      `/api/onchain/${asset}`,
      `/snapshot`,
    ];

    const params = timestampIso ? `?timestamp=${encodeURIComponent(timestampIso)}` : '';

    for (const endpoint of endpoints) {
      try {
        const result = await this.fetchJson(`${endpoint}${params}`);
        if (result) return result;
      } catch {
        // Try next endpoint
      }
    }

    // Fallback: POST to generic endpoint
    try {
      return await this.fetchJson('/api/query', {
        type: 'snapshot',
        asset,
        timestamp: timestampIso,
      });
    } catch {
      return null;
    }
  }

  /**
   * Get window verdict for asset between two timestamps
   */
  async getWindowVerdict(asset: string, fromIso: string, toIso: string): Promise<any> {
    // Try common patterns
    const endpoints = [
      `/api/verdict/${asset}`,
      `/api/market/${asset}/verdict`,
      `/api/window/${asset}`,
    ];

    const params = `?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;

    for (const endpoint of endpoints) {
      try {
        const result = await this.fetchJson(`${endpoint}${params}`);
        if (result) return result;
      } catch {
        // Try next endpoint
      }
    }

    // Fallback: POST
    try {
      return await this.fetchJson('/api/query', {
        type: 'verdict',
        asset,
        from: fromIso,
        to: toIso,
      });
    } catch {
      return null;
    }
  }

  /**
   * Test connection to engine
   */
  async testConnection(): Promise<{ ok: boolean; error?: string; info?: any }> {
    const testEndpoints = [
      '/api/health',
      '/health',
      '/api/status',
      '/status',
      '/',
    ];

    for (const endpoint of testEndpoints) {
      try {
        const result = await this.fetchJson(endpoint);
        return { ok: true, info: result };
      } catch (err: any) {
        // Try next
      }
    }

    // Try snapshot for common asset
    try {
      const result = await this.getMarketSnapshot('BTC');
      if (result) {
        return { ok: true, info: { type: 'snapshot', data: result } };
      }
    } catch {
      // Final failure
    }

    return { 
      ok: false, 
      error: `Could not connect to ${this.baseUrl}` 
    };
  }
}
