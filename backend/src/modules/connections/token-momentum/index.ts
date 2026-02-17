/**
 * Token Momentum Module
 * Exports services and routes for token momentum scoring
 */
export { 
  calculateMomentumScore,
  determineTrend,
  extractTokenMentions,
  updateTokenMomentum,
  getTopMomentumTokens,
  getTokenMomentum,
  getTrendingTokens,
  type TokenMomentum
} from './momentum.service.js';

export { tokenMomentumRoutes } from './momentum.routes.js';
