/**
 * Network Paths API Routes
 * 
 * Prefix: /api/connections/paths
 * 
 * Endpoints:
 * - GET /:account_id - Get paths for account
 * - GET /:account_id/:target - Get specific path
 * - GET /info - Engine info
 * - POST /seed-graph - Generate mock graph
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  buildPathsResponse, 
  generateMockGraphForPaths,
  computeExposure,
  explainPaths,
  pathsConfig,
  GraphSnapshot,
} from '../core/paths/index.js';

// In-memory graph store for paths
let pathsGraphSnapshot: GraphSnapshot | null = null;

/**
 * Get or generate graph snapshot
 */
function getGraphSnapshot(): GraphSnapshot {
  if (!pathsGraphSnapshot) {
    pathsGraphSnapshot = generateMockGraphForPaths(25);
  }
  return pathsGraphSnapshot;
}

export async function registerPathsRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/connections/paths/info
   * Get engine info
   */
  app.get('/info', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      data: {
        version: pathsConfig.version,
        max_depth: pathsConfig.max_depth,
        description: 'Network paths (handshakes) and exposure engine',
        enabled: pathsConfig.enabled,
      },
    });
  });
  
  /**
   * POST /api/connections/paths/seed-graph
   * Generate mock graph for testing
   */
  app.post('/seed-graph', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { node_count?: number };
    const nodeCount = Math.min(body.node_count || 25, 100);
    
    pathsGraphSnapshot = generateMockGraphForPaths(nodeCount);
    
    return reply.send({
      ok: true,
      message: `Generated mock graph with ${nodeCount} nodes`,
      data: {
        nodes: pathsGraphSnapshot.nodes.length,
        edges: pathsGraphSnapshot.edges.length,
      },
    });
  });
  
  /**
   * GET /api/connections/paths/:account_id
   * Get paths for an account
   */
  app.get('/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!pathsConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'PATHS_DISABLED',
        message: 'Paths engine is disabled',
      });
    }
    
    const { account_id } = req.params as { account_id: string };
    const query = req.query as { max_depth?: string };
    const maxDepth = query.max_depth ? parseInt(query.max_depth) : undefined;
    
    try {
      const snapshot = getGraphSnapshot();
      const pathsResponse = buildPathsResponse(snapshot, account_id, maxDepth);
      const exposure = computeExposure(account_id, pathsResponse.paths);
      const explain = explainPaths(account_id, pathsResponse.paths, exposure);
      
      return reply.send({
        ok: true,
        data: {
          paths: pathsResponse,
          exposure,
          explain,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'PATHS_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/paths/:account_id/:target
   * Get specific path to target
   */
  app.get('/:account_id/:target', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!pathsConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'PATHS_DISABLED',
        message: 'Paths engine is disabled',
      });
    }
    
    const { account_id, target } = req.params as { account_id: string; target: string };
    
    try {
      const snapshot = getGraphSnapshot();
      const pathsResponse = buildPathsResponse(snapshot, account_id, undefined, [target]);
      
      return reply.send({
        ok: true,
        data: pathsResponse,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'PATH_ERROR',
        message: error.message,
      });
    }
  });
  
  /**
   * GET /api/connections/exposure/:account_id
   * Get network exposure for account
   */
  app.get('/exposure/:account_id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!pathsConfig.enabled) {
      return reply.status(503).send({
        ok: false,
        error: 'PATHS_DISABLED',
        message: 'Paths engine is disabled',
      });
    }
    
    const { account_id } = req.params as { account_id: string };
    
    try {
      const snapshot = getGraphSnapshot();
      const pathsResponse = buildPathsResponse(snapshot, account_id);
      const exposure = computeExposure(account_id, pathsResponse.paths);
      
      return reply.send({
        ok: true,
        data: exposure,
      });
    } catch (error: any) {
      return reply.status(500).send({
        ok: false,
        error: 'EXPOSURE_ERROR',
        message: error.message,
      });
    }
  });
  
  console.log('[Paths] Routes registered: /api/connections/paths/*');
}
