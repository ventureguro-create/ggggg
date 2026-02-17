// Twitter Preflight Check Routes
import type { FastifyInstance } from 'fastify';
import { runTwitterPreflight } from './preflight.service.js';

export async function preflightRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v4/twitter/preflight-check
   * Check if system is ready to run parsing
   */
  app.get('/api/v4/twitter/preflight-check', async (request, reply) => {
    const sessionId = (request.query as any).sessionId;
    
    if (!sessionId) {
      return reply.status(400).send({
        ok: false,
        error: 'MISSING_SESSION_ID',
        message: 'Query param sessionId is required'
      });
    }

    const result = await runTwitterPreflight(sessionId);
    
    return reply.status(result.canRun ? 200 : 412).send(result);
  });

  /**
   * GET /api/v4/twitter/preflight-check/system
   * Check only system services (no session required)
   */
  app.get('/api/v4/twitter/preflight-check/system', async (_request, reply) => {
    // Run with empty sessionId to check only services
    const result = await runTwitterPreflight('');
    
    // Filter to only return service checks
    return reply.send({
      status: result.checks.services.parser === 'ok' ? 'ok' : 'blocked',
      services: result.checks.services,
      blockers: result.blockers.filter(b => 
        ['PARSER_DOWN', 'BROWSER_NOT_READY'].includes(b.code)
      )
    });
  });

  /**
   * POST /api/v4/twitter/preflight-check/extension
   * Phase 8.2: Preflight for Chrome Extension before sync
   * 
   * Validates:
   * - API key (via Authorization header)
   * - Cookies quality (from body)
   * - System status
   * 
   * Returns:
   * - state: READY | SESSION_EXPIRED | NO_COOKIES | API_KEY_INVALID | ACCOUNT_RESTRICTED
   * - fixHint: Human-readable suggestion
   */
  app.post('/api/v4/twitter/preflight-check/extension', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      // Check API key presence
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          ok: false,
          state: 'API_KEY_INVALID',
          details: { hasAuth: false, cookiesCount: 0 },
          fixHint: 'Please enter a valid API key'
        });
      }

      const body = request.body as { cookies?: any[], accountId?: string } || {};
      const cookies = body.cookies || [];
      
      // Check cookies
      if (!cookies || cookies.length === 0) {
        return reply.send({
          ok: false,
          state: 'NO_COOKIES',
          details: { hasAuth: true, cookiesCount: 0 },
          fixHint: 'Open twitter.com and log in first'
        });
      }

      // Check for critical auth cookies
      const authCookies = ['auth_token', 'ct0', 'twid'];
      const foundAuth = authCookies.filter(name => 
        cookies.some((c: any) => c.name === name)
      );
      
      if (foundAuth.length < 2) {
        return reply.send({
          ok: false,
          state: 'SESSION_EXPIRED',
          details: { hasAuth: true, cookiesCount: cookies.length, foundAuth },
          fixHint: 'You are logged out of Twitter. Please log in and try again'
        });
      }

      // Check system health (skip parser check - we just need to save cookies)
      // Parser can be started later after cookies are synced
      /*
      const systemResult = await runTwitterPreflight('');
      if (systemResult.checks.services.parser !== 'ok') {
        return reply.send({
          ok: false,
          state: 'SERVICE_UNAVAILABLE',
          details: { hasAuth: true, cookiesCount: cookies.length },
          fixHint: 'Service is temporarily unavailable. Please try again in a moment'
        });
      }
      */

      // All checks passed - cookies are valid, ready to sync
      return reply.send({
        ok: true,
        state: 'READY',
        details: {
          hasAuth: true,
          cookiesCount: cookies.length,
          foundAuth
        },
        fixHint: null
      });

    } catch (err: any) {
      app.log.error(err, 'Extension preflight error');
      return reply.status(500).send({
        ok: false,
        state: 'INTERNAL_ERROR',
        details: { hasAuth: false, cookiesCount: 0 },
        fixHint: 'Something went wrong. Please try again'
      });
    }
  });
}
