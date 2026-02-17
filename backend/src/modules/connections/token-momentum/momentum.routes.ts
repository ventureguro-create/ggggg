/**
 * Token Momentum API Routes
 */
import { FastifyInstance, FastifyRequest } from 'fastify';
import { 
  getTopMomentumTokens, 
  getTokenMomentum, 
  getTrendingTokens,
  updateTokenMomentum
} from './momentum.service.js';

export async function tokenMomentumRoutes(app: FastifyInstance) {
  // GET /api/connections/momentum - Get top momentum tokens
  app.get('/api/connections/momentum', async (
    request: FastifyRequest<{ Querystring: { limit?: string } }>
  ) => {
    const limit = parseInt(request.query.limit || '20');
    const tokens = await getTopMomentumTokens(limit);
    
    return {
      ok: true,
      count: tokens.length,
      data: tokens,
    };
  });
  
  // GET /api/connections/momentum/trending - Get trending tokens only
  app.get('/api/connections/momentum/trending', async (
    request: FastifyRequest<{ Querystring: { limit?: string } }>
  ) => {
    const limit = parseInt(request.query.limit || '10');
    const tokens = await getTrendingTokens(limit);
    
    return {
      ok: true,
      count: tokens.length,
      data: tokens,
    };
  });
  
  // GET /api/connections/momentum/:symbol - Get momentum for specific token
  app.get('/api/connections/momentum/:symbol', async (
    request: FastifyRequest<{ Params: { symbol: string } }>
  ) => {
    const { symbol } = request.params;
    const momentum = await getTokenMomentum(symbol);
    
    if (!momentum) {
      return { ok: false, error: 'Token not found' };
    }
    
    return {
      ok: true,
      data: momentum,
    };
  });
  
  // POST /api/connections/momentum/process - Manually trigger momentum update
  app.post('/api/connections/momentum/process', async (
    request: FastifyRequest<{ Body: { tweets?: any[] } }>
  ) => {
    const { tweets = [] } = request.body || {};
    
    if (!tweets.length) {
      return { ok: false, error: 'No tweets provided' };
    }
    
    const result = await updateTokenMomentum(tweets);
    
    return {
      ok: true,
      tokensProcessed: result.tokens,
      updated: result.updated,
    };
  });
  
  console.log('[TokenMomentum] Routes registered at /api/connections/momentum/*');
}
