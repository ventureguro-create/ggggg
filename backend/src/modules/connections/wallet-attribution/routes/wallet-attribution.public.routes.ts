/**
 * Wallet Attribution Public Routes
 */

import { FastifyInstance } from 'fastify';
import { WalletAttributionService } from '../services/wallet-attribution.service.js';

export async function registerWalletAttributionPublicRoutes(
  app: FastifyInstance,
  deps: { service: WalletAttributionService }
) {
  // Get actor's wallet credibility (for UI display)
  app.get('/credibility/:actorId', async (req) => {
    const { actorId } = req.params as any;
    const credibility = await deps.service.calculateOnchainCredibility(actorId);
    return { ok: true, data: credibility };
  });

  // Check if wallet is attributed
  app.get('/check/:address', async (req) => {
    const { address } = req.params as any;
    const chain = (req.query as any).chain;
    const attribution = await deps.service.getAttribution(address, chain);
    
    if (!attribution) {
      return { ok: true, data: { attributed: false } };
    }

    return { 
      ok: true, 
      data: { 
        attributed: true,
        actorLabel: attribution.actorLabel,
        confidence: attribution.confidence,
        verified: attribution.verified,
      } 
    };
  });

  console.log('[WalletAttribution] Public routes registered');
}
