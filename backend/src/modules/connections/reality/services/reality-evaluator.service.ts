/**
 * Reality Evaluator Service
 * 
 * PHASE B: Evaluates neutral events against on-chain reality.
 * 
 * KEY PRINCIPLE: On-chain NEVER "amplifies" Twitter.
 * It can ONLY confirm or destroy trust.
 */

import { NeutralEvent } from '../contracts/neutral-event.types.js';
import { RealityLedgerEntry, RealityVerdict } from '../contracts/reality-ledger.types.js';
import { RealityLedgerStore } from '../storage/reality-ledger.store.js';
import { OnchainAdapterService } from '../../adapters/onchain/services/onchain-adapter.service.js';
import { OnchainVerdict } from '../../adapters/onchain/contracts/onchain.types.js';

export class RealityEvaluatorService {
  constructor(
    private readonly ledger: RealityLedgerStore,
    private readonly onchain: OnchainAdapterService
  ) {}

  private mapVerdict(v: OnchainVerdict): RealityVerdict {
    if (v === 'CONFIRMS') return 'CONFIRMED';
    if (v === 'CONTRADICTS') return 'CONTRADICTED';
    return 'NO_DATA';
  }

  private computeFinal(
    verdict: RealityVerdict,
    confidence: number
  ): { trust_multiplier_0_1: number; blocked: boolean; reason?: string } {
    if (verdict === 'CONFIRMED') {
      // On-chain confirms Twitter signal - slight boost to trust
      return { trust_multiplier_0_1: Math.min(1.2, 1 + confidence * 0.3), blocked: false };
    }
    if (verdict === 'CONTRADICTED') {
      // On-chain contradicts - significant penalty, may block
      return {
        trust_multiplier_0_1: Math.max(0.3, 0.7 - confidence * 0.4),
        blocked: confidence > 0.6,
        reason: 'ONCHAIN_CONTRADICTS',
      };
    }
    // NO_DATA - neutral, slight penalty for uncertainty
    return { trust_multiplier_0_1: 0.85, blocked: false, reason: 'NO_DATA' };
  }

  async evaluate(event: NeutralEvent): Promise<RealityLedgerEntry> {
    const evaluatedAt = new Date().toISOString();

    // If no asset, we can't evaluate on-chain
    if (!event.asset) {
      const entry: RealityLedgerEntry = {
        eventId: event.eventId,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        evaluatedAt,
        onchain: {
          verdict: 'NO_DATA',
          confidence_0_1: 0,
          snapshots: [],
        },
        final: { trust_multiplier_0_1: 1, blocked: false, reason: 'NO_ASSET' },
      };
      await this.ledger.upsert(entry);
      return entry;
    }

    // Resolve on-chain in multiple time windows
    const t0 = event.occurredAt;
    const t4h = new Date(new Date(t0).getTime() + 4 * 3600e3).toISOString();
    const t24h = new Date(new Date(t0).getTime() + 24 * 3600e3).toISOString();

    const res = await this.onchain.resolve({
      asset: event.asset,
      eventTimestamp: t0,
      windows: [
        { from: t0, to: t0, label: 'T0' },
        { from: t0, to: t4h, label: 'T+4h' },
        { from: t0, to: t24h, label: 'T+24h' },
      ],
    });

    // Use latest window for final verdict
    const strongest = res.snapshots[res.snapshots.length - 1] || res.snapshots[0];
    const verdict = strongest ? this.mapVerdict(strongest.verdict) : 'NO_DATA';
    const confidence = strongest?.confidence_0_1 ?? 0;
    const final = this.computeFinal(verdict, confidence);

    // Extract window verdicts
    const windows: RealityLedgerEntry['windows'] = {};
    for (const snap of res.snapshots) {
      const label = snap.window?.to === t0 ? 't0' 
                  : snap.window?.to === t4h ? 't4h' 
                  : snap.window?.to === t24h ? 't24h' 
                  : undefined;
      if (label) {
        (windows as any)[label] = this.mapVerdict(snap.verdict);
      }
    }

    const entry: RealityLedgerEntry = {
      eventId: event.eventId,
      asset: event.asset,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
      evaluatedAt,
      onchain: {
        verdict,
        confidence_0_1: confidence,
        snapshots: res.snapshots,
      },
      windows,
      final,
    };

    await this.ledger.upsert(entry);
    return entry;
  }
}
