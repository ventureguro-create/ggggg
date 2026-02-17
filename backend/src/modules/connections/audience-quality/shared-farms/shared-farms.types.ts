/**
 * Shared Bot Farms Types
 * 
 * Detects when multiple influencers share the same suspicious followers.
 * This indicates coordinated manipulation.
 */

export interface SharedBotFarm {
  farmId: string;
  sharedFollowerIds: string[];
  sharedCount: number;
  
  // Influencers that share this farm
  influencers: Array<{
    actorId: string;
    handle?: string;
    sharedFollowers: number;
    percentOfTheirBots: number;  // % of their bots that are from this farm
  }>;
  
  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;  // 0-100
  
  createdAt: string;
}

export interface SharedFarmAnalysis {
  actorId: string;
  
  // Summary
  totalSharedBots: number;
  uniqueFarms: number;
  highRiskFarms: number;
  
  // Related influencers
  connectedInfluencers: Array<{
    actorId: string;
    handle?: string;
    sharedBots: number;
    farmIds: string[];
  }>;
  
  // Farms this influencer is part of
  farms: SharedBotFarm[];
  
  // Overall risk
  manipulationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  createdAt: string;
}
