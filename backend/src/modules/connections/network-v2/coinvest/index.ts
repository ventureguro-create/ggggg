/**
 * Co-Investment Module Index
 */

export { buildCoInvestmentPipeline, buildBackerProjectPipeline } from './coinvest.pipeline.js';
export { CoInvestmentBuilder } from './coinvest.builder.service.js';
export { CoInvestmentReader } from './coinvest.reader.service.js';
export {
  initCoInvestServices,
  registerCoInvestAdminRoutes,
  registerCoInvestReadRoutes,
  registerBackerNetworkRoutes,
} from './coinvest.routes.js';

console.log('[CoInvest] Module loaded');
