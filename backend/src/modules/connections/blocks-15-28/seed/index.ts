/**
 * Mock seed data for BLOCKS 15-28
 */

export const botFarmsMock = [
  {
    farmId: 'farm_cobie_hsaka',
    actorIds: ['cobie', 'hsaka'],
    sharedFollowers: 42,
    botRatio: 0.83,
    suspiciousRatio: 0.17,
    confidence: 0.91,
    createdAt: new Date()
  },
  {
    farmId: 'farm_hsaka_altcoingod',
    actorIds: ['hsaka', 'altcoinGOD'],
    sharedFollowers: 28,
    botRatio: 0.72,
    suspiciousRatio: 0.28,
    confidence: 0.78,
    createdAt: new Date()
  }
];

export const audienceQualityMock = [
  {
    actorId: 'cobie',
    windowDays: 30,
    totalFollowers: 900000,
    sampledFollowers: 1200,
    pctHuman: 78,
    pctSuspicious: 13,
    pctBot: 9,
    pctActive: 61,
    pctDormant: 27,
    pctDead: 12,
    aqi: 82,
    level: 'ELITE',
    reasons: ['Strong human audience (78.0%)'],
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'hsaka',
    windowDays: 30,
    totalFollowers: 220000,
    sampledFollowers: 1200,
    pctHuman: 61,
    pctSuspicious: 21,
    pctBot: 18,
    pctActive: 49,
    pctDormant: 32,
    pctDead: 19,
    aqi: 58,
    level: 'GOOD',
    reasons: ['Shared bot farms penalty (-7.2)'],
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'somebot',
    windowDays: 30,
    totalFollowers: 120000,
    sampledFollowers: 1200,
    pctHuman: 28,
    pctSuspicious: 18,
    pctBot: 54,
    pctActive: 22,
    pctDormant: 34,
    pctDead: 44,
    aqi: 21,
    level: 'RISKY',
    reasons: ['High bot share (54.0%)'],
    updatedAt: new Date().toISOString()
  }
];

export const fakeGrowthMock = [
  {
    actorId: 'cobie',
    windowDays: 30,
    avgDailyGrowth: 1250,
    maxSpike: 3800,
    churnRate: 0.12,
    deadGrowthRate: 0.08,
    followRingScore: 0.05,
    growthScore: 85,
    label: 'CLEAN',
    reasons: ['Growth pattern appears organic'],
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'hsaka',
    windowDays: 30,
    avgDailyGrowth: 800,
    maxSpike: 5200,
    churnRate: 0.28,
    deadGrowthRate: 0.32,
    followRingScore: 0.18,
    growthScore: 52,
    label: 'SUSPICIOUS',
    reasons: ['Suspicious spike (6.5x avg)', 'Elevated churn (28%)'],
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'somebot',
    windowDays: 30,
    avgDailyGrowth: 450,
    maxSpike: 12000,
    churnRate: 0.52,
    deadGrowthRate: 0.61,
    followRingScore: 0.42,
    growthScore: 18,
    label: 'MANIPULATED',
    reasons: ['Extreme spike detected (26.7x avg)', 'High churn rate (52%)', 'Growth without engagement (61%)'],
    updatedAt: new Date().toISOString()
  }
];

export const authenticityMock = [
  {
    actorId: 'cobie',
    score: 85,
    label: 'ORGANIC',
    breakdown: {
      realFollowerRatio: 88,
      audienceQuality: 82,
      networkIntegrity: 84
    },
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'hsaka',
    score: 62,
    label: 'MOSTLY_REAL',
    breakdown: {
      realFollowerRatio: 65,
      audienceQuality: 58,
      networkIntegrity: 62
    },
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'somebot',
    score: 24,
    label: 'FARMED',
    breakdown: {
      realFollowerRatio: 28,
      audienceQuality: 21,
      networkIntegrity: 22
    },
    updatedAt: new Date().toISOString()
  }
];

