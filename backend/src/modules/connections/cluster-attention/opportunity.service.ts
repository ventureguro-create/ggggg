/**
 * БЛОК 7 - Opportunity Ranking Service
 * БЛОК 8 - Exchange Feedback Loop
 * БЛОК 9 - Market State Attribution
 * БЛОК 10 - Alt Season Probability
 * 
 * Advanced analysis: opportunities, market state, alt season detection
 */

import { Db } from 'mongodb';
import { TokenMomentum } from './cluster.types.js';

// ============================
// Types for БЛОК 7-10
// ============================

export type OpportunityPhase = 'EARLY' | 'MID' | 'LATE';
export type ExchangeBias = 'BULL' | 'NEUTRAL' | 'BEAR';
export type MarketTag = 'ALT_FRIENDLY' | 'ALT_NEUTRAL' | 'ALT_HOSTILE';
export type AltSeasonLevel = 'BTC_ONLY' | 'NEUTRAL' | 'PRE_ALT' | 'ALT_SEASON';

export interface Opportunity {
  symbol: string;
  opportunityScore: number;
  momentumScore: number;
  phase: OpportunityPhase;
  clusters: number;
  exchangeBias: ExchangeBias;
  volatility: number;
  earlyPhaseBonus: number;
  reasons: string[];
  updatedAt: Date;
}

export interface OpportunityOutcome {
  symbol: string;
  opportunityScore: number;
  phase: OpportunityPhase;
  horizon: string;
  normalizedOutcome: number;
  label: 'STRONG_HIT' | 'FALSE_SIGNAL' | 'MISSED_OPPORTUNITY' | 'NEUTRAL';
  exchangeRegime: string;
  createdAt: Date;
}

export interface MarketStateAttribution {
  window: string;
  tag: MarketTag;
  factors: {
    funding: number;
    oiChange: number;
    dominance: number;
    volumeImpulse: number;
    volatility: number;
  };
  confidence: number;
  sampleSize: number;
  updatedAt: Date;
}

export interface AltSeasonState {
  window: string;
  asp: number;           // Alt Season Probability
  level: AltSeasonLevel;
  components: {
    hitRatio: number;
    breadth: number;
    marketFriendliness: number;
    btcDominanceTrend: number;
    fundingBalance: number;
  };
  confidence: number;
  sampleSize: number;
  updatedAt: Date;
}

export class OpportunityService {
  private db: Db | null = null;

  setDb(db: Db) {
    this.db = db;
  }

  // ============================
  // БЛОК 7 - Opportunity Ranking
  // ============================

  /**
   * Compute opportunity scores for all tokens
   */
  async computeOpportunities(): Promise<Opportunity[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Get token momentum
    const tokenMomentum = await this.db.collection('token_momentum')
      .find({})
      .toArray() as TokenMomentum[];

    // Get market state
    const marketState = await this.getMarketState();
    
    // Get alt season probability
    const aspState = await this.getAltSeasonState();
    const asp = aspState?.asp || 0.5;

    const opportunities: Opportunity[] = [];

    for (const tm of tokenMomentum) {
      // Calculate phase (EARLY, MID, LATE)
      const phase = this.determinePhase(tm);
      
      // Early phase bonus
      const earlyPhaseBonus = phase === 'EARLY' ? 0.3 : phase === 'MID' ? 0.15 : 0;
      
      // Cluster diversity
      const clusterDiversity = Math.min(tm.activeClusters / 5, 1); // Normalize to max 5 clusters
      
      // Exchange confirmation (mock - will connect to Exchange Layer)
      const exchangeConfirmation = marketState?.tag === 'ALT_FRIENDLY' ? 0.8 : 
                                   marketState?.tag === 'ALT_NEUTRAL' ? 0.5 : 0.2;
      
      // Volatility fit (prefer moderate volatility)
      const volatility = 0.03; // Mock - 3%
      const volatilityFit = 1 - Math.abs(volatility - 0.025) / 0.025; // Ideal around 2.5%
      
      // Risk penalty (low for now)
      const riskPenalty = 1.0;

      // Final opportunity score
      const opportunityScore = Math.min(1, Math.max(0,
        0.40 * tm.score +
        0.20 * earlyPhaseBonus +
        0.15 * clusterDiversity +
        0.15 * exchangeConfirmation +
        0.10 * volatilityFit
      )) * riskPenalty;

      // Generate reasons
      const reasons: string[] = [];
      if (tm.score > 0.5) reasons.push('Strong cluster momentum');
      if (phase === 'EARLY') reasons.push('Early phase - not yet crowded');
      if (clusterDiversity > 0.5) reasons.push('Multiple clusters involved');
      if (marketState?.tag === 'ALT_FRIENDLY') reasons.push('ALT_FRIENDLY market');

      opportunities.push({
        symbol: tm.symbol,
        opportunityScore,
        momentumScore: tm.score,
        phase,
        clusters: tm.activeClusters,
        exchangeBias: marketState?.tag === 'ALT_FRIENDLY' ? 'BULL' : 
                      marketState?.tag === 'ALT_HOSTILE' ? 'BEAR' : 'NEUTRAL',
        volatility,
        earlyPhaseBonus,
        reasons,
        updatedAt: new Date(),
      });
    }

    // Sort by score
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Save to database
    for (const opp of opportunities) {
      await this.db.collection('token_opportunities').updateOne(
        { symbol: opp.symbol },
        { $set: opp },
        { upsert: true }
      );
    }

    console.log(`[Opportunity] Computed ${opportunities.length} opportunities`);
    return opportunities;
  }

