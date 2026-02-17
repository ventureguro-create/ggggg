/**
 * Twitter Confidence Score Module
 * 
 * PHASE 4.1.6 — Twitter Confidence Score v1.0
 * 
 * Purpose:
 * Answer the question: "How much can we trust this Twitter data?"
 * 
 * NOT to be confused with:
 * - Influence score
 * - Popularity
 * - Account rating
 * 
 * This module:
 * - Does NOT directly affect Twitter Score
 * - DOES affect data trust weight
 * - DOES control dampening / warnings / admin decisions
 * - IS explainable and transparent
 * - WORKS in dry-run and live modes
 */

export * from './contracts/index.js';
export * from './core/index.js';
export { 
  registerTwitterConfidenceRoutes, 
  registerTwitterConfidenceAdminRoutes 
} from './api/index.js';