export const actorBehaviorProfilesMock = [
  {
    actorId: 'cobie',
    profile: 'EARLY_CONVICTION',
    confidence: 0.88,
    description: 'Knows before the market',
    since: '2024-06-01T00:00:00Z',
    metrics: {
      accumulationBias: 0.72,
      tweetLeadLag: -4.2,
      distributionAfterMentions: 0.12,
      holdingDuration: 68,
      confirmationRatio: 0.84,
      directionalVariance: 0.35
    },
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'hsaka',
    profile: 'PUMP_AND_EXIT',
    confidence: 0.72,
    description: 'Speaks when already selling',
    since: '2024-08-01T00:00:00Z',
    metrics: {
      accumulationBias: 0.35,
      tweetLeadLag: 2.1,
      distributionAfterMentions: 0.68,
      holdingDuration: 12,
      confirmationRatio: 0.45,
      directionalVariance: 0.62
    },
    updatedAt: new Date().toISOString()
  },
  {
    actorId: 'whale_acc',
    profile: 'LONG_TERM_ACCUMULATOR',
    confidence: 0.92,
    description: 'Quietly buys, rarely speaks, often right',
    since: '2024-03-01T00:00:00Z',
    metrics: {
      accumulationBias: 0.89,
      tweetLeadLag: -1.2,
      distributionAfterMentions: 0.08,
      holdingDuration: 142,
      confirmationRatio: 0.91,
      directionalVariance: 0.12
    },
    updatedAt: new Date().toISOString()
  }
];

export const strategySimulationsMock = [
  {
    strategy: 'EARLY_CONVICTION_ONLY',
    description: 'Follow only Early Conviction actors',
    window: '30d',
    metrics: {
      hitRate: 0.68,
      avgFollowThrough: 12.4,
      noiseRatio: 0.32,
      confirmationLag: 6,
      sampleSize: 143
    },
    events: [],
    updatedAt: new Date().toISOString()
  },
  {
    strategy: 'LONG_TERM_ACCUMULATORS',
    description: 'Follow only Long-Term Accumulators',
    window: '30d',
    metrics: {
      hitRate: 0.75,
      avgFollowThrough: 8.2,
      noiseRatio: 0.25,
      confirmationLag: 48,
      sampleSize: 89
    },
    events: [],
    updatedAt: new Date().toISOString()
  }
];

/**
 * Seed all mock data to database
 */
export async function seedBlocks15To28Data(db: any) {
  console.log('[Blocks 15-28] Seeding mock data...');

  try {
    // Bot Farms
    const botFarmsCol = db.collection('bot_farms');
    for (const farm of botFarmsMock) {
      await botFarmsCol.updateOne(
        { farmId: farm.farmId },
        { $set: farm },
        { upsert: true }
      );
    }

    // Audience Quality Reports
    const aqiCol = db.collection('audience_quality_reports');
    for (const report of audienceQualityMock) {
      await aqiCol.updateOne(
        { actorId: report.actorId },
        { $set: report },
        { upsert: true }
      );
    }

    // Fake Growth Reports
    const fgCol = db.collection('fake_growth_reports');
    for (const report of fakeGrowthMock) {
      await fgCol.updateOne(
        { actorId: report.actorId },
        { $set: report },
        { upsert: true }
      );
    }

    // Authenticity Reports
    const authCol = db.collection('influencer_authenticity_reports');
    for (const report of authenticityMock) {
      await authCol.updateOne(
        { actorId: report.actorId },
        { $set: report },
        { upsert: true }
      );
    }

    // Actor Behavior Profiles
    const profilesCol = db.collection('actor_behavior_profiles');
    for (const profile of actorBehaviorProfilesMock) {
      await profilesCol.updateOne(
        { actorId: profile.actorId },
        { $set: profile },
        { upsert: true }
      );
    }

    // Strategy Simulations
    const simCol = db.collection('strategy_simulations');
    for (const sim of strategySimulationsMock) {
      await simCol.updateOne(
        { strategy: sim.strategy },
        { $set: sim },
        { upsert: true }
      );
    }

    console.log('[Blocks 15-28] Mock data seeded successfully');
  } catch (error) {
    console.error('[Blocks 15-28] Error seeding mock data:', error);
  }
}
