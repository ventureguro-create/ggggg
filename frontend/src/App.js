import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { Suspense, lazy } from "react";
import { WebSocketProvider } from "./context/WebSocketContext.jsx";
import { ActivePathProvider } from "./context/ActivePathContext.jsx"; // ETAP C
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import AppLayout from "./layout/AppLayout";
import { useDashboard } from "./hooks/useDashboard";

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      <p className="text-sm text-gray-500 font-medium">Loading...</p>
    </div>
  </div>
);

// Lazy loaded pages - Code Splitting
// Critical pages (loaded immediately for fast initial render)
import MarketDiscovery from "./pages/MarketDiscovery";
import P0Dashboard from "./pages/P0Dashboard";

// Advanced v2 (loaded immediately)
import SystemOverview from "./pages/SystemOverview";
import MLHealth from "./pages/MLHealth";
import SignalsAttribution from "./pages/SignalsAttribution";

// Main navigation pages (lazy loaded)
// ENHANCED: L1+L2 architecture preserving ALL working logic
const TokensPage = lazy(() => import("./pages/TokensPageEnhanced"));
const WalletsPage = lazy(() => import("./pages/WalletsPage"));
const EntitiesPage = lazy(() => import("./pages/EntitiesPage"));
const SignalsPage = lazy(() => import("./pages/SignalsPageD1"));
const SignalDetailPage = lazy(() => import("./pages/SignalDetailPage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
// Alerts V2 - System & Intelligence Notifications (replaced legacy AlertsPage)
const AlertsPage = lazy(() => import("./pages/AlertsPageV2"));
const StrategiesPage = lazy(() => import("./pages/StrategiesPage"));
const ActorsPage = lazy(() => import("./pages/ActorsPage"));
const ActorsGraphPage = lazy(() => import("./pages/ActorsGraphPage"));
const ActorDetailPage = lazy(() => import("./pages/ActorDetailPage"));
const CorrelationPage = lazy(() => import("./pages/CorrelationPage"));
// PHASE 4.1: V2 UI Pages (replacing V1)
const EnginePage = lazy(() => import("./pages/EnginePageV2"));
const EngineDashboard = lazy(() => import("./pages/EngineDashboardV2"));
// P0.2 - Registries Page (Token Registry + Address Labels)
const RegistriesPage = lazy(() => import("./pages/RegistriesPage"));
const RankingsDashboard = lazy(() => import("./pages/RankingsDashboardV2"));
const AttributionDashboard = lazy(() => import("./pages/AttributionDashboard"));
const MLReadyDashboard = lazy(() => import("./pages/MLReadyDashboard"));
// PHASE 4.2: Shadow Mode Dashboard
const ShadowModeDashboard = lazy(() => import("./pages/ShadowModeDashboard"));
// PHASE 4.3: Data Pipeline Monitoring
const DataPipelineMonitoring = lazy(() => import("./pages/DataPipelineMonitoring"));
const ShadowMLDashboard = lazy(() => import("./pages/ShadowMLDashboard"));

// Phase 4.6 - ML Intelligence Dashboard
const IntelligencePage = lazy(() => import("./components/IntelligencePage"));

// P1 - ML Monitoring Dashboard
const MLMonitoringPage = lazy(() => import("./pages/MLMonitoringPage"));

// P2.A - Confidence Dashboard
const ConfidenceDashboardPage = lazy(() => import("./pages/admin/metrics/ConfidenceDashboardPage"));

// Admin Panel Pages
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminMLPage = lazy(() => import("./pages/admin/AdminMLPage"));
const AdminProvidersPage = lazy(() => import("./pages/admin/AdminProvidersPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));
const SystemOverviewPage = lazy(() => import("./pages/admin/SystemOverviewPage"));
const DataPipelinesPage = lazy(() => import("./pages/admin/DataPipelinesPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminBacktestingPage = lazy(() => import("./pages/admin/AdminBacktestingPage"));
const AdminValidationPage = lazy(() => import("./pages/admin/AdminValidationPage"));
const AdminMLAccuracyPage = lazy(() => import("./pages/admin/AdminMLAccuracyPage"));
const AdminRetrainPage = lazy(() => import("./pages/admin/AdminRetrainPage"));
// ML v2.3 - Auto-Retrain Policies + Feature Analysis
const AdminAutoRetrainPage = lazy(() => import("./pages/admin/AdminAutoRetrainPage"));
const AdminMLFeaturesPage = lazy(() => import("./pages/admin/AdminMLFeaturesPage"));
// ML Governance - Approvals
const AdminApprovalsPage = lazy(() => import("./pages/admin/AdminApprovalsPage"));
// D4 - Indexer Control Panel
const IndexerPage = lazy(() => import("./pages/admin/IndexerPage"));

// Twitter Parser Admin v4.0
const TwitterParserAccountsPage = lazy(() => import("./pages/admin/TwitterParserAccountsPage"));
const TwitterParserSessionsPage = lazy(() => import("./pages/admin/TwitterParserSessionsPage"));
const TwitterParserSlotsPage = lazy(() => import("./pages/admin/TwitterParserSlotsPage"));
const TwitterParserMonitorPage = lazy(() => import("./pages/admin/TwitterParserMonitorPage"));
// ProxySlotsPage removed - не используется

// A.3 - Admin Control Plane (Twitter Users)
const AdminTwitterPage = lazy(() => import("./pages/admin/twitter/AdminTwitterPage"));
const AdminUserDetailPage = lazy(() => import("./pages/admin/twitter/AdminUserDetailPage"));
const AdminPoliciesPage = lazy(() => import("./pages/admin/twitter/AdminPoliciesPage"));
const AdminSystemPage = lazy(() => import("./pages/admin/twitter/AdminSystemPage"));
// Phase 7.1 - Admin System Control Panel (enhanced)
const AdminSystemControlPage = lazy(() => import("./pages/admin/twitter/AdminSystemControlPage"));
const AdminLoadTestPage = lazy(() => import("./pages/admin/twitter/AdminLoadTestPage"));
const AdminConsentPoliciesPage = lazy(() => import("./pages/admin/twitter/AdminConsentPoliciesPage"));

// TASK 2: Admin System Parsing Console (SYSTEM scope)
const SystemParsingLayout = lazy(() => import("./pages/admin/system-parsing/SystemParsingLayout"));
const SystemHealthPage = lazy(() => import("./pages/admin/system-parsing/SystemHealthPage"));
const SystemAccountsPage = lazy(() => import("./pages/admin/system-parsing/SystemAccountsPage"));
const SystemSessionsPage = lazy(() => import("./pages/admin/system-parsing/SystemSessionsPage"));
const SystemTasksPage = lazy(() => import("./pages/admin/system-parsing/SystemTasksPage"));

// B4 - User-Facing Parser UI
const ParserOverviewPage = lazy(() => import("./pages/dashboard/parser/ParserOverviewPage"));

// P4.1 - Twitter Integration (User-Owned Accounts)
const TwitterIntegrationPage = lazy(() => import("./pages/dashboard/twitter/TwitterIntegrationPage"));
const TwitterTargetsPage = lazy(() => import("./pages/dashboard/twitter/TwitterTargetsPage"));

// P4.1 - Notification Settings
const NotificationsSettingsPage = lazy(() => import("./pages/settings/NotificationsSettingsPage"));

// Settings - API Keys
const ApiKeysSettingsPage = lazy(() => import("./pages/settings/ApiKeysSettingsPage"));

// A1 - Admin ML & Signals Pages
const AdminSignalsPage = lazy(() => import("./pages/admin/AdminSignalsPage"));
const AdminDatasetsPage = lazy(() => import("./pages/admin/AdminDatasetsPage"));
const AdminModelsPage = lazy(() => import("./pages/admin/AdminModelsPage"));
const AdminAblationPage = lazy(() => import("./pages/admin/AdminAblationPage"));

// Connections Admin Control Plane
const AdminConnectionsPage = lazy(() => import("./pages/admin/AdminConnectionsPage"));
const AdminStabilityPage = lazy(() => import("./pages/admin/AdminStabilityPage"));
const AdminAttributionPage = lazy(() => import("./pages/admin/AdminAttributionPage"));

// E2 - Reality Gate Admin
const AdminRealityGatePage = lazy(() => import("./pages/admin/AdminRealityGatePage"));

// E3 - Wallet Attribution Admin
const AdminWalletAttributionPage = lazy(() => import("./pages/admin/AdminWalletAttributionPage"));

// E1 - On-chain Adapter Admin
const AdminOnchainAdapterPage = lazy(() => import("./pages/admin/AdminOnchainAdapterPage"));

// P1.8 - Graph Intelligence Page
const GraphIntelligencePage = lazy(() => import("./pages/GraphIntelligencePage"));

// P0 MULTICHAIN - Wallet Explorer
const WalletExplorerPage = lazy(() => import("./pages/WalletExplorerPage"));

// P1 - Market Signals Dashboard
const MarketSignalsPage = lazy(() => import("./pages/MarketSignalsPage"));

// S3.7 - Classic Sentiment Analyzer (URL-first)
const SentimentPage = lazy(() => import("./pages/SentimentPage"));

// S3.9 - Twitter Feed (Sentiment без цены)
const TwitterFeedPage = lazy(() => import("./pages/TwitterSentimentPage"));

// S5 - Twitter AI (Sentiment × Price)
const TwitterAIPage = lazy(() => import("./pages/TwitterAIPage"));

// Connections - Influence Scoring
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const ConnectionsDetailPage = lazy(() => import("./pages/ConnectionsDetailPage"));
const ConnectionsEarlySignalPage = lazy(() => import("./pages/ConnectionsEarlySignalPage"));
const ConnectionsInfluenceGraphPage = lazy(() => import("./pages/ConnectionsInfluenceGraphPage"));
const ConnectionsBackersPage = lazy(() => import("./pages/ConnectionsBackersPage"));

// Influencers Page (showcase)
const ConnectionsInfluencersPage = lazy(() => import("./pages/connections/ConnectionsInfluencersPage"));
const InfluencerDetailPage = lazy(() => import("./pages/connections/InfluencerDetailPage"));
const BackerDetailPage = lazy(() => import("./pages/BackerDetailPage"));

// AQE - Audience Quality Pages
const InfluencerAudiencePage = lazy(() => import("./pages/InfluencerAudiencePage"));

// БЛОК 1 - Unified Accounts with Facets
const UnifiedAccountsPage = lazy(() => import("./pages/UnifiedAccountsPage"));

// БЛОК 6+7 - New Unified & Graph V2 Pages
const ConnectionsUnifiedPage = lazy(() => import("./pages/connections/ConnectionsUnifiedPage"));
const ConnectionsGraphV2Page = lazy(() => import("./pages/connections/ConnectionsGraphV2Page"));

// Cluster Attention - Coordinated Pump Detection
const ClusterAttentionPage = lazy(() => import("./pages/connections/ClusterAttentionPage"));

// Alt Season Monitor - Opportunities & Market State
const AltSeasonPage = lazy(() => import("./pages/connections/AltSeasonPage"));

// PHASE E4 - Reality Leaderboard
const RealityLeaderboardPage = lazy(() => import("./pages/connections/Reality/RealityLeaderboardPage"));

// PHASE E2 - Project Detail Page
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));

// БЛОК 11 - Connections Watchlist Page
const ConnectionsWatchlistPage = lazy(() => import("./pages/connections/WatchlistPage"));

// BLOCKS 13-21 - Lifecycle & Narratives Pages
const LifecyclePage = lazy(() => import("./pages/connections/LifecyclePage"));
const NarrativesPage = lazy(() => import("./pages/connections/NarrativesPage"));

// BLOCKS 15-28 - Advanced Analytics Pages
const FarmNetworkPage = lazy(() => import("./pages/connections/FarmNetworkPage"));
const StrategySimulationPage = lazy(() => import("./pages/connections/StrategySimulationPage"));

// S3.8.2 - Sentiment Admin Dashboard
const AdminSentimentPage = lazy(() => import("./pages/admin/AdminSentimentPage"));

// U1.2 - Market Signals A-F Cards
const MarketSignalsU12Page = lazy(() => import("./modules/market/MarketSignalsPage"));

// FREEZE v2.3 - Unified Market Hub
const MarketHub = lazy(() => import("./pages/MarketHub"));

// S1.4 - User Strategies Page
const MarketStrategiesPage = lazy(() => import("./pages/MarketStrategiesPage"));

// P2.4.3 - Graph Share Page (standalone, no layout)
const GraphSharePage = lazy(() => import("./pages/share/GraphSharePage"));

// Legal Pages (Chrome Extension Privacy Policy - required for Chrome Web Store)
const ChromeExtensionPrivacyPage = lazy(() => import("./pages/legal/ChromeExtensionPrivacyPage"));

// Token Pages - NEW CANONICAL ROUTING ARCHITECTURE
// Alias route: /token/:symbol → resolves to canonical
// Canonical route: /token/:chainId/:address → source of truth
const TokenAliasResolver = lazy(() => import("./pages/TokenAliasResolver"));
const TokenCanonicalPage = lazy(() => import("./pages/TokenCanonicalPage"));

// Detail pages (lazy loaded - less frequently accessed)
const TokenDetail = lazy(() => import("./pages/TokenDetailRefactored"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const SignalSnapshot = lazy(() => import("./pages/SignalSnapshot"));
const ActorProfile = lazy(() => import("./pages/ActorProfile"));

function App() {
  const { data } = useDashboard(1, 1); // Fetch only for globalState

  return (
    <WebSocketProvider>
      <ActivePathProvider>
        <AdminAuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Admin Panel Routes (standalone, no main layout) */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/system-overview" element={<SystemOverviewPage />} />
              <Route path="/admin/data-pipelines" element={<DataPipelinesPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/backtesting" element={<AdminBacktestingPage />} />
              <Route path="/admin/validation" element={<AdminValidationPage />} />
              <Route path="/admin/ml-accuracy" element={<AdminMLAccuracyPage />} />
              <Route path="/admin/retrain" element={<AdminRetrainPage />} />
              <Route path="/admin/auto-retrain" element={<AdminAutoRetrainPage />} />
              <Route path="/admin/ml-features" element={<AdminMLFeaturesPage />} />
              <Route path="/admin/ml/approvals" element={<AdminApprovalsPage />} />
              <Route path="/admin/indexer" element={<IndexerPage />} />
              
              {/* Twitter Parser Admin v4.0 */}
              <Route path="/admin/twitter-parser/accounts" element={<TwitterParserAccountsPage />} />
              <Route path="/admin/twitter-parser/sessions" element={<TwitterParserSessionsPage />} />
              <Route path="/admin/twitter-parser/slots" element={<TwitterParserSlotsPage />} />
              <Route path="/admin/twitter-parser/monitor" element={<TwitterParserMonitorPage />} />
              {/* proxy-slots route removed */}
              
              {/* A.3 - Admin Control Plane (Twitter Users) */}
              <Route path="/admin/twitter" element={<AdminTwitterPage />} />
              <Route path="/admin/twitter/users/:userId" element={<AdminUserDetailPage />} />
              <Route path="/admin/twitter/policies" element={<AdminPoliciesPage />} />
              <Route path="/admin/twitter/consent-policies" element={<AdminConsentPoliciesPage />} />
              <Route path="/admin/twitter/system" element={<AdminSystemControlPage />} />
              <Route path="/admin/twitter/system-legacy" element={<AdminSystemPage />} />
              <Route path="/admin/twitter/performance" element={<AdminLoadTestPage />} />
              
              {/* TASK 2: Admin System Parsing Console (SYSTEM scope) */}
              <Route path="/admin/system-parsing" element={<SystemParsingLayout />}>
                <Route index element={<SystemHealthPage />} />
                <Route path="accounts" element={<SystemAccountsPage />} />
                <Route path="sessions" element={<SystemSessionsPage />} />
                <Route path="tasks" element={<SystemTasksPage />} />
              </Route>
              
              {/* A1 - Admin ML & Signals */}
              <Route path="/admin/signals" element={<AdminSignalsPage />} />
              <Route path="/admin/ml/datasets" element={<AdminDatasetsPage />} />
              
              {/* Connections Admin Control Plane */}
              <Route path="/admin/connections" element={<AdminConnectionsPage />} />
              <Route path="/admin/connections/reality-gate" element={<AdminRealityGatePage />} />
              <Route path="/admin/connections/wallet-attribution" element={<AdminWalletAttributionPage />} />
              <Route path="/admin/connections/onchain-adapter" element={<AdminOnchainAdapterPage />} />
              <Route path="/admin/ml/models" element={<AdminModelsPage />} />
              <Route path="/admin/ml/ablation" element={<AdminAblationPage />} />
              <Route path="/admin/ml/stability" element={<AdminStabilityPage />} />
              <Route path="/admin/ml/attribution" element={<AdminAttributionPage />} />
              
              <Route path="/admin/ml" element={<AdminMLPage />} />
              <Route path="/admin/providers" element={<AdminProvidersPage />} />
              <Route path="/admin/audit" element={<AdminAuditPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
              
              {/* P2.4.3: Standalone share page (no layout) */}
              <Route path="/share/graph/:shareId" element={<GraphSharePage />} />
              
              {/* Legal Pages (Chrome Web Store compliance) */}
              <Route path="/privacy/chrome-extension" element={<ChromeExtensionPrivacyPage />} />
              
              {/* U1.2: Market Signals A-F Cards (standalone) */}
              <Route path="/market/signals/:asset" element={<MarketSignalsU12Page />} />
              <Route path="/market/signals" element={<MarketSignalsU12Page />} />
              
              {/* S1.4: User Strategies Page */}
              <Route path="/market/strategies/:network" element={<MarketStrategiesPage />} />
              <Route path="/market/strategies" element={<MarketStrategiesPage />} />
              
              <Route element={<AppLayout globalState={data?.globalState} />}>
                {/* Main Navigation */}
                <Route path="/" element={<P0Dashboard />} />
              {/* Connections - Influence Scoring */}
              <Route path="/connections" element={<ConnectionsPage />} />
              <Route path="/connections/unified" element={<ConnectionsUnifiedPage />} />
              <Route path="/connections/groups" element={<ConnectionsUnifiedPage />} />
              <Route path="/connections/radar" element={<ConnectionsEarlySignalPage />} />
              <Route path="/connections/reality" element={<RealityLeaderboardPage />} />
              <Route path="/connections/graph" element={<ConnectionsGraphV2Page />} />
              <Route path="/connections/graph-v2" element={<ConnectionsGraphV2Page />} />
              <Route path="/connections/clusters" element={<ClusterAttentionPage />} />
              <Route path="/connections/cluster-attention" element={<ClusterAttentionPage />} />
              <Route path="/connections/alt-season" element={<AltSeasonPage />} />
              <Route path="/connections/opportunities" element={<AltSeasonPage />} />
              {/* BLOCKS 13-21: Lifecycle & Narratives */}
              <Route path="/connections/lifecycle" element={<LifecyclePage />} />
              <Route path="/connections/narratives" element={<NarrativesPage />} />
              <Route path="/connections/alpha" element={<NarrativesPage />} />
              <Route path="/connections/backers" element={<ConnectionsBackersPage />} />
              <Route path="/connections/backers/:slug" element={<BackerDetailPage />} />
              {/* Influencers showcase */}
              <Route path="/connections/influencers" element={<ConnectionsInfluencersPage />} />
              <Route path="/connections/influencers/:handle" element={<InfluencerDetailPage />} />
              <Route path="/connections/influencers/:handle/audience" element={<InfluencerAudiencePage />} />
              {/* E2 Phase - Project Detail Pages */}
              <Route path="/connections/projects/:slug" element={<ProjectDetailPage />} />
              <Route path="/connections/watchlists" element={<ConnectionsWatchlistPage />} />
              <Route path="/connections/watchlists/:id" element={<ConnectionsWatchlistPage />} />
              {/* BLOCKS 15-28: Advanced Analytics */}
              <Route path="/connections/farm-network" element={<FarmNetworkPage />} />
              <Route path="/connections/strategy-simulation" element={<StrategySimulationPage />} />
              <Route path="/connections/:authorId" element={<ConnectionsDetailPage />} />
              {/* FREEZE v2.3: Unified Market Hub (replaces /market + /market-signals) */}
              <Route path="/market" element={<MarketHub />} />
              <Route path="/market-signals" element={<MarketHub />} /> {/* Redirect */}
              <Route path="/tokens" element={<TokensPage />} />
              <Route path="/wallets" element={<WalletsPage />} />
              <Route path="/entities" element={<EntitiesPage />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/signals/:id" element={<SignalDetailPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/strategies" element={<StrategiesPage />} />
              <Route path="/actors" element={<ActorsPage />} />
              <Route path="/actors/graph" element={<ActorsGraphPage />} />
              <Route path="/actors/correlation" element={<CorrelationPage />} />
              <Route path="/actors/:actorId" element={<ActorDetailPage />} />
              <Route path="/engine" element={<EnginePage />} />
              <Route path="/engine/dashboard" element={<EngineDashboard />} />
              <Route path="/shadow" element={<ShadowModeDashboard />} />
              <Route path="/pipeline" element={<DataPipelineMonitoring />} />
              <Route path="/registries" element={<RegistriesPage />} />
              <Route path="/rankings" element={<RankingsDashboard />} />
              <Route path="/attribution" element={<AttributionDashboard />} />
              <Route path="/ml-ready" element={<MLReadyDashboard />} />
              <Route path="/shadow-ml" element={<ShadowMLDashboard />} />
              
              {/* Phase 4.6 - ML Intelligence Dashboard */}
              <Route path="/intelligence" element={<IntelligencePage />} />
              
              {/* P1 - ML Monitoring Dashboard */}
              <Route path="/ml-monitoring" element={<MLMonitoringPage />} />
              
              {/* Advanced v2 - 3 screens */}
              <Route path="/advanced/system-overview" element={<SystemOverview />} />
              <Route path="/advanced/ml-health" element={<MLHealth />} />
              <Route path="/advanced/signals-attribution" element={<SignalsAttribution />} />
              
              {/* P2.A - Admin Metrics */}
              <Route path="/admin/metrics/confidence" element={<ConfidenceDashboardPage />} />
              
              {/* B4 - Twitter Parser User UI */}
              <Route path="/dashboard/parser" element={<ParserOverviewPage />} />
              <Route path="/parsing" element={<ParserOverviewPage />} />
              
              {/* P4.1 - Twitter Integration (User-Owned Accounts) */}
              <Route path="/dashboard/twitter" element={<TwitterIntegrationPage />} />
              <Route path="/dashboard/twitter/targets" element={<TwitterTargetsPage />} />
              <Route path="/twitter" element={<TwitterIntegrationPage />} />
              
              {/* S2.2 - Sentiment Analyzer */}
              <Route path="/sentiment" element={<SentimentPage />} />
              
              {/* S3.9 - Twitter Feed (Sentiment без цены) */}
              <Route path="/sentiment/twitter" element={<TwitterFeedPage />} />
              
              {/* S5 - Twitter AI (Sentiment × Price) */}
              <Route path="/sentiment/twitter-ai" element={<TwitterAIPage />} />
              
              {/* S3.8.2 - Sentiment Admin Dashboard (in Platform Admin) */}
              <Route path="/admin/ml/sentiment" element={<AdminSentimentPage />} />
              
              {/* P4.1 - Settings */}
              <Route path="/settings/notifications" element={<NotificationsSettingsPage />} />
              <Route path="/settings/api-keys" element={<ApiKeysSettingsPage />} />
              
              {/* P1.8 - Graph Intelligence */}
              <Route path="/graph-intelligence" element={<GraphIntelligencePage />} />
              
              {/* P0 MULTICHAIN - Wallet Explorer */}
              <Route path="/wallet-explorer" element={<WalletExplorerPage />} />
              
              {/* Legacy Market Signals route (redirects to Market Hub) */}
              {/* /market-signals now handled above as redirect to MarketHub */}
              
              {/* TOKEN ROUTING - NEW CANONICAL ARCHITECTURE */}
              {/* Canonical URL: /token/:chainId/:address - Source of truth */}
              <Route path="/token/:chainId/:address" element={<TokenCanonicalPage />} />
              {/* Alias URL: /token/:symbol - Resolves to canonical */}
              <Route path="/token/:symbol" element={<TokenAliasResolver />} />
              
              {/* Legacy token routes (backwards compatibility) */}
              <Route path="/tokens/:address" element={<TokensPage />} />
              
              {/* Other Detail Pages */}
              <Route path="/portfolio/:address" element={<Portfolio />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/entity/:entityId" element={<EntityDetail />} />
              <Route path="/signal/:id" element={<SignalSnapshot />} />
              
              {/* Fallback */}
              <Route path="/*" element={<P0Dashboard />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </BrowserRouter>
      </AdminAuthProvider>
      </ActivePathProvider>
    </WebSocketProvider>
  );
}

export default App;
