/**
 * Time Series Admin Routes
 * 
 * Prefix: /api/admin/connections/timeseries
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  timeseriesAdminConfig, 
  updateTimeseriesConfig, 
  getTimeseriesConfig,
  TimeseriesConfig 
} from './admin.config.js';
import { TSFollowersModel, TSEngagementModel, TSScoresModel } from './models.js';

export async function registerTimeseriesAdminRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/admin/connections/timeseries/config
   */
  app.get('/config', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: getTimeseriesConfig(),
    });
  });
  
  /**
   * PATCH /api/admin/connections/timeseries/config
   */
  app.patch('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<TimeseriesConfig>;
    
    const updated = updateTimeseriesConfig(body);
    
    return reply.send({
      ok: true,
      message: 'Timeseries config updated',
      data: updated,
    });
  });
  
  /**
   * DELETE /api/admin/connections/timeseries/data
   * Clear time series data (with optional filters)
   */
  app.delete('/data', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { 
      account_id?: string; 
      older_than_days?: string;
      source?: 'mock' | 'twitter';
    };
    
    const filter: any = {};
    
    if (query.account_id) {
      filter.account_id = query.account_id;
    }
    
    if (query.older_than_days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(query.older_than_days));
      filter.ts = { $lt: cutoff };
    }
    
    if (query.source) {
      filter.source = query.source;
    }
    
    try {
      const [followers, engagement, scores] = await Promise.all([
        TSFollowersModel.deleteMany(filter),
        TSEngagementModel.deleteMany(filter),
        TSScoresModel.deleteMany(filter),
      ]);
      
      return reply.send({
        ok: true,
        message: 'Data cleared',
        data: {
          deleted: {
            followers: followers.deletedCount,
            engagement: engagement.deletedCount,
            scores: scores.deletedCount,
          },
          filter,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'DELETE_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * POST /api/admin/connections/timeseries/retention/run
   * Run retention cleanup
   */
  app.post('/retention/run', async (_req: FastifyRequest, reply: FastifyReply) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeseriesAdminConfig.retention_days);
    
    try {
      const [followers, engagement, scores] = await Promise.all([
        TSFollowersModel.deleteMany({ ts: { $lt: cutoff } }),
        TSEngagementModel.deleteMany({ ts: { $lt: cutoff } }),
        TSScoresModel.deleteMany({ ts: { $lt: cutoff } }),
      ]);
      
      return reply.send({
        ok: true,
        message: `Cleaned data older than ${timeseriesAdminConfig.retention_days} days`,
        data: {
          cutoff_date: cutoff.toISOString(),
          deleted: {
            followers: followers.deletedCount,
            engagement: engagement.deletedCount,
            scores: scores.deletedCount,
          },
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'RETENTION_ERROR',
        message: error.message,
      });
    }
  });
  
  console.log('[Timeseries Admin] Routes registered: /api/admin/connections/timeseries/*');
}
