/**
 * Impact Store - PHASE C2
 * MongoDB operations for impact metrics calculation
 */

import type { Db, Collection } from 'mongodb';
import type { ImpactMetrics, RealityStats, AgreementStats } from './impact.types.js';

const AUDIT_COLLECTION = 'connections_alert_audit';
const FEEDBACK_COLLECTION = 'connections_feedback';

let auditCollection: Collection | null = null;
let feedbackCollection: Collection | null = null;

const WINDOW_MS: Record<string, number> = {
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
  '90d': 90 * 24 * 3600 * 1000,
};

/**
 * Initialize impact store with MongoDB db instance
 */
export function initImpactStore(db: Db): void {
  auditCollection = db.collection(AUDIT_COLLECTION);
  feedbackCollection = db.collection(FEEDBACK_COLLECTION);
  
  // Create indexes for efficient queries
  auditCollection.createIndex({ createdAt: -1 }).catch(() => {});
  auditCollection.createIndex({ alertId: 1 }, { unique: true, sparse: true }).catch(() => {});
  auditCollection.createIndex({ 'ml2.mode': 1, createdAt: -1 }).catch(() => {});
  auditCollection.createIndex({ 'ml2.applied': 1, createdAt: -1 }).catch(() => {});
  auditCollection.createIndex({ 'reality.verdict': 1, createdAt: -1 }).catch(() => {});
  
  console.log('[ML2/Impact] Store initialized');
}

function getAuditCollection(): Collection {
  if (!auditCollection) {
    throw new Error('Impact store not initialized. Call initImpactStore first.');
  }
  return auditCollection;
}

function getFeedbackCollection(): Collection {
  if (!feedbackCollection) {
    throw new Error('Impact store not initialized. Call initImpactStore first.');
  }
  return feedbackCollection;
}

/**
 * Get ML2 impact metrics for a time window
 */
export async function getImpactMetrics(window: string = '7d'): Promise<ImpactMetrics> {
  const auditCol = getAuditCollection();
  const feedbackCol = getFeedbackCollection();
  
  const since = new Date(Date.now() - (WINDOW_MS[window] || WINDOW_MS['7d']));
  
  // Main impact aggregation from audit logs
  const [impactResult] = await auditCol.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $addFields: {
        finalDecision: {
          $cond: [
            { $and: [
              { $eq: ['$ml2.applied', true] },
              { $ne: ['$ml2.decision', null] }
            ]},
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$ml2.decision', 'SUPPRESS'] }, then: 'SUPPRESS' },
                  { case: { $eq: ['$ml2.decision', 'DOWNGRADE'] }, then: 'SEND_LOW_PRIORITY' },
                  { case: { $eq: ['$ml2.decision', 'SEND'] }, then: 'SEND' },
                ],
                default: '$policyDecision',
              }
            },
            '$policyDecision'
          ]
        }
      }
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalAlerts: { $sum: 1 },
              sentBeforeMl: { $sum: { $cond: [{ $eq: ['$policyDecision', 'SEND'] }, 1, 0] } },
              sentAfterMl: { $sum: { $cond: [{ $eq: ['$finalDecision', 'SEND'] }, 1, 0] } },
              lowPriorityAfterMl: { $sum: { $cond: [{ $eq: ['$finalDecision', 'SEND_LOW_PRIORITY'] }, 1, 0] } },
              suppressedAfterMl: { $sum: { $cond: [{ $eq: ['$finalDecision', 'SUPPRESS'] }, 1, 0] } },
              suppressedByMl: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $eq: ['$ml2.applied', true] },
                      { $eq: ['$ml2.decision', 'SUPPRESS'] }
                    ]},
                    1, 0
                  ]
                }
              },
              downgradedByMl: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $eq: ['$ml2.applied', true] },
                      { $eq: ['$ml2.decision', 'DOWNGRADE'] }
                    ]},
                    1, 0
                  ]
                }
              },
            }
          }
        ],
        reality: [
          { $match: { finalDecision: { $in: ['SEND', 'SEND_LOW_PRIORITY'] } } },
          { $group: { _id: '$reality.verdict', count: { $sum: 1 } } }
        ]
      }
    }
  ]).toArray();
  
  // Agreement rate calculation (join with feedback)
  const [agreementResult] = await auditCol.aggregate([
    { $match: { createdAt: { $gte: since }, 'ml2.applied': true } },
    {
      $lookup: {
        from: FEEDBACK_COLLECTION,
        localField: 'alertId',
        foreignField: 'alertId',
        as: 'fb'
      }
    },
    { $unwind: { path: '$fb', preserveNullAndEmptyArrays: false } },
    { $match: { 'fb.action': { $in: ['CORRECT', 'FALSE_POSITIVE'] } } },
    {
      $group: {
        _id: null,
        totalRated: { $sum: 1 },
        correct: { $sum: { $cond: [{ $eq: ['$fb.action', 'CORRECT'] }, 1, 0] } },
        falsePositive: { $sum: { $cond: [{ $eq: ['$fb.action', 'FALSE_POSITIVE'] }, 1, 0] } },
      }
    },
    {
      $addFields: {
        agreementRate: {
          $cond: [
            { $gt: ['$totalRated', 0] },
            { $divide: ['$correct', '$totalRated'] },
            null
          ]
        }
      }
    }
  ]).toArray();
  
  // Extract and calculate metrics
  const t = impactResult?.totals?.[0] || {};
  const r = impactResult?.reality || [];
  
  const confirmed = r.find((x: any) => x._id === 'CONFIRMS')?.count || 0;
  const contradicted = r.find((x: any) => x._id === 'CONTRADICTS')?.count || 0;
  
  const totalAlerts = t.totalAlerts || 0;
  const suppressedByMl = t.suppressedByMl || 0;
  const downgradedByMl = t.downgradedByMl || 0;
  
  // Calculate derived metrics
  const noiseReduction = totalAlerts > 0 ? suppressedByMl / totalAlerts : null;
  const realityAlignment = (confirmed + contradicted) > 0 
    ? confirmed / (confirmed + contradicted) 
    : null;
  const agreementRate = agreementResult?.agreementRate ?? null;
  
  // Impact Score Formula:
  // (agreement_rate * 0.4) + (noise_reduction * 0.4) + (reality_alignment * 0.2)
  let impactScore: number | null = null;
  if (agreementRate !== null && noiseReduction !== null && realityAlignment !== null) {
    impactScore = (agreementRate * 0.4) + (noiseReduction * 0.4) + (realityAlignment * 0.2);
  }
  
  return {
    window,
    totalAlerts,
    sentBeforeMl: t.sentBeforeMl || 0,
    sentAfterMl: t.sentAfterMl || 0,
    lowPriorityAfterMl: t.lowPriorityAfterMl || 0,
    suppressedByMl,
    downgradedByMl,
    noiseReduction,
    realityAlignment,
    agreementRate,
    impactScore,
  };
}

/**
 * Get reality stats separately
 */
export async function getRealityStats(windowDays: number = 7): Promise<RealityStats> {
  const auditCol = getAuditCollection();
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  
  const result = await auditCol.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$reality.verdict', count: { $sum: 1 } } }
  ]).toArray();
  
  return {
    confirmed: result.find((x: any) => x._id === 'CONFIRMS')?.count || 0,
    contradicted: result.find((x: any) => x._id === 'CONTRADICTS')?.count || 0,
    noData: result.find((x: any) => x._id === 'NO_DATA')?.count || 0,
  };
}

console.log('[ML2/Impact] Store module loaded (Phase C2)');
