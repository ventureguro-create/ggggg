/**
 * Silent Authority Module - Network v2
 */

export * from './silent-authority.detector.js';
export * from './silent-authority.service.js';
export * from './silent-authority.routes.js';

import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { initSilentAuthorityService } from './silent-authority.service.js';
import { registerSilentAuthorityRoutes } from './silent-authority.routes.js';

export async function initSilentAuthorityModule(db: Db, app: FastifyInstance): Promise<void> {
  initSilentAuthorityService(db);
  registerSilentAuthorityRoutes(app);
  console.log('[SilentAuthority] Module initialized');
}

console.log('[SilentAuthority] Module loaded');
