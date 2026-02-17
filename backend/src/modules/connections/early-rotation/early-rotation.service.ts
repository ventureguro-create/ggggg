/**
 * БЛОК 13 — Early Rotation Predictor Service
 */

import { Db } from 'mongodb';
import { EarlyRotation, ERPClass, ClusterTensionInput, TensionNotes } from './early-rotation.types.js';

const COLLECTION = 'early_rotations';

export class EarlyRotationService {
  constructor(private db: Db) {}

  /**
   * Calculate Tension Score for a cluster
   * TS = 0.25*vol_compression + 0.25*opp_density + 0.20*oi_divergence + 0.20*funding_extreme + 0.10*failed_breakouts
   */
  calculateTensionScore(input: ClusterTensionInput): number {
    const volCompression = Math.max(0, Math.min(1, input.volatilityCompression));
    const oppDensity = Math.max(0, Math.min(1, input.opportunityDensityTrend / 100)); // normalize
    const oiDivergence = input.oiSlope > 0 && input.momentumSlope <= 0 ? Math.min(1, input.oiSlope * 10) : 0;
    const fundingExtreme = Math.min(1, Math.abs(input.fundingBias) * 20); // extreme if > 0.05
    const failedBreakoutsScore = Math.min(1, input.failedBreakouts / 5);

    return (
      0.25 * volCompression +
      0.25 * oppDensity +
      0.20 * oiDivergence +
      0.20 * fundingExtreme +
      0.10 * failedBreakoutsScore
    );
  }

  /**
   * Calculate Early Rotation Probability
   * ERP = 0.5*TS(B) + 0.3*decay(A) + 0.2*opportunity_shift
   */
  calculateERP(
    tensionTo: number,
    decayFrom: number,
    opportunityShift: number
  ): number {
    return (
      0.5 * Math.max(0, Math.min(1, tensionTo)) +
      0.3 * Math.max(0, Math.min(1, decayFrom)) +
      0.2 * Math.max(0, Math.min(1, opportunityShift))
    );
  }

  classifyERP(erp: number): ERPClass {
    if (erp >= 0.75) return 'IMMINENT';
    if (erp >= 0.6) return 'BUILDING';
    if (erp >= 0.45) return 'WATCH';
    return 'IGNORE';
  }

  buildNotes(input: ClusterTensionInput): TensionNotes {
    return {
      volatility: input.volatilityCompression > 0.6 ? 'compressed' : 
                  input.volatilityCompression < 0.3 ? 'expanding' : 'normal',
      funding: input.fundingBias > 0.03 ? 'positive_extreme' :
               input.fundingBias < -0.03 ? 'negative_extreme' : 'neutral',
      opportunityGrowth: `${input.opportunityDensityTrend >= 0 ? '+' : ''}${input.opportunityDensityTrend.toFixed(0)}%`,
      failedBreakouts: input.failedBreakouts,
    };
  }

  async detectRotation(
    fromCluster: ClusterTensionInput,
    toCluster: ClusterTensionInput,
    window: '1h' | '4h' | '24h' = '24h'
  ): Promise<EarlyRotation | null> {
    const tensionTo = this.calculateTensionScore(toCluster);
    const decayFrom = fromCluster.momentumSlope < 0 ? Math.abs(fromCluster.momentumSlope) * 5 : 0;
    const oppShift = (toCluster.opportunityDensityTrend - fromCluster.opportunityDensityTrend) / 100;

    const erp = this.calculateERP(tensionTo, decayFrom, oppShift);
    const erpClass = this.classifyERP(erp);

    if (erpClass === 'IGNORE') return null;

    const rotation: EarlyRotation = {
      fromCluster: fromCluster.clusterId,
      toCluster: toCluster.clusterId,
      erp,
      class: erpClass,
      tensionScore: tensionTo,
      window,
      notes: this.buildNotes(toCluster),
      timestamp: new Date(),
      createdAt: new Date(),
    };

    await this.db.collection(COLLECTION).insertOne(rotation);
    return rotation;
  }

  async getActiveRotations(minClass: ERPClass = 'WATCH'): Promise<EarlyRotation[]> {
    const classOrder: ERPClass[] = ['IMMINENT', 'BUILDING', 'WATCH', 'IGNORE'];
    const minIndex = classOrder.indexOf(minClass);
    const validClasses = classOrder.slice(0, minIndex + 1);

    return this.db.collection<EarlyRotation>(COLLECTION)
      .find({
        class: { $in: validClasses },
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      })
      .sort({ erp: -1 })
      .toArray();
  }

  async getRotationHistory(limit = 50): Promise<EarlyRotation[]> {
    return this.db.collection<EarlyRotation>(COLLECTION)
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}
