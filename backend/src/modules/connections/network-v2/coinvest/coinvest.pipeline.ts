/**
 * Co-Investment MongoDB Pipeline
 * 
 * Builds Fund ↔ Fund edges based on shared project investments.
 * This is the most powerful signal in the VC world.
 */

import { Document } from 'mongodb';
import type { BuildCoInvestParams } from '../network-v2-plus.types.js';

/**
 * Build co-investment pipeline
 * Creates edges between backers who invested in same projects
 */
export function buildCoInvestmentPipeline(params: BuildCoInvestParams): Document[] {
  const {
    fromDate,
    toDate,
    minConfidence = 0.6,
    minSharedProjects = 2,
    topK = 5000,
  } = params;

  // Match filter
  const match: any = { confidence: { $gte: minConfidence } };
  if (fromDate || toDate) {
    match.announcedAt = {};
    if (fromDate) match.announcedAt.$gte = fromDate;
    if (toDate) match.announcedAt.$lte = toDate;
  }

  return [
    // 1. Filter investments
    { $match: match },

    // 2. Group by project → list of backers
    {
      $group: {
        _id: '$projectId',
        backers: { $addToSet: '$backerId' },
        avgConfidence: { $avg: '$confidence' },
      },
    },

    // 3. Only projects with 2+ backers
    { $match: { $expr: { $gte: [{ $size: '$backers' }, 2] } } },

    // 4. Duplicate array for cross-join
    { $set: { list: '$backers' } },

    // 5. Unwind A with index
    { $unwind: { path: '$backers', includeArrayIndex: 'i' } },

    // 6. Unwind B with index
    { $unwind: { path: '$list', includeArrayIndex: 'j' } },

    // 7. Only unique pairs (j > i)
    { $match: { $expr: { $gt: ['$j', '$i'] } } },

    // 8. Project pair with metadata
    {
      $project: {
        from: '$backers',
        to: '$list',
        projectId: '$_id',
        avgConfidence: 1,
      },
    },

    // 9. Aggregate pairs
    {
      $group: {
        _id: { from: '$from', to: '$to' },
        sharedProjects: { $addToSet: '$projectId' },
        sharedCount: { $sum: 1 },
        confidence: { $avg: '$avgConfidence' },
      },
    },

    // 10. Filter weak pairs
    { $match: { sharedCount: { $gte: minSharedProjects } } },

    // 11. Calculate weight (log-based)
    {
      $addFields: {
        weight: {
          $min: [
            1,
            {
              $add: [
                0.15,
                { $multiply: [{ $ln: { $add: ['$sharedCount', 1] } }, 0.3] },
              ],
            },
          ],
        },
      },
    },

    // 12. Sort and limit
    { $sort: { sharedCount: -1 } },
    { $limit: topK },

    // 13. Final shape
    {
      $project: {
        _id: 0,
        from: '$_id.from',
        to: '$_id.to',
        type: { $literal: 'CO_INVESTMENT' },
        sharedCount: 1,
        sharedProjects: 1,
        weight: 1,
        confidence: 1,
      },
    },
  ];
}

/**
 * Build Backer → Project edges
 */
export function buildBackerProjectPipeline(minConfidence = 0.6): Document[] {
  return [
    { $match: { confidence: { $gte: minConfidence } } },
    {
      $project: {
        _id: 0,
        from: '$backerId',
        to: '$projectId',
        type: { $literal: 'INVESTED_IN' },
        weight: {
          $min: [1, { $add: [0.4, { $multiply: ['$confidence', 0.6] }] }],
        },
        confidence: '$confidence',
        meta: {
          round: '$round',
          amountUsd: '$amountUsd',
          announcedAt: '$announcedAt',
        },
      },
    },
  ];
}

/**
 * Jaccard-enhanced pipeline (for more accurate weight)
 * Requires additional lookups - use for smaller datasets
 */
export function buildCoInvestmentWithJaccardPipeline(params: BuildCoInvestParams): Document[] {
  const basePipeline = buildCoInvestmentPipeline(params);
  
  // Insert jaccard calculation before final project
  const jaccardStages: Document[] = [
    // Lookup A's total projects
    {
      $lookup: {
        from: 'backer_investments',
        let: { backerId: '$from' },
        pipeline: [
          { $match: { $expr: { $eq: ['$backerId', '$$backerId'] } } },
          { $group: { _id: '$backerId', total: { $sum: 1 } } },
        ],
        as: 'aStats',
      },
    },
    // Lookup B's total projects
    {
      $lookup: {
        from: 'backer_investments',
        let: { backerId: '$to' },
        pipeline: [
          { $match: { $expr: { $eq: ['$backerId', '$$backerId'] } } },
          { $group: { _id: '$backerId', total: { $sum: 1 } } },
        ],
        as: 'bStats',
      },
    },
    // Calculate Jaccard
    {
      $addFields: {
        aTotal: { $ifNull: [{ $first: '$aStats.total' }, 0] },
        bTotal: { $ifNull: [{ $first: '$bStats.total' }, 0] },
      },
    },
    {
      $addFields: {
        jaccard: {
          $cond: [
            {
              $gt: [
                { $add: ['$aTotal', '$bTotal', { $multiply: ['$sharedCount', -1] }] },
                0,
              ],
            },
            {
              $divide: [
                '$sharedCount',
                { $add: ['$aTotal', '$bTotal', { $multiply: ['$sharedCount', -1] }] },
              ],
            },
            0,
          ],
        },
      },
    },
    // Update weight with Jaccard
    {
      $addFields: {
        weight: {
          $min: [1, { $add: [0.15, { $multiply: ['$jaccard', 0.85] }] }],
        },
      },
    },
  ];
  
  // Remove last $project, add jaccard stages, re-add final $project
  const withoutFinal = basePipeline.slice(0, -1);
  const finalProject = {
    $project: {
      _id: 0,
      from: 1,
      to: 1,
      type: 1,
      sharedCount: 1,
      sharedProjects: 1,
      weight: 1,
      confidence: 1,
      jaccard: 1,
    },
  };
  
  return [...withoutFinal, ...jaccardStages, finalProject];
}

console.log('[CoInvest] Pipeline module loaded');
