/**
 * Wallet Attribution Admin Routes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WalletAttributionService } from '../services/wallet-attribution.service.js';
import { WalletAttributionStore } from '../storage/wallet-attribution.store.js';

const CreateAttributionSchema = z.object({
  walletAddress: z.string().min(10),
  chain: z.enum(['ethereum', 'solana', 'bitcoin', 'arbitrum', 'optimism', 'base', 'polygon']),
  actorId: z.string().optional(),
  backerId: z.string().optional(),
  actorLabel: z.string().min(1),
  source: z.enum(['MANUAL', 'ARKHAM', 'NANSEN', 'ONCHAIN_LABEL', 'SELF_REPORTED', 'INFERRED']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED']),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function registerWalletAttributionAdminRoutes(
  app: FastifyInstance,
  deps: {
    service: WalletAttributionService;
    store: WalletAttributionStore;
  }
) {
  // Get stats
  app.get('/stats', async () => {
    const stats = await deps.service.getStats();
    return { ok: true, data: stats };
  });

  // List all attributions
  app.get('/list', async (req) => {
    const query = req.query as any;
    const attributions = await deps.service.listAll({
      limit: Number(query.limit || 100),
      verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
      confidence: query.confidence,
      chain: query.chain,
    });
    return { ok: true, data: attributions };
  });

  // Get by wallet
  app.get('/wallet/:address', async (req) => {
    const { address } = req.params as any;
    const chain = (req.query as any).chain;
    const attribution = await deps.service.getAttribution(address, chain);
    return { ok: true, data: attribution };
  });

  // Get by actor
  app.get('/actor/:actorId', async (req) => {
    const { actorId } = req.params as any;
    const wallets = await deps.service.getActorWallets(actorId);
    const credibility = await deps.service.calculateOnchainCredibility(actorId);
    return { ok: true, data: { wallets, credibility } };
  });

  // Get by backer
  app.get('/backer/:backerId', async (req) => {
    const { backerId } = req.params as any;
    const wallets = await deps.service.getBackerWallets(backerId);
    return { ok: true, data: wallets };
  });

  // Create attribution
  app.post('/create', async (req) => {
    const body = CreateAttributionSchema.parse((req as any).body ?? {});
    const attribution = await deps.service.setAttribute(body);
    return { ok: true, data: attribution };
  });

  // Verify attribution
  app.post('/verify', async (req) => {
    const body = z.object({
      walletAddress: z.string(),
      chain: z.string(),
      verifiedBy: z.string().default('admin'),
    }).parse((req as any).body ?? {});
    
    const attribution = await deps.service.verify(
      body.walletAddress, 
      body.chain, 
      body.verifiedBy
    );
    return { ok: true, data: attribution };
  });

  // Delete attribution
  app.delete('/delete', async (req) => {
    const body = z.object({
      walletAddress: z.string(),
      chain: z.string(),
    }).parse((req as any).body ?? {});
    
    const deleted = await deps.service.delete(body.walletAddress, body.chain);
    return { ok: true, deleted };
  });

  // Get mock wallet activity (for testing)
  app.get('/activity/:address', async (req) => {
    const { address } = req.params as any;
    const chain = (req.query as any).chain || 'ethereum';
    const activity = deps.service.generateMockActivity(address, chain);
    return { ok: true, data: activity };
  });

  console.log('[WalletAttribution] Admin routes registered');
}
