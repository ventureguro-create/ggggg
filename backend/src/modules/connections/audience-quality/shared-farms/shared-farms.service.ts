/**
 * Shared Bot Farms Service
 * 
 * Analyzes shared suspicious followers across influencers.
 */

import type { Db } from 'mongodb';
import type { SharedBotFarm, SharedFarmAnalysis } from './shared-farms.types.js';

/**
 * Find shared suspicious followers between influencers
 */
export async function analyzeSharedFarms(
  db: Db,
  actorId: string,
  options: {
    minSharedFollowers?: number;
    maxInfluencersToCompare?: number;
  } = {}
): Promise<SharedFarmAnalysis> {
  const {
    minSharedFollowers = 5,
    maxInfluencersToCompare = 50,
  } = options;

  // Get AQE cache for this actor
  const aqeCache = db.collection('connections_aqe_cache');
  const actorAqe = await aqeCache.findOne({ _id: actorId });
  
  if (!actorAqe) {
    return {
      actorId,
      totalSharedBots: 0,
      uniqueFarms: 0,
      highRiskFarms: 0,
      connectedInfluencers: [],
      farms: [],
      manipulationRisk: 'LOW',
      createdAt: new Date().toISOString(),
    };
  }

  // Get suspicious followers from this actor
  const suspiciousFollowers = actorAqe.topSuspiciousFollowers?.map((f: any) => f.followerId) ?? [];
  
  if (suspiciousFollowers.length === 0) {
    return {
      actorId,
      totalSharedBots: 0,
      uniqueFarms: 0,
      highRiskFarms: 0,
      connectedInfluencers: [],
      farms: [],
      manipulationRisk: 'LOW',
      createdAt: new Date().toISOString(),
    };
  }

  // Find other actors with same suspicious followers
  // Using aggregation to find overlaps
  const pipeline = [
    { $match: { _id: { $ne: actorId } } },
    { $limit: maxInfluencersToCompare },
    {
      $project: {
        actorId: '$actorId',
        handle: '$twitterHandle',
        suspiciousIds: {
          $map: {
            input: { $ifNull: ['$topSuspiciousFollowers', []] },
            as: 'f',
            in: '$$f.followerId'
          }
        }
      }
    }
  ];

  const otherActors = await aqeCache.aggregate(pipeline).toArray();

  // Find overlaps
  const suspiciousSet = new Set(suspiciousFollowers);
  const connectedInfluencers: SharedFarmAnalysis['connectedInfluencers'] = [];
  const farmMap = new Map<string, SharedBotFarm>();
  let totalSharedBots = 0;

  for (const other of otherActors) {
    const otherSuspicious = other.suspiciousIds || [];
    const shared = otherSuspicious.filter((id: string) => suspiciousSet.has(id));
    
    if (shared.length >= minSharedFollowers) {
      const farmId = `farm_${actorId}_${other._id}`;
      
      // Create farm record
      const farm: SharedBotFarm = {
        farmId,
        sharedFollowerIds: shared,
        sharedCount: shared.length,
        influencers: [
          {
            actorId,
            handle: actorAqe.twitterHandle,
            sharedFollowers: shared.length,
            percentOfTheirBots: Math.round((shared.length / suspiciousFollowers.length) * 100),
          },
          {
            actorId: other._id,
            handle: other.handle,
            sharedFollowers: shared.length,
            percentOfTheirBots: otherSuspicious.length > 0 
              ? Math.round((shared.length / otherSuspicious.length) * 100) 
              : 0,
          },
        ],
        riskLevel: 'LOW',
        riskScore: 0,
        createdAt: new Date().toISOString(),
      };

      // Calculate risk
      farm.riskScore = calculateFarmRisk(farm);
      farm.riskLevel = 
        farm.riskScore >= 80 ? 'CRITICAL' :
        farm.riskScore >= 60 ? 'HIGH' :
        farm.riskScore >= 40 ? 'MEDIUM' : 'LOW';

      farmMap.set(farmId, farm);
      totalSharedBots += shared.length;

      connectedInfluencers.push({
        actorId: other._id,
        handle: other.handle,
        sharedBots: shared.length,
        farmIds: [farmId],
      });
    }
  }

  const farms = Array.from(farmMap.values())
    .sort((a, b) => b.riskScore - a.riskScore);

  const highRiskFarms = farms.filter(f => 
    f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL'
  ).length;

  // Overall risk assessment
  let manipulationRisk: SharedFarmAnalysis['manipulationRisk'] = 'LOW';
  if (highRiskFarms >= 3 || totalSharedBots >= 50) {
    manipulationRisk = 'CRITICAL';
  } else if (highRiskFarms >= 1 || totalSharedBots >= 20) {
    manipulationRisk = 'HIGH';
  } else if (farms.length >= 2 || totalSharedBots >= 10) {
    manipulationRisk = 'MEDIUM';
  }

  return {
    actorId,
    totalSharedBots,
    uniqueFarms: farms.length,
    highRiskFarms,
    connectedInfluencers: connectedInfluencers.sort((a, b) => b.sharedBots - a.sharedBots),
    farms,
    manipulationRisk,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculate risk score for a farm
 */
function calculateFarmRisk(farm: SharedBotFarm): number {
  let score = 0;

  // Size factor (more shared = higher risk)
  if (farm.sharedCount >= 20) score += 40;
  else if (farm.sharedCount >= 10) score += 25;
  else if (farm.sharedCount >= 5) score += 15;

  // High percentage of bots from this farm
  const maxPercent = Math.max(...farm.influencers.map(i => i.percentOfTheirBots));
  if (maxPercent >= 50) score += 30;
  else if (maxPercent >= 30) score += 20;
  else if (maxPercent >= 15) score += 10;

  // Multiple influencers sharing
  if (farm.influencers.length >= 3) score += 20;
  else if (farm.influencers.length >= 2) score += 10;

  return Math.min(100, score);
}
