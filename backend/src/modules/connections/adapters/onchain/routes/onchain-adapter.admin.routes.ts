/**
 * On-chain Adapter Admin Routes
 * E1: Extended with engine connection management
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OnchainResolveRequestSchema } from '../contracts/onchain.schemas.js';
import { OnchainAdapterService } from '../services/onchain-adapter.service.js';
import { OnchainAdapterConfigStore } from '../storage/onchain-adapter-config.store.js';

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(['OFF', 'MOCK', 'ENGINE_READONLY']).optional(),
  confidence_floor_0_1: z.number().min(0).max(1).optional(),
  max_assets_per_request: z.number().int().min(1).max(50).optional(),
  max_windows_per_request: z.number().int().min(1).max(20).optional(),
  engineBaseUrl: z.string().url().optional(),
  engineApiKey: z.string().optional(),
});

const TestEngineSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export async function registerOnchainAdapterAdminRoutes(
  app: FastifyInstance,
  deps: {
    onchainAdapter: OnchainAdapterService;
    cfgStore: OnchainAdapterConfigStore;
  }
) {
  app.get('/status', async () => {
    return { ok: true, data: await deps.onchainAdapter.getStatus() };
  });

  app.get('/config', async () => {
    const cfg = await deps.cfgStore.getOrCreate();
    // Hide API key in response
    return { 
      ok: true, 
      data: { 
        ...cfg, 
        engineApiKey: cfg.engineApiKey ? '***' : undefined 
      } 
    };
  });

  app.patch('/config', async (req) => {
    const body = PatchSchema.parse((req as any).body ?? {});
    const cfg = await deps.cfgStore.patch(body);
    return { 
      ok: true, 
      data: { 
        ...cfg, 
        engineApiKey: cfg.engineApiKey ? '***' : undefined 
      } 
    };
  });

  // E1: Test connection to external on-chain engine
  app.post('/engine/test', async (req) => {
    const body = TestEngineSchema.parse((req as any).body ?? {});
    const result = await deps.onchainAdapter.testEngineConnection(
      body.baseUrl, 
      body.apiKey
    );
    return { ok: result.ok, data: result };
  });

  // E1: Disconnect engine (switch back to MOCK)
  app.post('/engine/disconnect', async () => {
    await deps.cfgStore.patch({
      mode: 'MOCK',
      engineBaseUrl: undefined,
      engineApiKey: undefined,
      engineConnected: false,
    });
    return { ok: true, message: 'Disconnected from engine, switched to MOCK mode' };
  });

  app.post('/test/resolve', async (req) => {
    const body = OnchainResolveRequestSchema.parse((req as any).body ?? {});
    const result = await deps.onchainAdapter.resolve(body);
    return { ok: true, data: result };
  });

  app.post('/test/snapshot', async (req) => {
    const body = z.object({ asset: z.string(), timestamp: z.string().optional() }).parse((req as any).body ?? {});
    const result = await deps.onchainAdapter.getSnapshot(body.asset, body.timestamp);
    return { ok: true, data: result };
  });

  console.log('[OnchainAdapter] Admin routes registered (E1: Engine support)');
}
