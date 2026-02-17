/**
 * Network Health Admin Routes
 * 
 * Phase 3.4.5: Network quality control before Twitter
 * 
 * GET /api/admin/connections/network-health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPathsConfig } from '../core/paths/index.js';

interface NetworkHealthData {
  avg_hops_to_elite: number | null;
  pct_with_elite_exposure: number;
  total_accounts: number;
  distribution: {
    elite: number;
    strong: number;
    moderate: number;
    weak: number;
  };
  last_computed: string;
}

// Mock network health data (will be computed from real data when Twitter connected)
function computeNetworkHealth(): NetworkHealthData {
  const config = getPathsConfig();
  
  // Mock data based on current configuration
  // In production, this would aggregate from actual graph/paths data
  const mockAccounts = 47;
  const eliteThreshold = config.exposure_tiers.elite;
  const strongThreshold = config.exposure_tiers.strong;
  const moderateThreshold = config.exposure_tiers.moderate;
  
  // Simulate realistic distribution
  const distribution = {
    elite: Math.floor(mockAccounts * 0.17),    // ~17% elite
    strong: Math.floor(mockAccounts * 0.32),   // ~32% strong
    moderate: Math.floor(mockAccounts * 0.26), // ~26% moderate
    weak: Math.floor(mockAccounts * 0.25),     // ~25% weak
  };
  
  // Ensure total matches
  const diff = mockAccounts - (distribution.elite + distribution.strong + distribution.moderate + distribution.weak);
  distribution.moderate += diff;
  
  return {
    avg_hops_to_elite: 2.4,
    pct_with_elite_exposure: Math.round((distribution.elite + distribution.strong) / mockAccounts * 100),
    total_accounts: mockAccounts,
    distribution,
    last_computed: new Date().toISOString(),
  };
}

export async function registerNetworkHealthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/admin/connections/network-health
   * Returns network quality metrics for admin dashboard
   */
  app.get('/network-health', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = computeNetworkHealth();
      
      return reply.send({
        ok: true,
        data: health,
      });
    } catch (err: any) {
      console.error('[NetworkHealth] Error:', err);
      return reply.status(500).send({
        ok: false,
        error: err.message || 'Failed to compute network health',
      });
    }
  });
  
  console.log('[NetworkHealth Admin] Routes registered: /api/admin/connections/network-health');
}
