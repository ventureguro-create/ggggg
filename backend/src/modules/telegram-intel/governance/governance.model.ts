/**
 * Governance Models - Scoring Config & Overrides
 * Phase 4: Explainability + Governance
 */
import mongoose, { Schema } from 'mongoose';

// Versioned Scoring Config
const TgScoringConfigSchema = new Schema(
  {
    key: { type: String, index: true }, // "intel_v1"
    version: { type: Number, index: true },
    isActive: { type: Boolean, default: false, index: true },
    payload: Schema.Types.Mixed,
    createdBy: String,
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true, collection: 'tg_scoring_configs' }
);

TgScoringConfigSchema.index({ key: 1, version: 1 }, { unique: true });

export const TgScoringConfigModel =
  mongoose.models.TgScoringConfig ||
  mongoose.model('TgScoringConfig', TgScoringConfigSchema);

// Governance Overrides
const TgOverridesSchema = new Schema(
  {
    username: { type: String, index: true, unique: true },
    status: {
      type: String,
      enum: ['NORMAL', 'ALLOWLIST', 'BLOCKLIST'],
      default: 'NORMAL',
      index: true,
    },
    forcedTier: { type: String, default: null },
    forcedScore: { type: Number, default: null },
    fraudRiskOverride: { type: Number, default: null },
    penaltyMultiplier: { type: Number, default: null },
    notes: { type: String, default: '' },
    updatedBy: String,
    updatedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true, collection: 'tg_overrides' }
);

export const TgOverridesModel =
  mongoose.models.TgOverrides || mongoose.model('TgOverrides', TgOverridesSchema);

// Default config
export const DEFAULT_INTEL_CONFIG = {
  key: 'intel_v1',
  version: 1,
  weights: { base: 0.40, alpha: 0.25, cred: 0.25, netAlpha: 0.10 },
  fraud: { killSwitch: 0.75, penaltyBase: 0.20, penaltyScale: 0.60 },
  lowCred: { pivot: 55, scale: 80 },
  lowSamplePenalty: 0.25,
  credibility: { halfLifeDays: 21 },
  tiers: { S: 92, A: 80, B: 65, C: 45 },
  netAlpha: {
    credGateBase: 0.25,
    credGateScale: 0.75,
    lowNetAlphaPivot: 25,
    lowNetAlphaPenaltyMax: 0.08,
  },
};