  private determinePhase(tm: TokenMomentum): OpportunityPhase {
    // Based on momentum and confirmation
    if (tm.score < 0.4) return 'EARLY';
    if (tm.score < 0.7) return 'MID';
    return 'LATE';
  }

  /**
   * Get top opportunities
   */
  async getTopOpportunities(phase?: OpportunityPhase): Promise<Opportunity[]> {
    if (!this.db) return [];
    
    const query = phase ? { phase } : {};
    return this.db.collection('token_opportunities')
      .find(query)
      .sort({ opportunityScore: -1 })
      .limit(20)
      .toArray() as Promise<Opportunity[]>;
  }

  // ============================
  // БЛОК 8 - Exchange Feedback Loop
  // ============================

  /**
   * Record outcome of an opportunity
   */
  async recordOutcome(
    symbol: string,
    priceChange: number,
    horizon: string = '4h'
  ): Promise<OpportunityOutcome> {
    if (!this.db) throw new Error('Database not initialized');

    // Get the opportunity
    const opp = await this.db.collection('token_opportunities')
      .findOne({ symbol: symbol.toUpperCase() }) as Opportunity | null;

    if (!opp) {
      throw new Error('Opportunity not found');
    }

    // Calculate normalized outcome
    const expectedMove = 0.05; // 5% expected
    const normalizedOutcome = priceChange / expectedMove;

    // Determine label
    let label: OpportunityOutcome['label'] = 'NEUTRAL';
    if (opp.opportunityScore > 0.7 && normalizedOutcome > 1.0) {
      label = 'STRONG_HIT';
    } else if (opp.opportunityScore > 0.7 && normalizedOutcome < -0.5) {
      label = 'FALSE_SIGNAL';
    } else if (opp.opportunityScore < 0.4 && normalizedOutcome > 1.0) {
      label = 'MISSED_OPPORTUNITY';
    }

    const outcome: OpportunityOutcome = {
      symbol: symbol.toUpperCase(),
      opportunityScore: opp.opportunityScore,
      phase: opp.phase,
      horizon,
      normalizedOutcome,
      label,
      exchangeRegime: opp.exchangeBias,
      createdAt: new Date(),
    };

    await this.db.collection('opportunity_outcomes').insertOne(outcome);
    console.log(`[Feedback] Recorded outcome for ${symbol}: ${label}`);

    return outcome;
  }

  /**
   * Get outcome statistics
   */
  async getOutcomeStats(): Promise<{
    hitRate: number;
    falseSignalRate: number;
    missedRate: number;
    total: number;
  }> {
    if (!this.db) return { hitRate: 0, falseSignalRate: 0, missedRate: 0, total: 0 };

    const outcomes = await this.db.collection('opportunity_outcomes').find({}).toArray();
    const total = outcomes.length;
    
    if (total === 0) {
      return { hitRate: 0, falseSignalRate: 0, missedRate: 0, total: 0 };
    }

    const hits = outcomes.filter(o => o.label === 'STRONG_HIT').length;
    const false_signals = outcomes.filter(o => o.label === 'FALSE_SIGNAL').length;
    const missed = outcomes.filter(o => o.label === 'MISSED_OPPORTUNITY').length;

    return {
      hitRate: hits / total,
      falseSignalRate: false_signals / total,
      missedRate: missed / total,
      total,
    };
  }

  // ============================
  // БЛОК 9 - Market State Attribution
  // ============================

