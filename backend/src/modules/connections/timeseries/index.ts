/**
 * Time Series Module - Main Export
 */

export { TSFollowersModel, TSEngagementModel, TSScoresModel } from './models.js';
export type { ITSFollowers, ITSEngagement, ITSScores, GradeType, EarlySignalBadge } from './models.js';

export { seedTimeSeries, appendTimeSeriesPoint, batchSeedAccounts } from './seed.generator.js';
export type { SeedType } from './seed.generator.js';

export { computeTimeSeriesSummary, getTopBreakoutAccounts } from './summary.compute.js';
export type { TimeSeriesSummary } from './summary.compute.js';

export { timeseriesAdminConfig, updateTimeseriesConfig, getTimeseriesConfig } from './admin.config.js';
export type { TimeseriesConfig } from './admin.config.js';

export { registerTimeseriesRoutes } from './routes.js';
export { registerTimeseriesAdminRoutes } from './admin.routes.js';
