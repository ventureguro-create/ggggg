/**
 * On-chain Adapter Service
 * 
 * Single entrypoint for Connections Core to access on-chain data.
 * Selects runtime based on mode (MOCK/ENGINE).
 * E1: Supports dynamic HTTP engine connection.
 */

import { IOnchainAdapter, OnchainAdapterStatus } from '../contracts/onchain.contract.js';
import { OnchainResolveRequest, OnchainResolveResponse, OnchainSnapshot } from '../contracts/onchain.types.js';
import { OnchainAdapterConfigStore } from '../storage/onchain-adapter-config.store.js';
import { OnchainMockRuntime } from '../runtime/onchain.mock.runtime.js';
import { IOnchainEnginePort, OnchainEngineReadonlyRuntime } from '../runtime/onchain.engine.runtime.js';
import { OnchainEngineHttpPort } from '../runtime/onchain.engine.http.port.js';

export class OnchainAdapterService implements IOnchainAdapter {
  private mock = new OnchainMockRuntime();
  private engineRt: OnchainEngineReadonlyRuntime | null = null;
  private cachedEngineUrl: string | null = null;

  constructor(
    private readonly cfgStore: OnchainAdapterConfigStore,
    onchainEnginePort?: IOnchainEnginePort
  ) {
    if (onchainEnginePort) {
      this.engineRt = new OnchainEngineReadonlyRuntime(onchainEnginePort);
    }
  }

  /**
   * E1: Dynamically get or create engine runtime from config
   */
  private async getEngineRuntime(): Promise<OnchainEngineReadonlyRuntime | null> {
    const cfg = await this.cfgStore.getOrCreate();
    
    // No engine URL configured
    if (!cfg.engineBaseUrl) {
      return this.engineRt;
    }
    
    // Check if we need to create/update HTTP port
    if (this.cachedEngineUrl !== cfg.engineBaseUrl || !this.engineRt) {
      const httpPort = new OnchainEngineHttpPort({
        baseUrl: cfg.engineBaseUrl,
        apiKey: cfg.engineApiKey,
      });
      this.engineRt = new OnchainEngineReadonlyRuntime(httpPort);
      this.cachedEngineUrl = cfg.engineBaseUrl;
      console.log(`[OnchainAdapter] Connected to engine: ${cfg.engineBaseUrl}`);
    }
    
    return this.engineRt;
  }

  async getStatus(): Promise<OnchainAdapterStatus> {
    const cfg = await this.cfgStore.getOrCreate();
    return {
      enabled: cfg.enabled,
      mode: cfg.mode,
      read_only: true,
      data_health: {},
      limits: {
        max_assets_per_request: cfg.max_assets_per_request,
        max_windows_per_request: cfg.max_windows_per_request,
      },
      defaults: { confidence_floor_0_1: cfg.confidence_floor_0_1 },
      // E1: Engine connection info
      engine: cfg.engineBaseUrl ? {
        baseUrl: cfg.engineBaseUrl,
        connected: cfg.engineConnected ?? false,
        lastCheck: cfg.engineLastCheck,
      } : undefined,
    };
  }

  private async pickRuntime(): Promise<'MOCK' | 'ENGINE' | null> {
    const cfg = await this.cfgStore.getOrCreate();
    if (!cfg.enabled || cfg.mode === 'OFF') return null;
    if (cfg.mode === 'MOCK') return 'MOCK';
    
    // E1: Try to get engine runtime
    const engineRt = await this.getEngineRuntime();
    return engineRt ? 'ENGINE' : 'MOCK';
  }

  async getSnapshot(asset: string, timestampIso?: string): Promise<OnchainSnapshot> {
    const rt = await this.pickRuntime();
    const ts = timestampIso ?? new Date().toISOString();

    if (!rt) {
      return {
        asset,
        timestamp: ts,
        flow_score_0_1: 0.5,
        exchange_pressure_m1_1: 0,
        whale_activity_0_1: 0.5,
        network_heat_0_1: 0.5,
        verdict: 'NO_DATA',
        confidence_0_1: 0,
        warnings: ['ONCHAIN_ADAPTER_OFF'],
        source: { name: 'onchain-adapter' },
      };
    }

    if (rt === 'MOCK') {
      return this.mock.getSnapshot(asset, ts);
    }

    // E1: Use dynamic engine runtime
    const engineRt = await this.getEngineRuntime();
    return engineRt!.getSnapshot(asset, ts);
  }

  async resolve(req: OnchainResolveRequest): Promise<OnchainResolveResponse> {
    const rt = await this.pickRuntime();
    if (!rt) {
      return { asset: req.asset, baseTimestamp: req.eventTimestamp, snapshots: [] };
    }
    
    if (rt === 'MOCK') {
      return this.mock.resolve(req);
    }

    // E1: Use dynamic engine runtime
    const engineRt = await this.getEngineRuntime();
    return engineRt!.resolve(req);
  }

  /**
   * E1: Test connection to external engine
   */
  async testEngineConnection(baseUrl: string, apiKey?: string): Promise<{
    ok: boolean;
    error?: string;
    info?: any;
  }> {
    try {
      const httpPort = new OnchainEngineHttpPort({
        baseUrl,
        apiKey,
        timeout: 15000,
      });
      
      const result = await httpPort.testConnection();
      
      // Update config with connection status
      await this.cfgStore.patch({
        engineBaseUrl: baseUrl,
        engineApiKey: apiKey,
        engineConnected: result.ok,
        engineLastCheck: new Date().toISOString(),
      });
      
      // Reset cached engine if URL changed
      if (result.ok && this.cachedEngineUrl !== baseUrl) {
        this.cachedEngineUrl = null;
        this.engineRt = null;
      }
      
      return result;
    } catch (err: any) {
      await this.cfgStore.patch({
        engineConnected: false,
        engineLastCheck: new Date().toISOString(),
      });
      
      return { ok: false, error: err.message };
    }
  }
}
