import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { env } from './config/env.js';
import { registerRoutes } from './api/routes.js';
import { zodPlugin } from './plugins/zod.js';
import { setupWebSocketGateway } from './core/websocket/index.js';
import { AppError } from './common/errors.js';

/**
 * Build Fastify Application
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
  });

  // CORS
  app.register(cors, {
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
    credentials: true,
  });

  // Plugins
  app.register(zodPlugin);
  
  // WebSocket plugin - register at root level
  if (env.WS_ENABLED) {
    app.register(fastifyWebsocket, {
      options: { maxPayload: 1048576 }
    });
    app.log.info('WebSocket plugin registered');
  }

  // Global error handler
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        ok: false,
        error: err.code,
        message: err.message,
      });
    }

    // Fastify validation errors
    if (err.validation) {
      return reply.status(400).send({
        ok: false,
        error: 'VALIDATION_ERROR',
        message: err.message,
      });
    }

    // Unknown errors
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(statusCode).send({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  // Not found handler
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      ok: false,
      error: 'NOT_FOUND',
      message: 'Route not found',
    });
  });

  // Register routes
  app.register(registerRoutes);
  
  // Register Twitter User Module (P4.1 + Block 4 Control Plane + Phase 1.1 API Keys)
  console.log('[BOOT] before twitter-user module');
  app.register(async (fastify) => {
    console.log('[BOOT] inside twitter-user module registration');
    
    const {
      createTwitterUserModule,
      registerTwitterUserRoutes,
      registerTwitterWebhookRoutes,
      registerApiKeyRoutes,
      registerParseTargetRoutes,
      registerQuotaRoutes,
      registerSchedulerRoutes,
      registerScrollRuntimeRoutes,
      registerRuntimeSelectionRoutes,
      registerParseRoutes,
      registerDebugRoutes,
      registerAccountRoutes,
    } = await import('./modules/twitter-user/index.js');
    
    // Phase 5.2.1: Telegram Binding routes
    const { telegramBindingRoutes } = await import('./modules/twitter-user/routes/telegram-binding.routes.js');

    console.log('[BOOT] twitter-user module imported');

    const cookieEncKey = process.env.COOKIE_ENC_KEY || '';
    const twitterModule = createTwitterUserModule({ cookieEncKey });

    console.log('[BOOT] twitter-user module created');

    // Register all routes
    await registerTwitterUserRoutes(fastify, {
      integration: twitterModule.integration,
      sessions: twitterModule.sessions,
    });
    
    // Phase 1.1: API Key management routes
    await registerApiKeyRoutes(fastify);
    
    // Webhook routes (now uses API Key auth)
    await registerTwitterWebhookRoutes(fastify, {
      sessions: twitterModule.sessions,
    });
    
    // Block 4 routes
    await registerParseTargetRoutes(fastify);
    await registerQuotaRoutes(fastify);
    await registerSchedulerRoutes(fastify);
    await registerScrollRuntimeRoutes(fastify);
    
    // Phase 1.3: Runtime Selection routes
    await registerRuntimeSelectionRoutes(fastify);
    
    // Phase 1.4: Parse routes
    await registerParseRoutes(fastify);
    
    // Debug routes
    await registerDebugRoutes(fastify);
    
    // A.2.1: Account Management routes
    await registerAccountRoutes(fastify);
    
    // Phase 5.2.1: Telegram Binding routes
    await telegramBindingRoutes(fastify);

    console.log('[BOOT] all routes registered (Block 4 + Phase 1.1-1.4 + Debug + A.2.1 Accounts + Phase 5.2.1 Telegram)');

    fastify.log.info('Twitter User Module (P4.1 + Block 4 + Phase 1.1-1.4) registered');
  });
  console.log('[BOOT] after twitter-user module');
  
  // A.3 - Admin Control Plane
  app.register(async (fastify) => {
    console.log('[BOOT] registering twitter-admin module');
    try {
      const adminModule = await import('./modules/twitter-admin/routes/admin.routes.js');
      await adminModule.registerAdminTwitterRoutes(fastify);
      console.log('[BOOT] twitter-admin module registered successfully');
    } catch (err) {
      console.error('[BOOT] Failed to register twitter-admin module:', err);
    }
  });
  
  // NOTE: Twitter module (v4.0) DISABLED to avoid route conflicts with twitter-user module
  // Uncomment when twitter-user routes are separated
  // app.register(async (instance) => {
  //   const { registerTwitterModule } = await import('./modules/twitter/twitter.module.js');
  //   await registerTwitterModule(instance);
  // });

  // NOTE: Twitter Parser Admin module DISABLED - replaced by MULTI architecture
  // New routes registered via twitter/accounts, twitter/sessions, twitter/slots
  // app.register(async (instance) => {
  //   const { registerTwitterParserAdminModule } = await import('./modules/twitter_parser_admin/index.js');
  //   await registerTwitterParserAdminModule(instance);
  // });

  // WebSocket endpoint - register after websocket plugin
  if (env.WS_ENABLED) {
    app.after(() => {
      setupWebSocketGateway(app);
    });
  }

  // Register Sentiment Module (S2.1)
  app.register(async (fastify) => {
    const sentimentEnabled = process.env.SENTIMENT_ENABLED === 'true';
    if (sentimentEnabled) {
      console.log('[BOOT] Registering sentiment module...');
      try {
        const { initSentimentModule } = await import('./modules/sentiment/index.js');
        await initSentimentModule(fastify);
        console.log('[BOOT] Sentiment module registered successfully');
      } catch (err) {
        console.error('[BOOT] Failed to register sentiment module:', err);
      }
    } else {
      console.log('[BOOT] Sentiment module disabled (SENTIMENT_ENABLED != true)');
    }
  });

  // Register Connections Module (Author/Influence Scoring)
  app.register(async (fastify) => {
    const connectionsEnabled = process.env.CONNECTIONS_MODULE_ENABLED !== 'false';
    if (connectionsEnabled) {
      console.log('[BOOT] Registering connections module...');
      try {
        const { initConnectionsModule } = await import('./modules/connections/index.js');
        await initConnectionsModule(fastify);
        console.log('[BOOT] Connections module registered successfully');
      } catch (err) {
        console.error('[BOOT] Failed to register connections module:', err);
      }
    } else {
      console.log('[BOOT] Connections module disabled (CONNECTIONS_MODULE_ENABLED = false)');
    }
  });

  // Register Telegram Discovery Module (Isolated)
  app.register(async (fastify) => {
    const telegramEnabled = process.env.TELEGRAM_DISCOVERY_ENABLED !== 'false';
    if (telegramEnabled) {
      console.log('[BOOT] Registering telegram-discovery module...');
      try {
        const { initTelegramDiscoveryModule } = await import('./modules/telegram-discovery/index.js');
        await initTelegramDiscoveryModule(fastify);
        console.log('[BOOT] Telegram Discovery module registered successfully');
      } catch (err) {
        console.error('[BOOT] Failed to register telegram-discovery module:', err);
      }
    } else {
      console.log('[BOOT] Telegram Discovery module disabled');
    }
  });

  // Register Telegram Intelligence Module (Production Pipeline)
  app.register(async (fastify) => {
    const telegramIntelEnabled = process.env.TELEGRAM_INTEL_ENABLED !== 'false';
    if (telegramIntelEnabled) {
      console.log('[BOOT] Registering telegram-intel module...');
      try {
        const { telegramIntelPlugin } = await import('./modules/telegram-intel/telegram_intel.plugin.js');
        await fastify.register(telegramIntelPlugin);
        console.log('[BOOT] Telegram Intel module registered successfully');
      } catch (err) {
        console.error('[BOOT] Failed to register telegram-intel module:', err);
      }
    } else {
      console.log('[BOOT] Telegram Intel module disabled');
    }
  });

  return app;
}