  /**
   * Compute market state
   */
  async computeMarketState(): Promise<MarketStateAttribution> {
    if (!this.db) throw new Error('Database not initialized');

    // Get recent outcomes
    const outcomes = await this.db.collection('opportunity_outcomes')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Mock market factors (will connect to Exchange Layer)
    const factors = {
      funding: (Math.random() - 0.5) * 0.02,  // -1% to +1%
      oiChange: (Math.random() - 0.5) * 10,    // -5% to +5%
      dominance: (Math.random() - 0.5) * 2,    // BTC dominance change
      volumeImpulse: Math.random(),            // 0-1
      volatility: 0.02 + Math.random() * 0.02, // 2-4%
    };

    // Calculate hit ratio from recent outcomes
    const hits = outcomes.filter(o => o.label === 'STRONG_HIT').length;
    const hitRatio = outcomes.length > 0 ? hits / outcomes.length : 0.5;

    // Determine market tag
    let tag: MarketTag = 'ALT_NEUTRAL';
    let confidence = 0.5;

    if (hitRatio > 0.6 && factors.funding < 0 && factors.dominance < 0) {
      tag = 'ALT_FRIENDLY';
      confidence = 0.7 + hitRatio * 0.2;
    } else if (hitRatio < 0.3 || factors.dominance > 1) {
      tag = 'ALT_HOSTILE';
      confidence = 0.7 - hitRatio * 0.2;
    }

    const state: MarketStateAttribution = {
      window: '24h',
      tag,
      factors,
      confidence,
      sampleSize: outcomes.length,
      updatedAt: new Date(),
    };

    await this.db.collection('market_state_attribution').updateOne(
      { window: '24h' },
      { $set: state },
      { upsert: true }
    );

    console.log(`[MarketState] Computed: ${tag} (${(confidence * 100).toFixed(0)}%)`);
    return state;
  }

  async getMarketState(): Promise<MarketStateAttribution | null> {
    if (!this.db) return null;
    return this.db.collection('market_state_attribution')
      .findOne({ window: '24h' }) as Promise<MarketStateAttribution | null>;
  }

  // ============================
  // БЛОК 10 - Alt Season Probability
  // ============================

  /**
   * Compute alt season probability
   */
  async computeAltSeasonProbability(): Promise<AltSeasonState> {
    if (!this.db) throw new Error('Database not initialized');

    // Get outcome stats
    const stats = await this.getOutcomeStats();
    
    // Get market state
    const marketState = await this.getMarketState();
    
    // Get active opportunities
    const opportunities = await this.db.collection('token_opportunities')
      .find({ opportunityScore: { $gt: 0.3 } })
      .toArray();

    // Calculate components
    const hitRatio = stats.hitRate;
    
    // Breadth: unique assets with activity
    const totalTracked = await this.db.collection('token_momentum').countDocuments();
    const breadth = totalTracked > 0 ? opportunities.length / totalTracked : 0;
    
    // Market friendliness from attribution
    const marketFriendliness = marketState?.tag === 'ALT_FRIENDLY' ? 0.8 :
                               marketState?.tag === 'ALT_NEUTRAL' ? 0.5 : 0.2;
    
    // BTC dominance trend (mock)
    const btcDominanceTrend = (Math.random() - 0.5) * 2;
    
    // Funding balance (mock)
    const fundingBalance = Math.random() * 0.1 - 0.05;

    // Calculate ASP
    const asp = Math.min(1, Math.max(0,
      0.30 * hitRatio +
      0.20 * breadth +
      0.20 * marketFriendliness +
      0.15 * (1 - Math.min(Math.abs(btcDominanceTrend), 1)) + // Lower dominance = better
      0.15 * (0.5 - Math.abs(fundingBalance) * 10) // Neutral funding is best
    ));

    // Determine level
    let level: AltSeasonLevel = 'NEUTRAL';
    if (asp >= 0.7) level = 'ALT_SEASON';
    else if (asp >= 0.45) level = 'PRE_ALT';
    else if (asp < 0.25) level = 'BTC_ONLY';

    const state: AltSeasonState = {
      window: '24h',
      asp,
      level,
      components: {
        hitRatio,
        breadth,
        marketFriendliness,
        btcDominanceTrend,
        fundingBalance,
      },
      confidence: 0.6 + asp * 0.3,
      sampleSize: stats.total,
      updatedAt: new Date(),
    };

    await this.db.collection('alt_season_state').updateOne(
      { window: '24h' },
      { $set: state },
      { upsert: true }
    );

    console.log(`[AltSeason] ASP: ${(asp * 100).toFixed(0)}% (${level})`);
    return state;
  }

  async getAltSeasonState(): Promise<AltSeasonState | null> {
    if (!this.db) return null;
    return this.db.collection('alt_season_state')
      .findOne({ window: '24h' }) as Promise<AltSeasonState | null>;
  }
}

export const opportunityService = new OpportunityService();
