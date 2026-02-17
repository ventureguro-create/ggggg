/**
 * S3.8.2 — Sentiment Admin Dashboard
 * 
 * Platform Admin page for Sentiment Engine control & diagnostics.
 * Uses AdminLayout (light theme) - part of ML & Intelligence section.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Activity,
  Settings,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Database,
  Server,
  BarChart3,
  FileText,
  Loader2,
  MessageCircle,
  Twitter,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Health status badge (light theme)
const HealthBadge = ({ health }) => {
  const styles = {
    HEALTHY: 'bg-green-100 text-green-700 border-green-300',
    DEGRADED: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    DISABLED: 'bg-red-100 text-red-700 border-red-300',
  };
  const icons = {
    HEALTHY: <CheckCircle className="w-3 h-3" />,
    DEGRADED: <AlertTriangle className="w-3 h-3" />,
    DISABLED: <XCircle className="w-3 h-3" />,
  };
  return (
    <Badge className={`${styles[health] || styles.DISABLED} flex items-center gap-1`}>
      {icons[health]}
      {health}
    </Badge>
  );
};

// Format uptime
const formatUptime = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

export default function AdminSentimentPage() {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, loading: authLoading } = useAdminAuth();
  
  const [activeTab, setActiveTab] = useState('status');
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [evalReports, setEvalReports] = useState([]);
  const [runs, setRuns] = useState([]);
  const [twitterRuntime, setTwitterRuntime] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [loading, setLoading] = useState({ status: true, config: true, eval: true, runs: true, twitter: true, automation: true });
  const [error, setError] = useState(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [testTweet, setTestTweet] = useState('');
  const [testTweetResult, setTestTweetResult] = useState(null);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/status`);
      const data = await res.json();
      if (data.ok) setStatus(data.data);
    } catch (e) {
      console.error('Failed to fetch status:', e);
    } finally {
      setLoading(l => ({ ...l, status: false }));
    }
  }, []);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/config`);
      const data = await res.json();
      if (data.ok) setConfig(data.data);
    } catch (e) {
      console.error('Failed to fetch config:', e);
    } finally {
      setLoading(l => ({ ...l, config: false }));
    }
  }, []);

  // Fetch eval reports
  const fetchEvalReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/eval-reports?limit=10`);
      const data = await res.json();
      if (data.ok) setEvalReports(data.data || []);
    } catch (e) {
      console.error('Failed to fetch eval reports:', e);
    } finally {
      setLoading(l => ({ ...l, eval: false }));
    }
  }, []);

  // Fetch runs
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/runs?limit=20`);
      const data = await res.json();
      if (data.ok) setRuns(data.data || []);
    } catch (e) {
      console.error('Failed to fetch runs:', e);
    } finally {
      setLoading(l => ({ ...l, runs: false }));
    }
  }, []);

  // Fetch Twitter Runtime (Phase 10.8)
  const fetchTwitterRuntime = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/twitter/status`);
      const data = await res.json();
      if (data.ok) setTwitterRuntime(data.data);
    } catch (e) {
      console.error('Failed to fetch twitter runtime:', e);
    } finally {
      setLoading(l => ({ ...l, twitter: false }));
    }
  }, []);

  // Validate test tweet
  const validateTestTweet = async () => {
    if (!testTweet.trim()) return;
    setActionLoading('testTweet');
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/twitter/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweet: {
            id: 'test_' + Date.now(),
            text: testTweet,
            author: { username: 'test_user', followers: 1000, verified: false },
            metrics: { likes: 50, retweets: 10, replies: 5 },
          },
        }),
      });
      const data = await res.json();
      if (data.ok) setTestTweetResult(data.data);
    } catch (e) {
      console.error('Failed to validate tweet:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Twitter runtime
  const toggleTwitterRuntime = async (enabled) => {
    setActionLoading('twitterToggle');
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/twitter/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.ok) await fetchTwitterRuntime();
    } catch (e) {
      console.error('Failed to toggle twitter:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset Twitter health
  const resetTwitterHealth = async () => {
    setActionLoading('twitterReset');
    try {
      await fetch(`${API_URL}/api/v4/admin/sentiment/twitter/reset`, { method: 'POST' });
      await fetchTwitterRuntime();
    } catch (e) {
      console.error('Failed to reset twitter:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Fetch Automation status (S4.1)
  const fetchAutomation = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/automation/status`);
      const data = await res.json();
      if (data.ok) setAutomation(data.data);
    } catch (e) {
      console.error('Failed to fetch automation:', e);
    } finally {
      setLoading(l => ({ ...l, automation: false }));
    }
  }, []);

  // Start/Stop Automation
  const toggleAutomation = async (start) => {
    setActionLoading('automationToggle');
    try {
      const endpoint = start ? 'start' : 'stop';
      await fetch(`${API_URL}/api/v4/admin/sentiment/automation/${endpoint}`, { method: 'POST' });
      await fetchAutomation();
    } catch (e) {
      console.error('Failed to toggle automation:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Clear automation queue
  const clearAutomationQueue = async () => {
    setActionLoading('automationClear');
    try {
      await fetch(`${API_URL}/api/v4/admin/sentiment/automation/clear`, { method: 'POST' });
      await fetchAutomation();
    } catch (e) {
      console.error('Failed to clear queue:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset automation
  const resetAutomation = async () => {
    setActionLoading('automationReset');
    try {
      await fetch(`${API_URL}/api/v4/admin/sentiment/automation/reset`, { method: 'POST' });
      await fetchAutomation();
    } catch (e) {
      console.error('Failed to reset automation:', e);
    } finally {
      setActionLoading(null);
    }
  };

  // Run evaluation
  const runEvaluation = async () => {
    if (!isAdmin) return;
    setIsRunningEval(true);
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/run-eval`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        await fetchEvalReports();
      } else {
        setError(data.message || 'Evaluation failed');
      }
    } catch (e) {
      setError('Failed to run evaluation');
    } finally {
      setIsRunningEval(false);
    }
  };

  // Update config
  const updateConfig = async () => {
    if (!isAdmin) return;
    setConfigError(null);
    setActionLoading('config');
    try {
      const res = await fetch(`${API_URL}/api/v4/admin/sentiment/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.data);
        setConfigDirty(false);
      } else {
        setConfigError(data.message || 'Failed to update config');
      }
    } catch (e) {
      setConfigError('Failed to update config');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle threshold change
  const handleThresholdChange = (key, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setConfig(c => ({
        ...c,
        thresholds: { ...c.thresholds, [key]: numValue }
      }));
      setConfigDirty(true);
    }
  };

  // Handle rule toggle
  const handleRuleToggle = (key) => {
    setConfig(c => ({
      ...c,
      rules: { ...c.rules, [key]: !c.rules[key] }
    }));
    setConfigDirty(true);
  };

  // Handle mode toggle
  const handleModeToggle = (key) => {
    setConfig(c => ({
      ...c,
      modes: { ...c.modes, [key]: !c.modes[key] }
    }));
    setConfigDirty(true);
  };

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
      return;
    }
    if (isAuthenticated) {
      fetchStatus();
      fetchConfig();
      fetchEvalReports();
      fetchRuns();
      fetchTwitterRuntime();
      fetchAutomation();
    }
  }, [authLoading, isAuthenticated, navigate, fetchStatus, fetchConfig, fetchEvalReports, fetchRuns, fetchTwitterRuntime, fetchAutomation]);

  // Auto-refresh status every 30s
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Loading state
  if (authLoading || (loading.status && loading.config)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sentiment Engine</h1>
              <p className="text-sm text-slate-500">Control, diagnostics, and evaluation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status && <HealthBadge health={status.health} />}
            <Button 
              variant="outline" 
              onClick={() => {
                fetchStatus();
                fetchConfig();
                fetchEvalReports();
                fetchRuns();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-700 hover:text-red-900">×</button>
          </div>
        )}

        {!isAdmin && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            Read-only mode. Only ADMIN role can modify settings.
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 border border-slate-200">
            <TabsTrigger value="status" className="data-[state=active]:bg-white">
              <Activity className="w-4 h-4 mr-2" />
              Status
            </TabsTrigger>
            <TabsTrigger value="twitter" className="data-[state=active]:bg-white">
              <Twitter className="w-4 h-4 mr-2" />
              Twitter
            </TabsTrigger>
            <TabsTrigger value="automation" className="data-[state=active]:bg-white">
              <Zap className="w-4 h-4 mr-2" />
              Automation (S4)
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-white">
              <Settings className="w-4 h-4 mr-2" />
              Config
            </TabsTrigger>
            <TabsTrigger value="eval" className="data-[state=active]:bg-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Evaluation
            </TabsTrigger>
            <TabsTrigger value="runs" className="data-[state=active]:bg-white">
              <FileText className="w-4 h-4 mr-2" />
              Runs Log
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Engine Status */}
              <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="status-engine-card">
                <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                  <Server className="w-4 h-4" />
                  Engine Status
                </h3>
                {loading.status ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Mode</span>
                      <Badge className={status.engineMode === 'mock' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                        {status.engineMode.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Health</span>
                      <HealthBadge health={status.health} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Uptime</span>
                      <span className="font-mono text-slate-900">{formatUptime(status.uptimeSec)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Failed to load</p>
                )}
              </div>

              {/* Performance */}
              <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="status-performance-card">
                <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4" />
                  Performance
                </h3>
                {status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Avg Latency</span>
                      <span className="font-mono text-slate-900">{status.avgLatencyMs}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Requests/Hour</span>
                      <span className="font-mono text-slate-900">{status.requestsLastHour}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Failed to load</p>
                )}
              </div>

              {/* Versions */}
              <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="status-versions-card">
                <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4" />
                  Versions & Storage
                </h3>
                {status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Model</span>
                      <span className="font-mono text-sm text-slate-900">{status.modelVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Quality</span>
                      <span className="font-mono text-sm text-slate-900">{status.qualityVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Storage</span>
                      <Badge className={status.storageEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                        {status.storageEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Failed to load</p>
                )}
              </div>

              {/* Runtime Info */}
              {status?.runtime && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 md:col-span-2 lg:col-span-3" data-testid="status-runtime-card">
                  <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                    <Server className="w-4 h-4" />
                    Runtime Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">URL</span>
                      <p className="text-slate-700 font-mono text-xs mt-1">{status.runtime.url}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Model Loaded</span>
                      <p className="mt-1">
                        <Badge className={status.runtime.loaded ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                          {status.runtime.loaded ? 'YES' : 'NO'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Model Path</span>
                      <p className="text-slate-700 font-mono text-xs mt-1 truncate">{status.runtime.modelPath || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tokenizer Path</span>
                      <p className="text-slate-700 font-mono text-xs mt-1 truncate">{status.runtime.tokenizerPath || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* A3: Engine Freeze Status */}
              {status?.freeze && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 md:col-span-2 lg:col-span-3" data-testid="status-freeze-card">
                  <h3 className="text-sm font-medium text-blue-700 flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Engine Freeze Status (A3)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">Version</span>
                      <p className="text-slate-900 font-bold mt-1">{status.freeze.version}</p>
                    </div>
                    <div>
                      <span className="text-blue-600">Ruleset</span>
                      <p className="text-slate-900 font-mono text-xs mt-1">{status.freeze.ruleset}</p>
                    </div>
                    <div>
                      <span className="text-blue-600">Mutable</span>
                      <p className="mt-1">
                        <Badge className={status.freeze.mutable ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}>
                          {status.freeze.mutable ? 'YES' : '❄️ FROZEN'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">Training</span>
                      <p className="mt-1">
                        <Badge className={status.freeze.trainingAttached ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                          {status.freeze.trainingAttached ? 'ON' : 'OFF'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">Price Feedback</span>
                      <p className="mt-1">
                        <Badge className={status.freeze.priceFeedback ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                          {status.freeze.priceFeedback ? 'ON' : 'OFF'}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-600">Twitter</span>
                      <p className="mt-1">
                        <Badge className={status.freeze.twitterIntegration ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                          {status.freeze.twitterIntegration ? 'ON' : 'OFF'}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  {!status.freeze.mutable && (
                    <p className="mt-4 text-xs text-blue-600 bg-blue-100 rounded px-3 py-2">
                      🔒 Engine is FROZEN. Rule/threshold changes require a new engine version (v1.6+).
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Twitter Runtime Tab (Phase 10.8) */}
          <TabsContent value="twitter" className="mt-6">
            {loading.twitter ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : twitterRuntime ? (
              <div className="space-y-6">
                {/* Runtime Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="twitter-status-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <Twitter className="w-4 h-4" />
                        Runtime Status
                      </h3>
                      <Switch
                        checked={twitterRuntime.enabled}
                        onCheckedChange={toggleTwitterRuntime}
                        disabled={actionLoading === 'twitterToggle'}
                      />
                    </div>
                    <Badge className={
                      twitterRuntime.health.status === 'HEALTHY' ? 'bg-green-100 text-green-700' :
                      twitterRuntime.health.status === 'DEGRADED' ? 'bg-yellow-100 text-yellow-700' :
                      twitterRuntime.health.status === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }>
                      {twitterRuntime.health.status}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">Mode: {twitterRuntime.mode}</p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4" />
                      CAPTCHA Counter
                    </h3>
                    <div className="text-2xl font-bold text-slate-900">{twitterRuntime.health.captchaCount}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Consecutive: {twitterRuntime.health.consecutiveCaptchas}
                      {twitterRuntime.health.autoDisabled && (
                        <span className="text-red-600 ml-2">⚠️ AUTO-DISABLED</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4" />
                      Validation Stats
                    </h3>
                    <div className="text-2xl font-bold text-slate-900">{twitterRuntime.stats.totalValidated}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Valid: {twitterRuntime.stats.validCount} | Degraded: {twitterRuntime.stats.degradedCount} | Dropped: {twitterRuntime.stats.droppedCount}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4" />
                      Payload Quality
                    </h3>
                    <div className="text-2xl font-bold text-slate-900">
                      {Math.round(twitterRuntime.health.validPayloadRate * 100)}%
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Posts/min: {twitterRuntime.health.avgPostsPerMinute}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchTwitterRuntime}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTwitterHealth}
                    disabled={actionLoading === 'twitterReset'}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {actionLoading === 'twitterReset' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reset Counters
                  </Button>
                </div>

                {/* Validation Tester */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    Tweet Validation Tester
                  </h3>
                  <div className="flex gap-3 mb-4">
                    <Input
                      placeholder="Enter tweet text to validate..."
                      value={testTweet}
                      onChange={(e) => setTestTweet(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={validateTestTweet}
                      disabled={!testTweet.trim() || actionLoading === 'testTweet'}
                    >
                      {actionLoading === 'testTweet' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Validate
                    </Button>
                  </div>
                  
                  {testTweetResult && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-4 mb-3">
                        <Badge className={
                          testTweetResult.status === 'VALID' ? 'bg-green-100 text-green-700' :
                          testTweetResult.status === 'DEGRADED' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {testTweetResult.status}
                        </Badge>
                        <Badge className={
                          testTweetResult.signalStrength === 'STRONG' ? 'bg-blue-100 text-blue-700' :
                          testTweetResult.signalStrength === 'NORMAL' ? 'bg-slate-100 text-slate-700' :
                          'bg-slate-100 text-slate-400'
                        }>
                          Signal: {testTweetResult.signalStrength}
                        </Badge>
                        <span className="text-sm text-slate-600">
                          Influence: <span className="font-mono">{testTweetResult.influenceScore}</span>
                        </span>
                        <span className="text-sm text-slate-600">
                          Context Multiplier: <span className="font-mono">{testTweetResult.contextMultiplier}x</span>
                        </span>
                      </div>
                      {testTweetResult.warnings?.length > 0 && (
                        <div className="text-xs text-yellow-600 mt-2">
                          Warnings: {testTweetResult.warnings.join(', ')}
                        </div>
                      )}
                      {testTweetResult.errors?.length > 0 && (
                        <div className="text-xs text-red-600 mt-2">
                          Errors: {testTweetResult.errors.join(', ')}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-2">
                        Can Process: {testTweetResult.canProcess ? '✅' : '❌'} | 
                        Can Influence: {testTweetResult.canInfluence ? '✅' : '❌'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Config Info */}
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Validator Config (10.8)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Min Text Length</span>
                      <p className="font-mono text-slate-900">{twitterRuntime.config?.minTextLength || 10}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Influence Thresholds</span>
                      <p className="font-mono text-slate-900">
                        W:{twitterRuntime.config?.influenceThresholds?.weak || 1} / 
                        N:{twitterRuntime.config?.influenceThresholds?.normal || 2.5} / 
                        S:{twitterRuntime.config?.influenceThresholds?.strong || 4}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">CAPTCHA Limit</span>
                      <p className="font-mono text-slate-900">{twitterRuntime.config?.captchaCriticalLimit || 3}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Min Payload Rate</span>
                      <p className="font-mono text-slate-900">{(twitterRuntime.config?.minValidPayloadRate || 0.8) * 100}%</p>
                    </div>
                  </div>
                </div>

                {/* Data Quality (Phase 10.9) */}
                {twitterRuntime.dataQuality && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-6">
                    <h3 className="text-sm font-medium text-purple-700 flex items-center gap-2 mb-4">
                      <Database className="w-4 h-4" />
                      Data Quality (10.9 Contract v{twitterRuntime.contract?.version || '1.0.0'})
                      {twitterRuntime.contract?.locked && (
                        <Badge className="bg-purple-100 text-purple-700 ml-2">🔒 LOCKED</Badge>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-purple-600">Total Checked</span>
                        <p className="text-slate-900 font-bold">{twitterRuntime.dataQuality.totalChecked}</p>
                      </div>
                      <div>
                        <span className="text-purple-600">Complete</span>
                        <p className="text-green-600 font-bold">{twitterRuntime.dataQuality.completeCount}</p>
                      </div>
                      <div>
                        <span className="text-purple-600">Partial</span>
                        <p className="text-yellow-600 font-bold">{twitterRuntime.dataQuality.partialCount}</p>
                      </div>
                      <div>
                        <span className="text-purple-600">Invalid</span>
                        <p className="text-red-600 font-bold">{twitterRuntime.dataQuality.invalidCount}</p>
                      </div>
                      <div>
                        <span className="text-purple-600">Avg Score</span>
                        <p className="text-slate-900 font-mono">{(twitterRuntime.dataQuality.avgCompletenessScore * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    {Object.keys(twitterRuntime.dataQuality.missingFieldsFrequency || {}).length > 0 && (
                      <div className="mt-4 text-xs">
                        <span className="text-purple-600">Top Missing Fields:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Object.entries(twitterRuntime.dataQuality.missingFieldsFrequency)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([field, count]) => (
                              <Badge key={field} className="bg-purple-100 text-purple-700">
                                {field.split('.').pop()}: {count}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Runtime Flags */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Runtime Flags</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Parser:</span>
                      <Badge className={twitterRuntime.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                        {twitterRuntime.enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Sentiment:</span>
                      <Badge className={twitterRuntime.sentimentEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                        {twitterRuntime.sentimentEnabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Price:</span>
                      <Badge className={twitterRuntime.priceEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                        {twitterRuntime.priceEnabled ? 'OFF' : 'OFF'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No Twitter runtime data available
              </div>
            )}
          </TabsContent>

          {/* Automation Tab (S4.1) */}
          <TabsContent value="automation" className="mt-6">
            {loading.automation ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : automation ? (
              <div className="space-y-6">
                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="automation-status-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Automation Status
                      </h3>
                    </div>
                    <Badge className={
                      automation.isRunning ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }>
                      {automation.isRunning ? '▶ RUNNING' : '⏸ STOPPED'}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">
                      Enabled: {automation.enabled ? 'Yes' : 'No'}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4" />
                      Queue Depth
                    </h3>
                    <div className="text-2xl font-bold text-slate-900">{automation.stats?.queueDepth || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Max: {automation.config?.maxQueueSize || 1000}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <CheckCircle className="w-4 h-4" />
                      Processed
                    </h3>
                    <div className="text-2xl font-bold text-green-600">{automation.stats?.totalProcessed || 0}</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Dropped: {automation.stats?.totalDropped || 0} | Failed: {automation.stats?.totalFailed || 0}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4" />
                      Avg Processing
                    </h3>
                    <div className="text-2xl font-bold text-slate-900">{automation.stats?.avgProcessingTimeMs || 0}ms</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Batch: {automation.config?.batchSize || 10} / {(automation.config?.processIntervalMs || 5000) / 1000}s
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3">
                  {automation.isRunning ? (
                    <Button
                      onClick={() => toggleAutomation(false)}
                      disabled={actionLoading === 'automationToggle'}
                      variant="outline"
                      className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                    >
                      {actionLoading === 'automationToggle' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Stop Automation
                    </Button>
                  ) : (
                    <Button
                      onClick={() => toggleAutomation(true)}
                      disabled={actionLoading === 'automationToggle'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {actionLoading === 'automationToggle' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Start Automation
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={clearAutomationQueue}
                    disabled={actionLoading === 'automationClear'}
                  >
                    Clear Queue
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetAutomation}
                    disabled={actionLoading === 'automationReset'}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Reset All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fetchAutomation}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {/* Feature Flags */}
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Feature Flags</h3>
                  <div className="flex flex-wrap gap-4">
                    {automation.featureFlags && Object.entries(automation.featureFlags).map(([flag, value]) => (
                      <div key={flag} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">{flag}:</span>
                        <Badge className={value ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                          {value ? 'true' : 'false'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Queue Config</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Max Queue Size</span>
                      <p className="font-mono text-slate-900">{automation.config?.maxQueueSize || 1000}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Batch Size</span>
                      <p className="font-mono text-slate-900">{automation.config?.batchSize || 10}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Process Interval</span>
                      <p className="font-mono text-slate-900">{(automation.config?.processIntervalMs || 5000) / 1000}s</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Max Retries</span>
                      <p className="font-mono text-slate-900">{automation.config?.maxRetries || 2}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Min Completeness</span>
                      <p className="font-mono text-slate-900">{(automation.config?.minCompletenessScore || 0.85) * 100}%</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No automation data available
              </div>
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="mt-6">
            {loading.config ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : config ? (
              <div className="space-y-6">
                {/* Thresholds */}
                <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="config-thresholds-card">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Thresholds
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(config.thresholds).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={value}
                          onChange={(e) => handleThresholdChange(key, e.target.value)}
                          disabled={!isAdmin}
                          className="font-mono h-9"
                          data-testid={`threshold-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules */}
                <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="config-rules-card">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-purple-600" />
                    Rules
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(config.rules).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-sm text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <Switch
                          checked={value}
                          onCheckedChange={() => handleRuleToggle(key)}
                          disabled={!isAdmin}
                          data-testid={`rule-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modes */}
                <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="config-modes-card">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    Modes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(config.modes).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-sm text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <Switch
                          checked={value}
                          onCheckedChange={() => handleModeToggle(key)}
                          disabled={!isAdmin}
                          data-testid={`mode-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                {isAdmin && (
                  <div className="flex items-center justify-between">
                    <div>
                      {configError && (
                        <p className="text-red-600 text-sm flex items-center gap-1">
                          <XCircle className="w-4 h-4" />
                          {configError}
                        </p>
                      )}
                      {config.updatedAt && (
                        <p className="text-slate-500 text-xs">
                          Last updated: {new Date(config.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={updateConfig}
                      disabled={!configDirty || actionLoading === 'config'}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="save-config-btn"
                    >
                      {actionLoading === 'config' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Save Configuration
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <p className="text-slate-400">Failed to load configuration</p>
              </div>
            )}
          </TabsContent>

          {/* Evaluation Tab */}
          <TabsContent value="eval" className="mt-6">
            <div className="space-y-6">
              {/* Run Evaluation */}
              <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="eval-run-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Play className="w-5 h-5 text-green-600" />
                      Run Evaluation
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Run evaluation against the built-in dataset to measure model accuracy and rule effectiveness.
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      onClick={runEvaluation}
                      disabled={isRunningEval}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="run-eval-btn"
                    >
                      {isRunningEval ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Eval
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Eval Reports */}
              <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="eval-reports-card">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Evaluation Reports
                </h3>
                {loading.eval ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : evalReports.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {evalReports.map((report, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                        data-testid={`eval-report-${idx}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-slate-900">{Math.round(report.accuracy * 100)}%</span>
                              <Badge variant="outline" className="text-xs">
                                {report.totalSamples} samples
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(report.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>Model: {report.modelVersion}</p>
                            <p>Quality: {report.qualityVersion}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 bg-green-50 border border-green-200 rounded text-center">
                            <p className="text-green-700 font-medium">Positive</p>
                            <p className="text-slate-600">TP: {report.confusionMatrix.positive.tp}</p>
                          </div>
                          <div className="p-2 bg-slate-100 border border-slate-200 rounded text-center">
                            <p className="text-slate-700 font-medium">Neutral</p>
                            <p className="text-slate-600">TP: {report.confusionMatrix.neutral.tp}</p>
                          </div>
                          <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                            <p className="text-red-700 font-medium">Negative</p>
                            <p className="text-slate-600">TP: {report.confusionMatrix.negative.tp}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No evaluation reports yet</p>
                    <p className="text-slate-400 text-sm mt-1">Run an evaluation to see results</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Runs Log Tab */}
          <TabsContent value="runs" className="mt-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6" data-testid="runs-log-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  Recent Runs
                </h3>
                <Badge variant="outline" className="text-xs">
                  {runs.length} runs
                </Badge>
              </div>
              {loading.runs ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : runs.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {runs.map((run, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                      data-testid={`run-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{run.inputPreview}</p>
                          <p className="text-xs text-slate-500 mt-1">{new Date(run.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            run.output.label === 'POSITIVE' ? 'bg-green-100 text-green-700' :
                            run.output.label === 'NEGATIVE' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }>
                            {run.output.label}
                          </Badge>
                          <span className="text-xs text-slate-500 font-mono">
                            {Math.round(run.output.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      {run.meta.rulesApplied?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {run.meta.rulesApplied.map((rule, rIdx) => (
                            <Badge key={rIdx} variant="outline" className="text-xs">
                              {rule}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No runs logged yet</p>
                  <p className="text-slate-400 text-sm mt-1">Runs will appear here after sentiment analysis</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
