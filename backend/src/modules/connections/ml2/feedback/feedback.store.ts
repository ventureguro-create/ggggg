/**
 * Feedback Store - PHASE C2
 * MongoDB operations for feedback collection
 */

import type { Db, Collection } from 'mongodb';
import type { MlFeedback, FeedbackInput, FeedbackStats } from './feedback.types.js';

const COLLECTION_NAME = 'connections_feedback';

let feedbackCollection: Collection<MlFeedback> | null = null;

/**
 * Initialize feedback store with MongoDB db instance
 */
export function initFeedbackStore(db: Db): void {
  feedbackCollection = db.collection(COLLECTION_NAME);
  
  // Create indexes
  feedbackCollection.createIndex({ createdAt: -1 }).catch(() => {});
  feedbackCollection.createIndex({ alertId: 1 }, { sparse: true }).catch(() => {});
  feedbackCollection.createIndex({ actorId: 1, createdAt: -1 }).catch(() => {});
  
  console.log('[ML2/Feedback] Store initialized');
}

function getCollection(): Collection<MlFeedback> {
  if (!feedbackCollection) {
    throw new Error('Feedback store not initialized. Call initFeedbackStore first.');
  }
  return feedbackCollection;
}

/**
 * Save feedback entry
 */
export async function saveFeedback(input: FeedbackInput): Promise<{ ok: boolean }> {
  const col = getCollection();
  
  const doc: MlFeedback = {
    ...input,
    createdAt: new Date(),
  };
  
  await col.insertOne(doc as any);
  
  console.log(`[ML2/Feedback] Saved: ${input.action} for alert=${input.alertId || 'N/A'}`);
  
  return { ok: true };
}

/**
 * Get feedback statistics for a time window
 */
export async function getFeedbackStats(windowDays: number = 7): Promise<FeedbackStats> {
  const col = getCollection();
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
  
  const [result] = await col.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $facet: {
        byAction: [
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        bySource: [
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        byDecision: [
          { $group: { _id: '$ml2Decision', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
      }
    }
  ]).toArray();
  
  return result || { byAction: [], bySource: [], byDecision: [] };
}

/**
 * Get recent feedback entries
 */
export async function getRecentFeedback(limit: number = 50): Promise<MlFeedback[]> {
  const col = getCollection();
  
  return col
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<MlFeedback[]>;
}

/**
 * Get feedback by alertId
 */
export async function getFeedbackByAlertId(alertId: string): Promise<MlFeedback[]> {
  const col = getCollection();
  
  return col
    .find({ alertId })
    .sort({ createdAt: -1 })
    .toArray() as Promise<MlFeedback[]>;
}

console.log('[ML2/Feedback] Store module loaded (Phase C2)');
