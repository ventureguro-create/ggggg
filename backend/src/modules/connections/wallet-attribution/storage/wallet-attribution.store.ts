/**
 * Wallet Attribution Store
 */

import { Db, Collection } from 'mongodb';
import { 
  WalletAttribution, 
  CreateAttributionRequest,
  CONFIDENCE_SCORES 
} from '../contracts/wallet-attribution.types.js';

export class WalletAttributionStore {
  private col: Collection<WalletAttribution>;

  constructor(db: Db) {
    this.col = db.collection<WalletAttribution>('connections_wallet_attributions');
    // Indexes
    this.col.createIndex({ walletAddress: 1, chain: 1 }, { unique: true }).catch(() => {});
    this.col.createIndex({ actorId: 1 }).catch(() => {});
    this.col.createIndex({ backerId: 1 }).catch(() => {});
    this.col.createIndex({ confidence: 1 }).catch(() => {});
    this.col.createIndex({ verified: 1 }).catch(() => {});
  }

  async create(req: CreateAttributionRequest): Promise<WalletAttribution> {
    const now = new Date().toISOString();
    
    const doc: WalletAttribution = {
      walletAddress: req.walletAddress.toLowerCase(),
      chain: req.chain,
      actorId: req.actorId,
      backerId: req.backerId,
      actorLabel: req.actorLabel,
      source: req.source,
      confidence: req.confidence,
      confidenceScore_0_1: CONFIDENCE_SCORES[req.confidence],
      verified: req.confidence === 'HIGH' && req.source === 'MANUAL',
      createdAt: now,
      updatedAt: now,
      notes: req.notes,
      tags: req.tags,
    };

    await this.col.updateOne(
      { walletAddress: doc.walletAddress, chain: doc.chain },
      { $set: doc },
      { upsert: true }
    );

    return doc;
  }

  async getByWallet(walletAddress: string, chain?: string): Promise<WalletAttribution | null> {
    const query: any = { walletAddress: walletAddress.toLowerCase() };
    if (chain) query.chain = chain;
    return this.col.findOne(query);
  }

  async getByActor(actorId: string): Promise<WalletAttribution[]> {
    return this.col.find({ actorId }).toArray();
  }

  async getByBacker(backerId: string): Promise<WalletAttribution[]> {
    return this.col.find({ backerId }).toArray();
  }

  async listAll(options: {
    limit?: number;
    verified?: boolean;
    confidence?: string;
    chain?: string;
  } = {}): Promise<WalletAttribution[]> {
    const query: any = {};
    if (options.verified !== undefined) query.verified = options.verified;
    if (options.confidence) query.confidence = options.confidence;
    if (options.chain) query.chain = options.chain;

    return this.col
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(options.limit || 100)
      .toArray();
  }

  async verify(walletAddress: string, chain: string, verifiedBy: string): Promise<WalletAttribution | null> {
    const result = await this.col.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chain },
      { 
        $set: { 
          verified: true, 
          verifiedAt: new Date().toISOString(),
          verifiedBy,
          confidence: 'HIGH',
          confidenceScore_0_1: CONFIDENCE_SCORES.HIGH,
          updatedAt: new Date().toISOString(),
        } 
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(walletAddress: string, chain: string): Promise<boolean> {
    const result = await this.col.deleteOne({ 
      walletAddress: walletAddress.toLowerCase(), 
      chain 
    });
    return result.deletedCount > 0;
  }

  async getStats(): Promise<{
    total: number;
    verified: number;
    byChain: Record<string, number>;
    byConfidence: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const total = await this.col.countDocuments();
    const verified = await this.col.countDocuments({ verified: true });

    const byChainPipeline = [
      { $group: { _id: '$chain', count: { $sum: 1 } } },
    ];
    const byChainResults = await this.col.aggregate(byChainPipeline).toArray();
    const byChain: Record<string, number> = {};
    for (const r of byChainResults) byChain[r._id] = r.count;

    const byConfidencePipeline = [
      { $group: { _id: '$confidence', count: { $sum: 1 } } },
    ];
    const byConfidenceResults = await this.col.aggregate(byConfidencePipeline).toArray();
    const byConfidence: Record<string, number> = {};
    for (const r of byConfidenceResults) byConfidence[r._id] = r.count;

    const bySourcePipeline = [
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ];
    const bySourceResults = await this.col.aggregate(bySourcePipeline).toArray();
    const bySource: Record<string, number> = {};
    for (const r of bySourceResults) bySource[r._id] = r.count;

    return { total, verified, byChain, byConfidence, bySource };
  }
}
