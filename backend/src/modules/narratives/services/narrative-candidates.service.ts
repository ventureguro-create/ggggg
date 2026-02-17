/**
 * БЛОК 17 — Narrative Candidates Service
 * Narrative → Price Binding + Candidates
 */

import { Db } from 'mongodb';
import { NarrativeService } from './narrative.service.js';

export interface NarrativeCandidate {
  symbol: string;
  candidateScore: number;
  socialWeight: number;
  exchangeSetup: number;
  fundingRate: number | null;
  narratives: { key: string; nms: number; weight: number }[];
  price: number | null;
  ts: Date | null;
}

export class NarrativeCandidatesService {
  private narrativeService: NarrativeService;

  constructor(private db: Db) {
    this.narrativeService = new NarrativeService(db);
  }

  /**
   * Build narrative candidates based on emerging narratives
   * CandidateScore = 0.55*NMS + 0.25*ExchangeSetup + 0.20*FundingEdge
   */
  async buildCandidates(params: { window?: string; limit?: number } = {}): Promise<NarrativeCandidate[]> {
    const { limit = 30 } = params;

    // 1) Get top emerging narratives
    const topNarratives = await this.narrativeService.getTopNarratives(['SEEDING', 'IGNITION'], 15);
    if (topNarratives.length === 0) {
      return [];
    }

    // 2) Get bindings for these narratives
    const keys = topNarratives.map(n => n.key);
    const bindings = await this.db.collection('narrative_bindings')
      .find({ narrativeKey: { $in: keys } })
      .toArray();

    // 3) Group by symbol
    const bySymbol = new Map<string, { social: number; narratives: any[] }>();
    for (const b of bindings) {
      const n = topNarratives.find(x => x.key === (b as any).narrativeKey);
      if (!n) continue;

      const prev = bySymbol.get((b as any).symbol) || { social: 0, narratives: [] };
      prev.social += (n.nms ?? 0) * ((b as any).weight ?? 0);
      prev.narratives.push({ key: n.key, nms: n.nms, weight: (b as any).weight });
      bySymbol.set((b as any).symbol, prev);
    }

    // 4) Get exchange snapshots
    const symbols = [...bySymbol.keys()];
    if (symbols.length === 0) {
      return [];
    }

    const snapshots = await this.db.collection('exchange_observations')
      .aggregate([
        { $match: { symbol: { $in: symbols } } },
        { $sort: { ts: -1 } },
        { $group: { _id: '$symbol', doc: { $first: '$$ROOT' } } },
      ])
      .toArray();

    // 5) Calculate scores
    const candidates: NarrativeCandidate[] = [];
    
    for (const s of snapshots) {
      const symbolData = bySymbol.get(s._id as string);
      if (!symbolData) continue;

      const socialWeight = this.clamp01(symbolData.social);
      const exchangeSetup = this.clamp01((s.doc as any).exchangeSetupScore ?? 0.5);
      const fundingRate = (s.doc as any).fundingRate ?? null;
      const fundingEdge = this.clamp01(Math.abs(this.fundingScore(fundingRate)));

      const candidateScore =
        0.55 * socialWeight +
        0.25 * exchangeSetup +
        0.20 * fundingEdge;

      candidates.push({
        symbol: s._id as string,
        candidateScore,
        socialWeight,
        exchangeSetup,
        fundingRate,
        narratives: symbolData.narratives,
        price: (s.doc as any).price ?? null,
        ts: (s.doc as any).ts ?? null,
      });
    }

    // Also add symbols without exchange data
    for (const [symbol, data] of bySymbol) {
      if (!candidates.find(c => c.symbol === symbol)) {
        candidates.push({
          symbol,
          candidateScore: this.clamp01(data.social) * 0.55,
          socialWeight: this.clamp01(data.social),
          exchangeSetup: 0,
          fundingRate: null,
          narratives: data.narratives,
          price: null,
          ts: null,
        });
      }
    }

    candidates.sort((a, b) => b.candidateScore - a.candidateScore);
    return candidates.slice(0, limit);
  }

  private fundingScore(fundingRate: number | null): number {
    if (fundingRate === null) return 0;
    const x = Math.max(-0.0005, Math.min(0.0005, fundingRate));
    return x / 0.0005;
  }

  private clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
  }
}
