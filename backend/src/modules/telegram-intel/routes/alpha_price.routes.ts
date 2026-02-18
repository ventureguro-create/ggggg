/**
 * Alpha Price Routes
 * Admin API for price evaluation
 */
import { FastifyPluginAsync } from 'fastify';
import { PriceEvaluationService } from '../alpha/price_evaluation.service.js';
import { AlphaPriceService } from '../price/price.service.js';

export const alphaPriceRoutes: FastifyPluginAsync = async (fastify) => {
  const log = (msg: string, meta?: any) => fastify.log.info(meta || {}, msg);
  const evalSvc = new PriceEvaluationService(log);
  const priceSvc = new AlphaPriceService(log);

  // Run evaluation batch
  fastify.post('/api/admin/telegram-intel/alpha/evaluate', async (req) => {
    const body = (req.body as any) || {};
    const limit = Math.min(Number(body.limit || 50), 200);

    return evalSvc.evaluateBatch(limit);
  });

  // Re-evaluate incomplete mentions (7d/30d returns)
  fastify.post('/api/admin/telegram-intel/alpha/reevaluate', async (req) => {
    const body = (req.body as any) || {};
    const limit = Math.min(Number(body.limit || 30), 100);

    return evalSvc.reevaluateIncomplete(limit);
  });

  // Get evaluation stats
  fastify.get('/api/admin/telegram-intel/alpha/evaluation-stats', async () => {
    return evalSvc.getStats();
  });

  // Get price cache stats
  fastify.get('/api/admin/telegram-intel/alpha/price-cache-stats', async () => {
    return priceSvc.getCacheStats();
  });

  // Get current price for token
  fastify.get('/api/admin/telegram-intel/alpha/price/:token', async (req) => {
    const { token } = req.params as any;
    const upperToken = String(token).toUpperCase();

    const price = await priceSvc.getCurrentPriceUSD(upperToken);

    return {
      ok: price !== null,
      token: upperToken,
      priceUSD: price,
    };
  });

  // Get historical price for token at date
  fastify.get('/api/admin/telegram-intel/alpha/price/:token/history', async (req) => {
    const { token } = req.params as any;
    const query = (req.query as any) || {};
    const dateStr = query.date; // YYYY-MM-DD

    if (!dateStr) {
      return { ok: false, error: 'date_required', format: 'YYYY-MM-DD' };
    }

    const upperToken = String(token).toUpperCase();
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return { ok: false, error: 'invalid_date' };
    }

    const price = await priceSvc.getHistoricalPriceUSD(upperToken, date);

    return {
      ok: price !== null,
      token: upperToken,
      date: dateStr,
      priceUSD: price,
    };
  });

  fastify.log.info('[alpha-price] routes registered');
};
