/**
 * Minimal App - Only Connections module + Admin auth
 * 
 * This is a simplified version for development.
 * Phase 2.3: Added Telegram Notifications
 * Phase 4.5: Added Alert Policy Store initialization
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { AppError } from './common/errors.js';
import { getMongoDb } from './db/mongoose.js';
import { TelegramTransport } from './modules/connections/notifications/telegram.transport.js';
import { ConnectionsTelegramDispatcher } from './modules/connections/notifications/dispatcher.service.js';
import { registerConnectionsTelegramAdminRoutes } from './modules/connections/notifications/admin.routes.js';
import { initAlertPolicyStore } from './modules/connections/core/alerts/alert-policy.store.js';
import { initPilotStore } from './modules/connections/core/pilot/pilot.store.js';

export function buildMinimalApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
  });

  // CORS
  app.register(cors, {
    origin: true,
    credentials: true,
  });

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

    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(statusCode).send({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: err.message,
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

  // Health check
  app.get('/api/health', async () => {
    return { ok: true, service: 'fomo-backend', mode: 'minimal' };
  });

  // Register Admin Auth
  app.register(async (fastify) => {
    console.log('[BOOT] Registering admin auth...');
    const { adminAuthRoutes } = await import('./core/admin/admin.auth.routes.js');
    await adminAuthRoutes(fastify);
    console.log('[BOOT] Admin auth registered');
  }, { prefix: '/api/admin' });

  // Register Admin Connections Control Plane
  app.register(async (fastify) => {
    console.log('[BOOT] Registering admin connections...');
    const { adminConnectionsRoutes } = await import('./core/admin/admin.connections.routes.js');
    await adminConnectionsRoutes(fastify);
    console.log('[BOOT] Admin connections registered');
  }, { prefix: '/api/admin/connections' });

  // Register Connections Module
  app.register(async (fastify) => {
    console.log('[BOOT] Registering connections module...');
    try {
      // Initialize Alert Policy Store (Phase 4.5)
      const db = getMongoDb();
      initAlertPolicyStore(db);
      console.log('[BOOT] Alert Policy Store initialized');
      
      // Initialize Pilot Store (Phase 4.6)
      initPilotStore(db);
      console.log('[BOOT] Pilot Store initialized');
      
      // Initialize Feedback Store (Phase 5.A.3)
      const { initFeedbackStore } = await import('./modules/connections/ml/feedback/feedback.store.js');
      initFeedbackStore(db);
      console.log('[BOOT] Feedback Store initialized');
      
      // Initialize ML2 Stores (Phase 5.3)
      const { initMl2ConfigStore, initMl2ShadowLogStore, initMl2PredictionsStore } = await import('./modules/connections/ml2/index.js');
      initMl2ConfigStore(db);
      initMl2ShadowLogStore(db);
      initMl2PredictionsStore(db);
      console.log('[BOOT] ML2 Stores initialized');
      
      // Initialize Impact Store (Phase C2)
      const { initImpactStore } = await import('./modules/connections/ml2/impact/index.js');
      initImpactStore(db);
      console.log('[BOOT] Impact Store initialized (Phase C2)');
      
      // Initialize ML2 Feedback Store (Phase C2)
      const { initFeedbackStore: initMl2FeedbackStore } = await import('./modules/connections/ml2/feedback/index.js');
      initMl2FeedbackStore(db);
      console.log('[BOOT] ML2 Feedback Store initialized (Phase C2)');
      
      // Initialize Projects Store (E2 Phase)
      const { initProjectStore } = await import('./modules/connections/projects/index.js');
      initProjectStore(db);
      console.log('[BOOT] Projects Store initialized (E2 Phase)');
      
      const { initConnectionsModule } = await import('./modules/connections/index.js');
      await initConnectionsModule(fastify, db);
      console.log('[BOOT] Connections module registered');
      
      // Register Taxonomy v2 (Phase B)
      const { registerTaxonomyRoutes } = await import('./modules/connections/taxonomy/index.js');
      registerTaxonomyRoutes(fastify, db);
      console.log('[BOOT] Taxonomy v2 routes registered');
      
      // Register Reality Module (Phase E)
      const { registerRealityModule } = await import('./modules/connections/reality/index.js');
      registerRealityModule(fastify, db);
      console.log('[BOOT] Reality Module registered (E2 + E4)');
      
      // Register Projects Routes (E2 Phase)
      const { registerProjectRoutes, registerProjectAdminRoutes } = await import('./modules/connections/projects/index.js');
      registerProjectRoutes(fastify);
      registerProjectAdminRoutes(fastify);
      console.log('[BOOT] Projects routes registered (E2 Phase)');
    } catch (err) {
      console.error('[BOOT] Failed to register connections module:', err);
    }
  });

  // Register ML Admin Routes (Phase 5.A)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering ML admin routes...');
    try {
      const { registerMLRoutes } = await import('./modules/connections/ml/ml-admin.routes.js');
      await registerMLRoutes(fastify);
      console.log('[BOOT] ML admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register ML routes:', err);
    }
  }, { prefix: '/api/connections' });

  // Register ML2 Admin Routes (Phase 5.3)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering ML2 admin routes...');
    try {
      const { registerMl2AdminRoutes } = await import('./modules/connections/ml2/index.js');
      await registerMl2AdminRoutes(fastify);
      console.log('[BOOT] ML2 admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register ML2 routes:', err);
    }
  }, { prefix: '/api/admin/connections/ml2' });

  // Register Feedback & Impact Routes (Phase C2)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Feedback routes (Phase C2)...');
    try {
      const { registerFeedbackRoutes } = await import('./modules/connections/ml2/api/feedback-impact.routes.js');
      await registerFeedbackRoutes(fastify);
      console.log('[BOOT] Feedback routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Feedback routes:', err);
    }
  }, { prefix: '/api/admin/connections' });

  app.register(async (fastify) => {
    console.log('[BOOT] Registering Impact routes (Phase C2)...');
    try {
      const { registerImpactRoutes } = await import('./modules/connections/ml2/api/feedback-impact.routes.js');
      await registerImpactRoutes(fastify);
      console.log('[BOOT] Impact routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Impact routes:', err);
    }
  }, { prefix: '/api/admin/connections/ml2' });

  // Register Backers Module (Phase 1 - Seed Authority + E5 - Influence)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Backers module...');
    try {
      const { registerBackerAdminRoutes, registerBackerReadRoutes, registerBackerInfluenceRoutes } = await import('./modules/connections/backers/index.js');
      registerBackerAdminRoutes(fastify);
      registerBackerReadRoutes(fastify);
      registerBackerInfluenceRoutes(fastify);
      console.log('[BOOT] Backers module registered (Phase 1 + E5)');
    } catch (err) {
      console.error('[BOOT] Failed to register Backers module:', err);
    }
  });

  // Register Telegram Notifications (Phase 2.3)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Telegram notifications...');
    try {
      const db = getMongoDb();
      const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
      const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
      
      const telegram = new TelegramTransport({ botToken });
      const dispatcher = new ConnectionsTelegramDispatcher(db, telegram, publicBaseUrl);
      
      registerConnectionsTelegramAdminRoutes(fastify, dispatcher);
      console.log('[BOOT] Telegram notifications registered');
      
      if (botToken) {
        console.log('[BOOT] Telegram bot token configured');
      } else {
        console.log('[BOOT] WARNING: TELEGRAM_BOT_TOKEN not set');
      }
    } catch (err) {
      console.error('[BOOT] Failed to register Telegram notifications:', err);
    }
  });

  // Register Unified Accounts Module
  app.register(async (fastify) => {
    console.log('[BOOT] Registering unified accounts...');
    try {
      const { registerUnifiedRoutes } = await import('./modules/connections/unified/index.js');
      await registerUnifiedRoutes(fastify);
      console.log('[BOOT] Unified accounts registered');
    } catch (err) {
      console.error('[BOOT] Failed to register unified accounts:', err);
    }
  });

  // Register Follow Graph Routes (Top Followers parsing)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Follow Graph...');
    try {
      const { parseTopFollowers, getFollowGraphStatus, refreshAccountTopFollowers } = await import('./jobs/follow_graph.job.js');
      
      // POST /api/admin/follow-graph/parse - Parse Top Followers for influencers
      fastify.post('/api/admin/follow-graph/parse', async (request) => {
        const { limit = 10 } = (request.body ?? {}) as { limit?: number };
        const result = await parseTopFollowers(limit);
        const status = getFollowGraphStatus();
        return { ok: true, ...result, status };
      });

      // POST /api/admin/follow-graph/refresh/:handle - Refresh Top Followers for specific account
      fastify.post('/api/admin/follow-graph/refresh/:handle', async (request) => {
        const { handle } = request.params as { handle: string };
        const topFollowers = await refreshAccountTopFollowers(handle);
        return { ok: true, handle, count: topFollowers.length, topFollowers };
      });
      
      // GET /api/admin/follow-graph/status - Get job status
      fastify.get('/api/admin/follow-graph/status', async () => {
        const status = getFollowGraphStatus();
        return { ok: true, ...status };
      });
      
      console.log('[BOOT] Follow Graph registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Follow Graph:', err);
    }
  });

  // Register Graph V2 Routes (BLOCK 4)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Graph V2...');
    try {
      const { registerGraphV2Routes } = await import('./modules/connections/graph-v2/index.js');
      await registerGraphV2Routes(fastify);
      console.log('[BOOT] Graph V2 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Graph V2:', err);
    }
  });

  // Register Cluster Attention Routes (Coordinated Pump Detection)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Cluster Attention...');
    try {
      const { registerClusterAttentionRoutes } = await import('./modules/connections/cluster-attention/index.js');
      await registerClusterAttentionRoutes(fastify);
      console.log('[BOOT] Cluster Attention registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Cluster Attention:', err);
    }
  });

  // Register Handshake V2 Routes (BLOCK 4)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Handshake V2...');
    try {
      const { registerHandshakeV2Routes } = await import('./modules/connections/handshake-v2/index.js');
      await registerHandshakeV2Routes(fastify);
      console.log('[BOOT] Handshake V2 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Handshake V2:', err);
    }
  });

  // Register Authority V3 Routes (BLOCK 5)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Authority V3...');
    try {
      const { registerAuthorityV3Routes } = await import('./modules/connections/authority-v3/index.js');
      await registerAuthorityV3Routes(fastify);
      console.log('[BOOT] Authority V3 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Authority V3:', err);
    }
  });

  // Register Network V2 Routes (BLOCK 5)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Network V2...');
    try {
      const { registerNetworkV2Routes } = await import('./modules/connections/networkv2/index.js');
      await registerNetworkV2Routes(fastify);
      console.log('[BOOT] Network V2 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Network V2:', err);
    }
  });

  // Register Audience Quality Engine (AQE)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Audience Quality Engine...');
    try {
      const { registerAudienceQualityModule } = await import('./modules/connections/audience-quality/index.js');
      const db = getMongoDb();
      await registerAudienceQualityModule(fastify, db);
      console.log('[BOOT] Audience Quality Engine registered');
    } catch (err) {
      console.error('[BOOT] Failed to register AQE:', err);
    }
  });

  // Register Explain Routes (BLOCK 11)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Explain routes...');
    try {
      const { registerExplainRoutes } = await import('./modules/connections/explain/index.js');
      await registerExplainRoutes(fastify);
      console.log('[BOOT] Explain routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Explain routes:', err);
    }
  });

  // Register Compare Routes (BLOCK 11)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Compare routes...');
    try {
      const { registerCompareRoutes } = await import('./modules/connections/compare/index.js');
      await registerCompareRoutes(fastify);
      console.log('[BOOT] Compare routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Compare routes:', err);
    }
  });

  // Register Watchlist Routes (BLOCK 11)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Watchlist routes...');
    try {
      const { registerWatchlistRoutes } = await import('./modules/connections/watchlists/index.js');
      await registerWatchlistRoutes(fastify);
      console.log('[BOOT] Watchlist routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Watchlist routes:', err);
    }
  });

  // Register Alerts Pilot Routes (T2.2)

  // Register Network Routes (T2.3)
  app.register(async (fastify) => {
    console.log("[BOOT] Registering network routes...");
    try {
      const { registerNetworkRoutes } = await import("./modules/connections/network/network.routes.js");
      await registerNetworkRoutes(fastify);
      console.log("[BOOT] Network routes registered");
    } catch (err) {
      console.error("[BOOT] Failed to register network routes:", err);
    }
  }, { prefix: "/api/connections/network" });

  // Register Admin Network Routes (T2.3)

  // Register T2.4 Expansion Routes
  app.register(async (fastify) => {
    console.log("[BOOT] Registering T2.4 expansion routes...");
    try {
      const { registerT24ExpansionRoutes } = await import("./modules/admin/alerts/admin-t24-expansion.routes.js");
      await registerT24ExpansionRoutes(fastify);
      console.log("[BOOT] T2.4 expansion routes registered");
    } catch (err) {
      console.error("[BOOT] Failed to register T2.4 routes:", err);
    }
  }, { prefix: "/api/admin/t24" });
  app.register(async (fastify) => {
    console.log("[BOOT] Registering admin network routes...");
    try {
      const { registerAdminNetworkRoutes } = await import("./modules/admin/connections/network/admin-network.routes.js");
      await registerAdminNetworkRoutes(fastify);
      console.log("[BOOT] Admin network routes registered");
    } catch (err) {
      console.error("[BOOT] Failed to register admin network routes:", err);
    }
  }, { prefix: "/api/admin/connections/network" });
  app.register(async (fastify) => {
    console.log("[BOOT] Registering alerts pilot routes...");
    try {
      const { registerAlertsPilotRoutes } = await import("./modules/admin/alerts/admin-alerts-pilot.routes.js");
      await registerAlertsPilotRoutes(fastify);
      console.log("[BOOT] Alerts pilot routes registered");
    } catch (err) {
      console.error("[BOOT] Failed to register alerts pilot routes:", err);
    }
  }, { prefix: "/api/admin/alerts/pilot" });

  // Register Follow Graph v2 Routes (PHASE A1)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Follow Graph v2...');
    try {
      const { followRoutes } = await import('./modules/connections/follow-graph/index.js');
      await followRoutes(fastify);
      console.log('[BOOT] Follow Graph v2 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Follow Graph v2:', err);
    }
  }, { prefix: '/api/connections' });

  // Register On-chain Adapter (PHASE A - READ-ONLY)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering On-chain Adapter...');
    try {
      const db = getMongoDb();
      const { OnchainAdapterConfigStore, OnchainAdapterService, registerOnchainAdapterAdminRoutes } = 
        await import('./modules/connections/adapters/onchain/index.js');
      
      const cfgStore = new OnchainAdapterConfigStore(db);
      const onchainAdapter = new OnchainAdapterService(cfgStore);
      
      await registerOnchainAdapterAdminRoutes(fastify, { onchainAdapter, cfgStore });
      console.log('[BOOT] On-chain Adapter registered');
    } catch (err) {
      console.error('[BOOT] Failed to register On-chain Adapter:', err);
    }
  }, { prefix: '/api/admin/connections/onchain-adapter' });

  // Register Reality Layer (PHASE B)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Reality Layer...');
    try {
      const db = getMongoDb();
      const { OnchainAdapterConfigStore, OnchainAdapterService } = 
        await import('./modules/connections/adapters/onchain/index.js');
      const { RealityLedgerStore, RealityEvaluatorService, registerRealityPublicRoutes, registerRealityAdminRoutes } = 
        await import('./modules/connections/reality/index.js');
      
      const cfgStore = new OnchainAdapterConfigStore(db);
      const onchainAdapter = new OnchainAdapterService(cfgStore);
      const ledger = new RealityLedgerStore(db);
      const evaluator = new RealityEvaluatorService(ledger, onchainAdapter);
      
      await registerRealityPublicRoutes(fastify, { ledger });
      console.log('[BOOT] Reality Public routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Reality Layer:', err);
    }
  }, { prefix: '/api/connections/reality' });

  app.register(async (fastify) => {
    console.log('[BOOT] Registering Reality Admin...');
    try {
      const db = getMongoDb();
      const { OnchainAdapterConfigStore, OnchainAdapterService } = 
        await import('./modules/connections/adapters/onchain/index.js');
      const { RealityLedgerStore, RealityEvaluatorService, registerRealityAdminRoutes } = 
        await import('./modules/connections/reality/index.js');
      
      const cfgStore = new OnchainAdapterConfigStore(db);
      const onchainAdapter = new OnchainAdapterService(cfgStore);
      const ledger = new RealityLedgerStore(db);
      const evaluator = new RealityEvaluatorService(ledger, onchainAdapter);
      
      await registerRealityAdminRoutes(fastify, { evaluator, ledger });
      console.log('[BOOT] Reality Admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Reality Admin:', err);
    }
  }, { prefix: '/api/admin/connections/reality' });

  // Register Influence Adjustment (PHASE C)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Influence Adjustment...');
    try {
      const db = getMongoDb();
      const { InfluenceHistoryStore, ActorTrustService, InfluenceAdjusterService, 
              registerInfluencePublicRoutes, registerInfluenceAdminRoutes } = 
        await import('./modules/connections/influence-adjustment/index.js');
      
      const history = new InfluenceHistoryStore(db);
      const trust = new ActorTrustService(history);
      const adjuster = new InfluenceAdjusterService(trust);
      
      await registerInfluencePublicRoutes(fastify, { adjuster });
      console.log('[BOOT] Influence Public routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Influence Adjustment:', err);
    }
  }, { prefix: '/api/connections/influence' });

  app.register(async (fastify) => {
    console.log('[BOOT] Registering Influence Admin...');
    try {
      const db = getMongoDb();
      const { InfluenceHistoryStore, ActorTrustService, registerInfluenceAdminRoutes } = 
        await import('./modules/connections/influence-adjustment/index.js');
      
      const history = new InfluenceHistoryStore(db);
      const trust = new ActorTrustService(history);
      
      await registerInfluenceAdminRoutes(fastify, { history, trust });
      console.log('[BOOT] Influence Admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Influence Admin:', err);
    }
  }, { prefix: '/api/admin/connections/influence' });

  // Register Presets (PHASE D)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Presets...');
    try {
      const { PresetsService, registerPresetsRoutes } = 
        await import('./modules/connections/presets/index.js');
      
      const presets = new PresetsService();
      await registerPresetsRoutes(fastify, { presets });
      console.log('[BOOT] Presets routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Presets:', err);
    }
  }, { prefix: '/api/connections/presets' });

  // Register Reality Gate (E2)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Reality Gate...');
    try {
      const db = getMongoDb();
      
      // Import dependencies
      const { OnchainAdapterConfigStore, OnchainAdapterService } = 
        await import('./modules/connections/adapters/onchain/index.js');
      const { RealityLedgerStore, RealityEvaluatorService } = 
        await import('./modules/connections/reality/index.js');
      const { InfluenceHistoryStore, ActorTrustService } = 
        await import('./modules/connections/influence-adjustment/index.js');
      const { 
        RealityGateConfigStore, 
        RealityGateService, 
        RealityGateAuditStore,
        registerRealityGateAdminRoutes,
        registerRealityGatePublicRoutes 
      } = await import('./modules/connections/reality-gate/index.js');
      
      // Build dependency chain
      const onchainCfgStore = new OnchainAdapterConfigStore(db);
      const onchainAdapter = new OnchainAdapterService(onchainCfgStore);
      const realityLedger = new RealityLedgerStore(db);
      const realityEvaluator = new RealityEvaluatorService(realityLedger, onchainAdapter);
      const influenceHistory = new InfluenceHistoryStore(db);
      const trustService = new ActorTrustService(influenceHistory);
      
      // Reality Gate services
      const gateConfigStore = new RealityGateConfigStore(db);
      const gateAuditStore = new RealityGateAuditStore(db);
      const gate = new RealityGateService(
        gateConfigStore,
        realityEvaluator,
        influenceHistory,
        trustService
      );
      
      await registerRealityGatePublicRoutes(fastify, { auditStore: gateAuditStore });
      console.log('[BOOT] Reality Gate Public routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Reality Gate:', err);
    }
  }, { prefix: '/api/connections/reality-gate' });

  // Reality Gate Admin
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Reality Gate Admin...');
    try {
      const db = getMongoDb();
      
      const { OnchainAdapterConfigStore, OnchainAdapterService } = 
        await import('./modules/connections/adapters/onchain/index.js');
      const { RealityLedgerStore, RealityEvaluatorService } = 
        await import('./modules/connections/reality/index.js');
      const { InfluenceHistoryStore, ActorTrustService } = 
        await import('./modules/connections/influence-adjustment/index.js');
      const { 
        RealityGateConfigStore, 
        RealityGateService, 
        RealityGateAuditStore,
        registerRealityGateAdminRoutes 
      } = await import('./modules/connections/reality-gate/index.js');
      
      const onchainCfgStore = new OnchainAdapterConfigStore(db);
      const onchainAdapter = new OnchainAdapterService(onchainCfgStore);
      const realityLedger = new RealityLedgerStore(db);
      const realityEvaluator = new RealityEvaluatorService(realityLedger, onchainAdapter);
      const influenceHistory = new InfluenceHistoryStore(db);
      const trustService = new ActorTrustService(influenceHistory);
      
      const gateConfigStore = new RealityGateConfigStore(db);
      const gateAuditStore = new RealityGateAuditStore(db);
      const gate = new RealityGateService(
        gateConfigStore,
        realityEvaluator,
        influenceHistory,
        trustService
      );
      
      await registerRealityGateAdminRoutes(fastify, { 
        gate, 
        configStore: gateConfigStore, 
        auditStore: gateAuditStore 
      });
      console.log('[BOOT] Reality Gate Admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Reality Gate Admin:', err);
    }
  }, { prefix: '/api/admin/connections/reality-gate' });

  // Register Wallet Attribution (E3)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Wallet Attribution...');
    try {
      const db = getMongoDb();
      const { WalletAttributionStore, WalletAttributionService, registerWalletAttributionPublicRoutes } = 
        await import('./modules/connections/wallet-attribution/index.js');
      
      const store = new WalletAttributionStore(db);
      const service = new WalletAttributionService(store);
      
      await registerWalletAttributionPublicRoutes(fastify, { service });
      console.log('[BOOT] Wallet Attribution Public routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Wallet Attribution:', err);
    }
  }, { prefix: '/api/connections/wallets' });

  // Wallet Attribution Admin
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Wallet Attribution Admin...');
    try {
      const db = getMongoDb();
      const { WalletAttributionStore, WalletAttributionService, registerWalletAttributionAdminRoutes } = 
        await import('./modules/connections/wallet-attribution/index.js');
      
      const store = new WalletAttributionStore(db);
      const service = new WalletAttributionService(store);
      
      await registerWalletAttributionAdminRoutes(fastify, { service, store });
      console.log('[BOOT] Wallet Attribution Admin routes registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Wallet Attribution Admin:', err);
    }
  }, { prefix: '/api/admin/connections/wallets' });

  // Register BLOCKS 15-28: Advanced Analytics
  app.register(async (fastify) => {
    console.log('[BOOT] Registering BLOCKS 15-28...');
    try {
      const db = getMongoDb();
      const { registerBlocks15To28Routes, seedBlocks15To28Data } = 
        await import('./modules/connections/blocks-15-28/index.js');
      
      await registerBlocks15To28Routes(fastify, db);
      
      // Seed mock data for development
      if (env.NODE_ENV === 'development') {
        await seedBlocks15To28Data(db);
        
        // Also seed BLOCKS 13-21 data
        const { seedBlocks13To21 } = await import('./modules/connections/blocks-13-21.seed.js');
        await seedBlocks13To21(db);
      }
      
      console.log('[BOOT] BLOCKS 15-28 registered (Bot Farms, AQI, Growth, Clusters, Auth, BMS, etc.)');
    } catch (err) {
      console.error('[BOOT] Failed to register BLOCKS 15-28:', err);
    }
  });

  // Register IPS Module (PHASE G - Informed Action Probability)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering IPS Module (PHASE G)...');
    try {
      const db = getMongoDb();
      const { registerIPSModule } = await import('./modules/ips/index.js');
      await registerIPSModule(fastify, db);
      console.log('[BOOT] IPS Module registered (ADMIN-ONLY)');
    } catch (err) {
      console.error('[BOOT] Failed to register IPS Module:', err);
    }
  });

  // Register Truth Graph Module (PHASE H - Causality Graph)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Truth Graph Module (PHASE H)...');
    try {
      const db = getMongoDb();
      const { registerTruthGraphModule } = await import('./modules/truth-graph/index.js');
      await registerTruthGraphModule(fastify, db);
      console.log('[BOOT] Truth Graph Module registered (ADMIN-ONLY)');
    } catch (err) {
      console.error('[BOOT] Failed to register Truth Graph Module:', err);
    }
  });

  // Register Twitter Module (PHASE T0-T1: Cookie-based parsing)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Twitter Module...');
    try {
      const { registerTwitterModule } = await import('./modules/twitter/twitter.module.js');
      await registerTwitterModule(fastify);
      console.log('[BOOT] Twitter Module registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Twitter Module:', err);
    }
  });

  // Register Twitter Adapter for Connections (ENGINE_READONLY mode)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Twitter Adapter...');
    try {
      const { registerTwitterAdapterRoutes } = await import('./modules/connections/adapters/twitter/index.js');
      await registerTwitterAdapterRoutes(fastify);
      console.log('[BOOT] Twitter Adapter registered (READ-ONLY mode)');
    } catch (err) {
      console.error('[BOOT] Failed to register Twitter Adapter:', err);
    }
  });

  // Register Twitter Egress Slots (V4) - using separate prefix to avoid conflicts
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Twitter Egress Slots V4...');
    try {
      const { getDb } = await import('./db/mongodb.js');
      const { TwitterAccountService } = await import('./modules/twitter_parser_admin/services/twitterAccount.service.js');
      const { TwitterEgressSlotService } = await import('./modules/twitter_parser_admin/services/twitterEgressSlot.service.js');
      const { registerTwitterEgressSlotRoutes } = await import('./modules/twitter_parser_admin/controllers/twitterEgressSlot.controller.js');
      
      const db = getDb();
      const accountService = new TwitterAccountService(db);
      const slotService = new TwitterEgressSlotService(db, accountService);
      
      await slotService.ensureIndexes();
      registerTwitterEgressSlotRoutes(fastify, slotService, accountService);
      console.log('[BOOT] Twitter Egress Slots V4 registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Twitter Egress Slots:', err);
    }
  }, { prefix: '/api/admin/twitter-egress' });

  // БЛОК 13: Early Rotation Predictor
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Early Rotation Predictor (BLOCK 13)...');
    try {
      const db = getMongoDb();
      const { EarlyRotationService, registerEarlyRotationRoutes } = 
        await import('./modules/connections/early-rotation/index.js');
      const service = new EarlyRotationService(db);
      await registerEarlyRotationRoutes(fastify, service);
      console.log('[BOOT] Early Rotation Predictor registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Early Rotation:', err);
    }
  });

  // БЛОК 14: Asset Lifecycle State
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Asset Lifecycle State (BLOCK 14)...');
    try {
      const db = getMongoDb();
      const { AssetLifecycleService, registerAssetLifecycleRoutes } = 
        await import('./modules/connections/asset-lifecycle/index.js');
      const service = new AssetLifecycleService(db);
      await registerAssetLifecycleRoutes(fastify, service);
      console.log('[BOOT] Asset Lifecycle State registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Asset Lifecycle:', err);
    }
  });

  // БЛОК 15: Cluster Lifecycle State
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Cluster Lifecycle State (BLOCK 15)...');
    try {
      const db = getMongoDb();
      const { ClusterLifecycleService, registerClusterLifecycleRoutes } = 
        await import('./modules/connections/cluster-lifecycle/index.js');
      const service = new ClusterLifecycleService(db);
      await registerClusterLifecycleRoutes(fastify, service);
      console.log('[BOOT] Cluster Lifecycle State registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Cluster Lifecycle:', err);
    }
  });

  // БЛОК 16-18: Narrative Intelligence Layer
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Narrative Intelligence Layer (BLOCKS 16-18)...');
    try {
      const db = getMongoDb();
      const { registerNarrativeRoutes } = await import('./modules/narratives/index.js');
      await registerNarrativeRoutes(fastify, db);
      console.log('[BOOT] Narrative Intelligence Layer registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Narratives:', err);
    }
  });

  // БЛОК 20-21: Alpha Surfaces + Feedback Loop
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Alpha Surfaces (BLOCKS 20-21)...');
    try {
      const db = getMongoDb();
      const { registerAlphaRoutes } = await import('./modules/alpha-surfaces/index.js');
      await registerAlphaRoutes(fastify, db);
      console.log('[BOOT] Alpha Surfaces registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Alpha Surfaces:', err);
    }
  });

  // Twitter Parser Integration (Narrative Detection from parsed tweets)
  app.register(async (fastify) => {
    console.log('[BOOT] Registering Twitter Parser Integration...');
    try {
      const db = getMongoDb();
      const { registerTwitterParserIntegrationRoutes } = 
        await import('./modules/twitter/parser-integration/index.js');
      await registerTwitterParserIntegrationRoutes(fastify, db);
      console.log('[BOOT] Twitter Parser Integration registered');
    } catch (err) {
      console.error('[BOOT] Failed to register Twitter Parser Integration:', err);
    }
  });

  return app;
}
