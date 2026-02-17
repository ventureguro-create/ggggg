/**
 * Co-Engagement Module - Network v2
 */

export * from './co-engagement.types.js';
export * from './similarity.js';
export * from './build-series.js';
export * from './build-network.js';
export * from './co-engagement.service.js';
export * from './co-engagement.routes.js';

import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { initCoEngagementService } from './co-engagement.service.js';
import { registerCoEngagementRoutes } from './co-engagement.routes.js';

export async function initCoEngagementModule(db: Db, app: FastifyInstance): Promise<void> {
  initCoEngagementService(db);
  registerCoEngagementRoutes(app);
  console.log('[CoEngagement] Module initialized');
}

console.log('[CoEngagement] Module loaded');
