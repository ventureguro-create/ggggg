/**
 * Telegram Intelligence Page
 * Main dashboard for Telegram channel analytics
 */
import { useState, useEffect } from 'react';
import { Search, RefreshCw, TrendingUp, AlertTriangle, Zap, MessageCircle } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';
import TokenMentionsTable from '../components/telegram/TokenMentionsTable';

export default function TelegramIntelPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [channelInput, setChannelInput] = useState('');
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelData, setChannelData] = useState(null);
  const [alphaStats, setAlphaStats] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tokenMentions, setTokenMentions] = useState(null);
  const [mentionsLoading, setMentionsLoading] = useState(false);

  // Load health and stats on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        telegramApi.getTelegramIntelHealth().catch(() => null),
        telegramApi.getAlphaStats(30).catch(() => null),
      ]);
      setHealth(healthRes);
      setAlphaStats(statsRes);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!channelInput.trim()) return;
    
    const username = channelInput.trim().replace(/^@/, '').toLowerCase();
    setActiveChannel(username);
    setError(null);
    setActionLoading(true);

    try {
      const [state, metrics, fraud, mentions] = await Promise.all([
        telegramApi.getChannelState(username).catch(() => null),
        telegramApi.getChannelMetrics(username).catch(() => null),
        telegramApi.getChannelFraud(username).catch(() => null),
        telegramApi.getChannelMentions(username, 30, 50).catch(() => null),
      ]);

      setChannelData({ state, metrics, fraud, mentions });
      
      // Load detailed token mentions with returns
      loadTokenMentions(username);
    } catch (err) {
      setError('Failed to load channel data');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!activeChannel) return;
    setActionLoading(true);
    setError(null);

    try {
      const result = await telegramApi.ingestChannel(activeChannel);
      if (result.ok) {
        // Refresh data after ingestion
        await handleSearch();
      } else {
        setError(result.error || 'Ingestion failed');
      }
    } catch (err) {
      setError('Ingestion request failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanTokens = async () => {
    if (!activeChannel) return;
    setActionLoading(true);
    setError(null);

    try {
      const result = await telegramApi.scanChannelForTokens(activeChannel, 30, 0.35);
      if (result.ok) {
        // Refresh mentions
        const mentions = await telegramApi.getChannelMentions(activeChannel, 30, 50);
        setChannelData(prev => ({ ...prev, mentions }));
      }
    } catch (err) {
      setError('Token scan failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!activeChannel) return;
    setActionLoading(true);
    setError(null);

    try {
      const result = await telegramApi.runPipelineChannel(activeChannel);
      if (result.ok) {
        await handleSearch();
      }
    } catch (err) {
      setError('Pipeline failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="telegram-intel-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telegram Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">
            Channel analytics, fraud detection & alpha tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            health?.runtime?.connected 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {health?.runtime?.mode === 'live' ? 'LIVE' : 'MOCK'}
          </span>
          <button
            onClick={loadInitialData}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {alphaStats?.ok && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<MessageCircle className="w-5 h-5 text-blue-500" />}
            label="Token Mentions"
            value={alphaStats.totalMentions?.toLocaleString() || '0'}
            sub={`${alphaStats.days}d window`}
          />
          <StatCard
            icon={<Zap className="w-5 h-5 text-yellow-500" />}
            label="Unique Tokens"
            value={alphaStats.uniqueTokensCount?.toLocaleString() || '0'}
            sub="Tracked"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-green-500" />}
            label="Top Channels"
            value={alphaStats.topChannels?.length || '0'}
            sub="Active"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            label="Module"
            value={health?.version || '—'}
            sub={health?.runtime?.connected ? 'Connected' : 'Disconnected'}
          />
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter channel username (e.g., durov)"
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="channel-search-input"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={actionLoading || !channelInput.trim()}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="channel-search-btn"
          >
            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Channel Data */}
      {activeChannel && channelData && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">@{activeChannel}</span>
            <button
              onClick={handleIngest}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              Ingest Posts
            </button>
            <button
              onClick={handleScanTokens}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
            >
              Scan Tokens
            </button>
            <button
              onClick={handleRunPipeline}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
            >
              Run Pipeline
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* State */}
            {channelData.state?.ok && (
              <DataCard title="Channel State">
                <DataRow label="Last Message ID" value={channelData.state.state?.lastMessageId || '—'} />
                <DataRow label="Last Ingest" value={formatDate(channelData.state.state?.lastIngestAt)} />
                <DataRow label="Next Allowed" value={formatDate(channelData.state.state?.nextAllowedIngestAt)} />
                <DataRow label="Error Count" value={channelData.state.state?.errorCount || 0} />
              </DataCard>
            )}

            {/* Fraud */}
            {channelData.fraud?.ok && (
              <DataCard title="Fraud Analysis">
                <DataRow 
                  label="Fraud Risk" 
                  value={`${((channelData.fraud.fraud?.fraudRisk || 0) * 100).toFixed(1)}%`}
                  highlight={channelData.fraud.fraud?.fraudRisk > 0.5 ? 'red' : 'green'}
                />
                <DataRow label="Subscriber Efficiency" value={(channelData.fraud.fraud?.subscriberEfficiency || 0).toFixed(3)} />
                <DataRow label="Spike Ratio" value={(channelData.fraud.fraud?.spikeRatio || 0).toFixed(2)} />
                <DataRow label="Elasticity" value={(channelData.fraud.fraud?.elasticity || 0).toFixed(4)} />
              </DataCard>
            )}

            {/* Metrics */}
            {channelData.metrics?.ok && channelData.metrics.metrics?.length > 0 && (
              <DataCard title="Window Metrics">
                {channelData.metrics.metrics.map((m) => (
                  <div key={m.window} className="mb-3 pb-3 border-b last:border-0 last:mb-0 last:pb-0">
                    <div className="text-xs font-medium text-gray-500 mb-1">{m.window}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-600">Posts: {m.postsCount}</span>
                      <span className="text-gray-600">Views: {m.medianViews?.toLocaleString()}</span>
                      <span className="text-gray-600">Forward: {(m.forwardRate * 100).toFixed(2)}%</span>
                      <span className="text-gray-600">Disp: {m.viewDispersion?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </DataCard>
            )}

            {/* Token Mentions */}
            {channelData.mentions?.ok && (
              <DataCard title={`Token Mentions (${channelData.mentions.totalMentions})`}>
                {channelData.mentions.topTokens?.slice(0, 8).map((t) => (
                  <div key={t.token} className="flex justify-between py-1 text-sm">
                    <span className="font-medium text-gray-900">${t.token}</span>
                    <span className="text-gray-500">{t.count} mentions</span>
                  </div>
                ))}
                {(!channelData.mentions.topTokens || channelData.mentions.topTokens.length === 0) && (
                  <p className="text-sm text-gray-400">No tokens found. Click "Scan Tokens" to extract.</p>
                )}
              </DataCard>
            )}
          </div>
        </div>
      )}

      {/* Top Tokens (Global) */}
      {alphaStats?.topTokens?.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Top Mentioned Tokens (30d)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {alphaStats.topTokens.slice(0, 15).map((t) => (
              <div key={t.token} className="p-2 bg-gray-50 rounded-lg text-center">
                <div className="font-bold text-gray-900">${t.token}</div>
                <div className="text-xs text-gray-500">{t.count} mentions</div>
                <div className="text-xs text-gray-400">conf: {t.avgConfidence}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
          {sub && <div className="text-xs text-gray-400">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function DataCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DataRow({ label, value, highlight }) {
  const color = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : 'text-gray-900';
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
