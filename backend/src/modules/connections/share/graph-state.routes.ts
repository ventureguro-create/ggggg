/**
 * Graph State Routes
 * P2.2: Share / Persist Graph State
 * 
 * Endpoints:
 * - POST /api/connections/graph/state/encode - Encode state to shareable string
 * - POST /api/connections/graph/state/decode - Decode string back to state
 * - GET /api/connections/graph/state/info - Get state version info
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  encodeGraphState, 
  decodeGraphState, 
  validateGraphState,
  normalizeGraphState,
  createShareUrl,
  type GraphStateV1 
} from './graph-state.service.js';

interface EncodeBody {
  state: Partial<GraphStateV1>;
  baseUrl?: string;
}

interface DecodeBody {
  encoded: string;
}

export function registerGraphStateRoutes(app: FastifyInstance): void {
  
  // ============================================================
  // POST /api/connections/graph/state/encode
  // Encode state to URL-safe string
  // ============================================================
  app.post('/graph/state/encode', async (
    req: FastifyRequest<{ Body: EncodeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { state, baseUrl } = req.body || {};
      
      if (!state || typeof state !== 'object') {
        reply.code(400);
        return { ok: false, error: 'Missing or invalid state object' };
      }
      
      // Validate state
      const validation = validateGraphState(state);
      if (!validation.valid) {
        reply.code(400);
        return { ok: false, error: 'Invalid state', details: validation.errors };
      }
      
      // Normalize state (convert aliases to canonical form)
      const normalized = normalizeGraphState(state);
      
      // Encode
      const encoded = encodeGraphState(normalized);
      
      // Optionally create full URL
      const shareUrl = baseUrl ? createShareUrl(baseUrl, normalized) : null;
      
      return {
        ok: true,
        data: {
          encoded,
          shareUrl,
          length: encoded.length,
          version: '1.0',
          normalized, // Return normalized state for debugging
        },
      };
    } catch (err: any) {
      console.error('[GraphState] Encode error:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // POST /api/connections/graph/state/decode
  // Decode string back to state
  // ============================================================
  app.post('/graph/state/decode', async (
    req: FastifyRequest<{ Body: DecodeBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { encoded } = req.body || {};
      
      if (!encoded || typeof encoded !== 'string') {
        reply.code(400);
        return { ok: false, error: 'Missing or invalid encoded string' };
      }
      
      // Decode
      const state = decodeGraphState(encoded);
      
      if (!state) {
        reply.code(400);
        return { ok: false, error: 'Failed to decode state - invalid format' };
      }
      
      // Validate decoded state
      const validation = validateGraphState(state);
      
      return {
        ok: true,
        data: {
          state,
          valid: validation.valid,
          warnings: validation.errors.length > 0 ? validation.errors : undefined,
        },
      };
    } catch (err: any) {
      console.error('[GraphState] Decode error:', err);
      reply.code(500);
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // GET /api/connections/graph/state/info
  // Get state version and capabilities info
  // ============================================================
  app.get('/graph/state/info', async (_req: FastifyRequest, reply: FastifyReply) => {
    return {
      ok: true,
      data: {
        currentVersion: '1.0',
        supportedVersions: ['1.0'],
        features: {
          filters: true,
          selectedNodes: true,
          compare: true,
          view: true,
          table: true,
          highlight: true,
        },
        encoding: 'base64-url-safe',
        maxLength: 4096, // Recommended max URL length
      },
    };
  });

  console.log('[GraphState] Registered graph state routes');
}
