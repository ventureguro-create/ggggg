/**
 * Seed Known Wallet Attributions
 * 
 * E3: Initial set of known VC/Fund wallets
 */

import { Db } from 'mongodb';
import { WalletAttributionStore } from '../storage/wallet-attribution.store.js';
import { WalletAttributionService } from '../services/wallet-attribution.service.js';
import { CreateAttributionRequest } from '../contracts/wallet-attribution.types.js';

// Known wallet attributions (example data)
const KNOWN_ATTRIBUTIONS: CreateAttributionRequest[] = [
  // a16z
  {
    walletAddress: '0x66B870dDf78c975af5Cd8EDC6De25eCa81791DE1',
    chain: 'ethereum',
    backerId: 'backer:a16z',
    actorLabel: 'a16z Crypto',
    source: 'MANUAL',
    confidence: 'HIGH',
    tags: ['vc', 'tier1'],
  },
  {
    walletAddress: 'a16zCrypto.eth',
    chain: 'ethereum',
    backerId: 'backer:a16z',
    actorLabel: 'a16z Crypto (ENS)',
    source: 'ONCHAIN_LABEL',
    confidence: 'HIGH',
    tags: ['vc', 'tier1', 'ens'],
  },
  // Paradigm
  {
    walletAddress: '0x6c3e4cb2e96B01F4b866965A91ed4437839A121a',
    chain: 'ethereum',
    backerId: 'backer:paradigm',
    actorLabel: 'Paradigm',
    source: 'MANUAL',
    confidence: 'HIGH',
    tags: ['vc', 'tier1'],
  },
  // Sequoia
  {
    walletAddress: '0x8f8EF111B67C04Eb1641f5ff19EE54Cda062f163',
    chain: 'ethereum',
    backerId: 'backer:sequoia',
    actorLabel: 'Sequoia Capital',
    source: 'MANUAL',
    confidence: 'MEDIUM',
    tags: ['vc', 'tier1'],
  },
  // Polychain Capital
  {
    walletAddress: '0xf977814e90da44bFA03b6295A0616a897441aceC',
    chain: 'ethereum',
    backerId: 'backer:polychain',
    actorLabel: 'Polychain Capital',
    source: 'MANUAL',
    confidence: 'HIGH',
    tags: ['vc', 'crypto-native'],
  },
  // Binance Labs
  {
    walletAddress: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    chain: 'ethereum',
    backerId: 'backer:binance',
    actorLabel: 'Binance Labs',
    source: 'MANUAL',
    confidence: 'HIGH',
    tags: ['exchange', 'vc'],
  },
  // Solana examples
  {
    walletAddress: 'A16Z111111111111111111111111111111111111111',
    chain: 'solana',
    backerId: 'backer:a16z',
    actorLabel: 'a16z Crypto (Solana)',
    source: 'INFERRED',
    confidence: 'MEDIUM',
    tags: ['vc', 'solana'],
  },
  // Whale/Influencer example
  {
    walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    chain: 'ethereum',
    actorId: 'tw:vitalik',
    actorLabel: 'vitalik.eth',
    source: 'ONCHAIN_LABEL',
    confidence: 'HIGH',
    tags: ['founder', 'ethereum', 'influencer'],
    notes: 'Vitalik Buterin public wallet',
  },
];

export async function seedKnownWallets(db: Db): Promise<{
  created: number;
  skipped: number;
}> {
  const store = new WalletAttributionStore(db);
  const service = new WalletAttributionService(store);

  let created = 0;
  let skipped = 0;

  for (const attr of KNOWN_ATTRIBUTIONS) {
    try {
      // Check if already exists
      const existing = await service.getAttribution(attr.walletAddress, attr.chain);
      if (existing) {
        skipped++;
        continue;
      }

      await service.setAttribute(attr);
      created++;
    } catch (err) {
      console.error(`Failed to seed wallet ${attr.walletAddress}:`, err);
      skipped++;
    }
  }

  console.log(`[WalletSeed] Created: ${created}, Skipped: ${skipped}`);
  return { created, skipped };
}
