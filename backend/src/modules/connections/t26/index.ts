/**
 * T2.6 Module - Real Accounts Expansion
 * 
 * Entry point for Pilot → Real Accounts transition
 */

import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

import { initT26Store, getT26Config } from './real-accounts.store.js';
import { registerT26Routes } from './t26.routes.js';

// Re-exports
export * from './real-accounts.store.js';

/**
 * Initialize T2.6 module
 */
export async function initT26Module(db: Db, app: FastifyInstance): Promise<void> {
  // Initialize store
  initT26Store(db);
  
  // Register routes
  registerT26Routes(app);
  
  const config = await getT26Config();
  
  console.log(`[T2.6] Module initialized - Status: ${config.status}`);
  
  if (config.status === 'ACTIVE') {
    console.log('[T2.6] 🚀 Real Accounts mode is ACTIVE');
    console.log(`[T2.6] Accounts: ${config.current_real_accounts}/${config.max_real_accounts}`);
  } else {
    console.log('[T2.6] Use POST /api/admin/connections/t26/activate to enable');
  }
}

console.log('[T2.6] Module loaded');
