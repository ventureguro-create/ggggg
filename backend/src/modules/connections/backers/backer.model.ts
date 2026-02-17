/**
 * Backer Model - MongoDB Schema
 * 
 * Collections:
 * - connections_backers: Main backer entities
 * - connections_backer_bindings: Backer ↔ Target bindings
 * - connections_backer_audit: Audit log
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { 
  BackerEntity, 
  BackerBinding,
  BackerType,
  BackerCategory,
  SeedSource,
  BackerStatus,
  BackerBindingType,
  BindingTargetType,
  AccountCategory,
  AccountSubtype
} from './backer.types.js';

// ============================================================
// BACKER SCHEMA
// ============================================================

export interface BackerDocument extends Omit<BackerEntity, 'id'>, Document {}

const BackerSchema = new Schema<BackerDocument>({
  slug: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true },
  description: String,
  
  type: { 
    type: String, 
    required: true,
    enum: ['FUND', 'PROJECT', 'DAO', 'ECOSYSTEM', 'COMPANY'],
  },
  categories: [{
    type: String,
    enum: ['DEFI', 'INFRA', 'NFT', 'TRADING', 'GAMING', 'SECURITY', 'LAYER1', 'LAYER2', 'SOCIAL', 'DATA', 'ORACLE'],
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'],
    default: 'ACTIVE',
  },
  
  seedAuthority: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100,
  },
  confidence: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1,
  },
  source: {
    type: String,
    required: true,
    enum: ['MANUAL', 'CURATED', 'EXTERNAL'],
  },
  
  externalRefs: {
    website: String,
    coingecko: String,
    defillama: String,
    crunchbase: String,
    github: String,
  },
  
  // Phase 2: Account Taxonomy
  taxonomy: {
    category: {
      type: String,
      enum: ['VC_FUND', 'HEDGE_FUND', 'PROTOCOL', 'EXCHANGE', 'INFLUENCER', 
             'MEDIA', 'BUILDER', 'WHALE', 'SERVICE', 'DAO', 'FOUNDATION'],
    },
    subtype: {
      type: String,
      enum: ['TIER1_VC', 'TIER2_VC', 'ANGEL', 'CORPORATE_VC',
             'L1_CHAIN', 'L2_CHAIN', 'DEFI_BLUE_CHIP', 'DEFI_EMERGING',
             'NFT_PLATFORM', 'GAMING_PLATFORM',
             'CRYPTO_NATIVE', 'TRADFI_CROSSOVER', 'TECH_FOUNDER', 'RESEARCHER',
             'CEX_MAJOR', 'CEX_REGIONAL', 'DEX',
             'AGGREGATOR', 'ORACLE', 'BRIDGE', 'CUSTODIAN', 'UNCLASSIFIED'],
    },
    confidence: { type: Number, default: 1.0, min: 0, max: 1 },
    source: { type: String, enum: ['MANUAL', 'AI_SUGGESTED', 'INFERRED'], default: 'MANUAL' },
    suggestedAt: Date,
    confirmedAt: Date,
    confirmedBy: String,
  },
  
  frozen: { type: Boolean, default: false },
  frozenAt: Date,
  frozenBy: String,
  
  createdBy: String,
}, { 
  timestamps: true,
  collection: 'connections_backers',
});

// Indexes
BackerSchema.index({ type: 1 });
BackerSchema.index({ categories: 1 });
BackerSchema.index({ status: 1 });
BackerSchema.index({ seedAuthority: -1 });
BackerSchema.index({ frozen: 1 });
BackerSchema.index({ name: 'text', description: 'text' });
// Phase 2: Taxonomy indexes
BackerSchema.index({ 'taxonomy.category': 1 });
BackerSchema.index({ 'taxonomy.subtype': 1 });

export const BackerModel = mongoose.model<BackerDocument>('Backer', BackerSchema);

// ============================================================
// BACKER BINDING SCHEMA
// ============================================================

export interface BackerBindingDocument extends Omit<BackerBinding, 'id'>, Document {}

const BackerBindingSchema = new Schema<BackerBindingDocument>({
  backerId: { type: String, required: true, index: true },
  
  targetType: {
    type: String,
    required: true,
    enum: ['TWITTER', 'ACTOR'],
  },
  targetId: { type: String, required: true },
  targetHandle: String,
  
  relation: {
    type: String,
    required: true,
    enum: ['OWNER', 'INVESTOR', 'BUILDER', 'AFFILIATED', 'ECOSYSTEM'],
  },
  weight: {
    type: Number,
    default: 1.0,
    min: 0.1,
    max: 1.0,
  },
  
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  
  createdBy: String,
}, {
  timestamps: true,
  collection: 'connections_backer_bindings',
});

// Indexes
BackerBindingSchema.index({ backerId: 1, targetId: 1 }, { unique: true });
BackerBindingSchema.index({ targetType: 1, targetId: 1 });
BackerBindingSchema.index({ relation: 1 });

export const BackerBindingModel = mongoose.model<BackerBindingDocument>('BackerBinding', BackerBindingSchema);

// ============================================================
// AUDIT LOG SCHEMA
// ============================================================

export interface BackerAuditDocument extends Document {
  backerId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FREEZE' | 'UNFREEZE' | 'BIND' | 'UNBIND';
  changes: Record<string, any>;
  performedBy: string;
  performedAt: Date;
}

const BackerAuditSchema = new Schema<BackerAuditDocument>({
  backerId: { type: String, required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'FREEZE', 'UNFREEZE', 'BIND', 'UNBIND'],
  },
  changes: Schema.Types.Mixed,
  performedBy: { type: String, required: true },
  performedAt: { type: Date, default: Date.now },
}, {
  collection: 'connections_backer_audit',
});

BackerAuditSchema.index({ performedAt: -1 });

export const BackerAuditModel = mongoose.model<BackerAuditDocument>('BackerAudit', BackerAuditSchema);

console.log('[Backers] Models registered');
