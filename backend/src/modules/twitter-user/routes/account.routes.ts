/**
 * A.2.1 - Twitter Account CRUD Routes
 * 
 * Управление Twitter аккаунтами пользователя (identity layer)
 */
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../auth/require-user.hook.js';
import { userScope } from '../acl/ownership.js';
import { UserTwitterAccountModel } from '../models/twitter-account.model.js';
import { UserTwitterSessionModel } from '../models/twitter-session.model.js';

// Config
const MAX_ACCOUNTS_PER_USER = 3;

export async function registerAccountRoutes(app: FastifyInstance) {
  /**
   * GET /api/v4/twitter/accounts
   * 
   * Список всех Twitter аккаунтов пользователя
   */
  app.get('/api/v4/twitter/accounts', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);

      const accounts = await UserTwitterAccountModel.find(scope)
        .sort({ isPreferred: -1, createdAt: 1 })
        .lean();

      // Для каждого аккаунта получить статус сессии
      const accountsWithSessions = await Promise.all(
        accounts.map(async (account) => {
          const sessions = await UserTwitterSessionModel.find({
            ...scope,
            accountId: account._id,
            isActive: true,
          })
            .sort({ createdAt: -1 })
            .limit(1)
            .lean();

          const session = sessions[0];

          return {
            id: account._id,
            username: account.username,
            displayName: account.displayName,
            enabled: account.enabled,
            isPreferred: account.isPreferred || false,
            priority: account.priority || 0,
            sessionStatus: session ? session.status : 'NO_SESSION',
            sessionCount: sessions.length,
            createdAt: account.createdAt,
          };
        })
      );

      return reply.send({
        ok: true,
        data: {
          accounts: accountsWithSessions,
          total: accountsWithSessions.length,
          limit: MAX_ACCOUNTS_PER_USER,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Get accounts error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/v4/twitter/accounts
   * 
   * Добавить новый Twitter аккаунт
   */
  app.post('/api/v4/twitter/accounts', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const body = req.body as any;

      // Validation
      if (!body.username || typeof body.username !== 'string') {
        return reply.code(400).send({
          ok: false,
          error: 'USERNAME_REQUIRED',
          message: 'Username is required',
        });
      }

      const username = body.username.toLowerCase().replace('@', '').trim();

      if (!username) {
        return reply.code(400).send({
          ok: false,
          error: 'INVALID_USERNAME',
          message: 'Invalid username format',
        });
      }

      // Check limit
      const existingCount = await UserTwitterAccountModel.countDocuments(scope);

      if (existingCount >= MAX_ACCOUNTS_PER_USER) {
        return reply.code(403).send({
          ok: false,
          error: 'ACCOUNT_LIMIT_REACHED',
          message: `Your plan allows up to ${MAX_ACCOUNTS_PER_USER} Twitter accounts`,
          limit: MAX_ACCOUNTS_PER_USER,
        });
      }

      // Check duplicate
      const existing = await UserTwitterAccountModel.findOne({
        ...scope,
        username,
      });

      if (existing) {
        return reply.code(409).send({
          ok: false,
          error: 'ACCOUNT_ALREADY_EXISTS',
          message: `Account @${username} already added`,
        });
      }

      // Auto-set preferred if first account
      const isPreferred = existingCount === 0;

      // Create account
      const account = await UserTwitterAccountModel.create({
        ...scope,
        username,
        displayName: body.displayName || username,
        enabled: true,
        isPreferred,
        priority: 0,
      });

      return reply.code(201).send({
        ok: true,
        data: {
          accountId: account._id,
          username: account.username,
          displayName: account.displayName,
          enabled: account.enabled,
          isPreferred: account.isPreferred,
          status: 'NO_SESSION',
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Create account error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * PATCH /api/v4/twitter/accounts/:id
   * 
   * Обновить аккаунт (displayName, priority)
   */
  app.patch('/api/v4/twitter/accounts/:id', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { id } = req.params as any;
      const body = req.body as any;

      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: id,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      // Update allowed fields
      if (body.displayName !== undefined) {
        account.displayName = body.displayName;
      }

      if (body.priority !== undefined && typeof body.priority === 'number') {
        account.priority = body.priority;
      }

      await account.save();

      return reply.send({
        ok: true,
        data: {
          accountId: account._id,
          username: account.username,
          displayName: account.displayName,
          priority: account.priority,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Update account error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // NOTE: POST /api/v4/twitter/accounts/:id/preferred is defined in runtime-selection.routes.ts

  /**
   * POST /api/v4/twitter/accounts/:id/disable
   * 
   * Disable аккаунт (не удалять)
   */
  app.post('/api/v4/twitter/accounts/:id/disable', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { id } = req.params as any;

      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: id,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      account.enabled = false;

      // If this was preferred, unset
      if (account.isPreferred) {
        account.isPreferred = false;

        // Set another account as preferred if exists
        const otherAccount = await UserTwitterAccountModel.findOne({
          ...scope,
          _id: { $ne: id },
          enabled: true,
        });

        if (otherAccount) {
          otherAccount.isPreferred = true;
          await otherAccount.save();
        }
      }

      await account.save();

      return reply.send({
        ok: true,
        data: {
          accountId: account._id,
          enabled: false,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Disable account error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/v4/twitter/accounts/:id/enable
   * 
   * Enable аккаунт обратно
   */
  app.post('/api/v4/twitter/accounts/:id/enable', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { id } = req.params as any;

      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: id,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      account.enabled = true;
      await account.save();

      return reply.send({
        ok: true,
        data: {
          accountId: account._id,
          enabled: true,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Enable account error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/v4/twitter/accounts/:id
   * 
   * Удалить аккаунт (только если нет активных сессий)
   */
  app.delete('/api/v4/twitter/accounts/:id', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { id } = req.params as any;

      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: id,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      // Check if has active sessions
      const activeSessions = await UserTwitterSessionModel.countDocuments({
        ...scope,
        accountId: id,
        isActive: true,
      });

      if (activeSessions > 0) {
        return reply.code(409).send({
          ok: false,
          error: 'HAS_ACTIVE_SESSIONS',
          message: 'Cannot delete account with active sessions',
        });
      }

      await account.deleteOne();

      return reply.send({
        ok: true,
        data: {
          accountId: id,
          deleted: true,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Delete account error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // A.2.2 - Sessions API
  // ============================================================

  /**
   * GET /api/v4/twitter/accounts/:accountId/sessions
   * 
   * Список всех сессий для конкретного аккаунта
   */
  app.get('/api/v4/twitter/accounts/:accountId/sessions', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { accountId } = req.params as { accountId: string };
      const query = req.query as { onlyActive?: string };

      // Verify account ownership
      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: accountId,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      // Build filter
      const filter: any = {
        ...scope,
        accountId,
      };

      if (query.onlyActive === 'true') {
        filter.isActive = true;
      }

      // Get sessions
      const sessions = await UserTwitterSessionModel.find(filter)
        .sort({ isActive: -1, updatedAt: -1 })
        .limit(50)
        .lean();

      // Map to DTO (exclude encrypted fields)
      const sessionsDto = sessions.map(s => ({
        id: s._id,
        accountId: s.accountId,
        version: s.version,
        isActive: s.isActive,
        status: s.status,
        riskScore: s.riskScore,
        lifetimeDaysEstimate: s.lifetimeDaysEstimate,
        lastOkAt: s.lastOkAt,
        lastSyncAt: s.lastSyncAt,
        lastAbortAt: s.lastAbortAt,
        staleReason: s.staleReason,
        avgLatencyMs: s.avgLatencyMs,
        successRate: s.successRate,
        userAgentShort: s.userAgent ? s.userAgent.substring(0, 50) + '...' : null,
        source: s.userAgent?.includes('Extension') ? 'EXTENSION' : 
                s.userAgent?.includes('Mock') ? 'MOCK' : 'MANUAL',
        supersededAt: s.supersededAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      return reply.send({
        ok: true,
        data: {
          accountId,
          accountUsername: account.username,
          sessions: sessionsDto,
          total: sessionsDto.length,
          activeCount: sessionsDto.filter(s => s.isActive).length,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Get sessions error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/v4/twitter/accounts/:accountId/sessions/refresh-hint
   * 
   * Информация для refresh cookies flow
   */
  app.get('/api/v4/twitter/accounts/:accountId/sessions/refresh-hint', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { accountId } = req.params as { accountId: string };

      // Verify account ownership
      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: accountId,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      // Get current active session info
      const activeSession = await UserTwitterSessionModel.findOne({
        ...scope,
        accountId,
        isActive: true,
      }).lean();

      // Get webhook URL from env
      const webhookBaseUrl = process.env.APP_URL || 'https://your-app.com';

      return reply.send({
        ok: true,
        data: {
          accountId,
          accountUsername: account.username,
          currentStatus: activeSession?.status || 'NO_SESSION',
          currentVersion: activeSession?.version || 0,
          lastSyncAt: activeSession?.lastSyncAt || null,
          riskScore: activeSession?.riskScore || 0,
          staleReason: activeSession?.staleReason || null,
          // Refresh flow info
          webhookUrl: `${webhookBaseUrl}/api/v4/twitter/webhook/sync`,
          apiKeyRequired: true,
          apiKeyPageUrl: '/settings/api-keys',
          steps: [
            'Open Twitter in your browser and make sure you are logged in',
            'Open the AI-ON Chrome Extension',
            'Click "Sync Cookies" button',
            'Wait for confirmation',
          ],
          extensionInfo: {
            name: 'AI-ON Twitter Extension',
            chromeStoreUrl: null, // TODO: add when published
          },
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Get refresh hint error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/v4/twitter/accounts/:accountId/sessions/:sessionId
   * 
   * Детали конкретной сессии
   */
  app.get('/api/v4/twitter/accounts/:accountId/sessions/:sessionId', async (req, reply) => {
    try {
      const u = requireUser(req);
      const scope = userScope(u.id);
      const { accountId, sessionId } = req.params as { accountId: string; sessionId: string };

      // Verify account ownership
      const account = await UserTwitterAccountModel.findOne({
        ...scope,
        _id: accountId,
      });

      if (!account) {
        return reply.code(404).send({
          ok: false,
          error: 'ACCOUNT_NOT_FOUND',
        });
      }

      const session = await UserTwitterSessionModel.findOne({
        ...scope,
        _id: sessionId,
        accountId,
      }).lean();

      if (!session) {
        return reply.code(404).send({
          ok: false,
          error: 'SESSION_NOT_FOUND',
        });
      }

      return reply.send({
        ok: true,
        data: {
          id: session._id,
          accountId: session.accountId,
          accountUsername: account.username,
          version: session.version,
          isActive: session.isActive,
          status: session.status,
          riskScore: session.riskScore,
          lifetimeDaysEstimate: session.lifetimeDaysEstimate,
          lastOkAt: session.lastOkAt,
          lastSyncAt: session.lastSyncAt,
          lastAbortAt: session.lastAbortAt,
          staleReason: session.staleReason,
          avgLatencyMs: session.avgLatencyMs,
          successRate: session.successRate,
          userAgentShort: session.userAgent ? session.userAgent.substring(0, 100) : null,
          source: session.userAgent?.includes('Extension') ? 'EXTENSION' : 
                  session.userAgent?.includes('Mock') ? 'MOCK' : 'MANUAL',
          supersededAt: session.supersededAt,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      });
    } catch (err: any) {
      app.log.error(err, 'Get session details error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
}
