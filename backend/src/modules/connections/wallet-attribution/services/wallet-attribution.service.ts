/**
 * Wallet Attribution Service
 * 
 * E3: Connects wallets to actors for reality validation
 */

import { WalletAttributionStore } from '../storage/wallet-attribution.store.js';
import { 
  WalletAttribution, 
  CreateAttributionRequest,
  WalletActivity,
  WalletChain,
  CONFIDENCE_SCORES
} from '../contracts/wallet-attribution.types.js';

export class WalletAttributionService {
  constructor(private readonly store: WalletAttributionStore) {}

  /**
   * Create or update wallet attribution
   */
  async setAttribute(req: CreateAttributionRequest): Promise<WalletAttribution> {
    return this.store.create(req);
  }

  /**
   * Get attribution for a wallet
   */
  async getAttribution(walletAddress: string, chain?: string): Promise<WalletAttribution | null> {
    return this.store.getByWallet(walletAddress, chain);
  }

  /**
   * Get all wallets for an actor (Twitter account)
   */
  async getActorWallets(actorId: string): Promise<WalletAttribution[]> {
    return this.store.getByActor(actorId);
  }

  /**
   * Get all wallets for a backer (VC/Fund)
   */
  async getBackerWallets(backerId: string): Promise<WalletAttribution[]> {
    return this.store.getByBacker(backerId);
  }

  /**
   * Verify wallet attribution
   */
  async verify(walletAddress: string, chain: string, verifiedBy: string): Promise<WalletAttribution | null> {
    return this.store.verify(walletAddress, chain, verifiedBy);
  }

  /**
   * Check if actor has verified wallets
   */
  async hasVerifiedWallets(actorId: string): Promise<boolean> {
    const wallets = await this.store.getByActor(actorId);
    return wallets.some(w => w.verified);
  }

  /**
   * Calculate actor's on-chain credibility based on wallet attributions
   */
  async calculateOnchainCredibility(actorId: string): Promise<{
    hasWallets: boolean;
    walletCount: number;
    verifiedCount: number;
    avgConfidence_0_1: number;
    credibilityBoost_0_1: number;
  }> {
    const wallets = await this.store.getByActor(actorId);
    
    if (wallets.length === 0) {
      return {
        hasWallets: false,
        walletCount: 0,
        verifiedCount: 0,
        avgConfidence_0_1: 0,
        credibilityBoost_0_1: 0,
      };
    }

    const verifiedCount = wallets.filter(w => w.verified).length;
    const avgConfidence = wallets.reduce((sum, w) => sum + w.confidenceScore_0_1, 0) / wallets.length;

    // Credibility boost: having verified wallets increases trust
    // Max boost is 0.2 (20%) with 3+ verified HIGH confidence wallets
    const credibilityBoost = Math.min(0.2, 
      (verifiedCount * 0.05) + 
      (avgConfidence * 0.1)
    );

    return {
      hasWallets: true,
      walletCount: wallets.length,
      verifiedCount,
      avgConfidence_0_1: avgConfidence,
      credibilityBoost_0_1: credibilityBoost,
    };
  }

  /**
   * Generate mock wallet activity (for testing)
   */
  generateMockActivity(walletAddress: string, chain: WalletChain): WalletActivity {
    const seed = walletAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (seed % 100) / 100;

    const inflow = Math.round(1000 + r * 50000);
    const outflow = Math.round(500 + (1 - r) * 30000);

    return {
      walletAddress,
      chain,
      timestamp: new Date().toISOString(),
      inflow_usd: inflow,
      outflow_usd: outflow,
      netFlow_usd: inflow - outflow,
      txCount: Math.floor(5 + r * 50),
      uniqueTokens: Math.floor(2 + r * 15),
      isAccumulating: inflow > outflow * 1.3,
      isDistributing: outflow > inflow * 1.3,
    };
  }

  /**
   * Get statistics
   */
  async getStats() {
    return this.store.getStats();
  }

  /**
   * List all attributions
   */
  async listAll(options: Parameters<typeof this.store.listAll>[0] = {}) {
    return this.store.listAll(options);
  }

  /**
   * Delete attribution
   */
  async delete(walletAddress: string, chain: string): Promise<boolean> {
    return this.store.delete(walletAddress, chain);
  }
}
