/**
 * Admin On-chain Adapter Page
 * 
 * E1: Configure and connect to on-chain engine
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, Wifi, WifiOff, Activity, TestTube, 
  Save, Link2, Link2Off, RefreshCw, AlertCircle, CheckCircle 
} from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const MODES = [
  { value: 'OFF', label: 'Disabled', desc: 'No on-chain data' },
  { value: 'MOCK', label: 'Mock Data', desc: 'Simulated on-chain data for testing' },
  { value: 'ENGINE_READONLY', label: 'Engine (Read-Only)', desc: 'Live data from external engine' },
];

export default function AdminOnchainAdapterPage() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  // Engine connection form
  const [engineUrl, setEngineUrl] = useState('');
  const [engineApiKey, setEngineApiKey] = useState('');
  
  // Test snapshot form
  const [testAsset, setTestAsset] = useState('BTC');
  const [snapshotResult, setSnapshotResult] = useState(null);

  const loadData = async () => {
    try {
      const [configRes, statusRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/connections/onchain-adapter/config`),
        axios.get(`${API_BASE}/api/admin/connections/onchain-adapter/status`),
      ]);
      
      if (configRes.data.ok) {
        setConfig(configRes.data.data);
        setEngineUrl(configRes.data.data.engineBaseUrl || '');
      }
      if (statusRes.data.ok) setStatus(statusRes.data.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (patch) => {
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API_BASE}/api/admin/connections/onchain-adapter/config`,
        patch
      );
      if (res.data.ok) {
        setConfig(res.data.data);
        loadData();
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!engineUrl) return;
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await axios.post(
        `${API_BASE}/api/admin/connections/onchain-adapter/engine/test`,
        { baseUrl: engineUrl, apiKey: engineApiKey || undefined }
      );
      setTestResult(res.data.data);
      
      if (res.data.data?.ok) {
        // Refresh config and status
        loadData();
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from engine and switch to MOCK mode?')) return;
    
    try {
      await axios.post(`${API_BASE}/api/admin/connections/onchain-adapter/engine/disconnect`);
      setEngineUrl('');
      setEngineApiKey('');
      setTestResult(null);
      loadData();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleTestSnapshot = async () => {
    if (!testAsset) return;
    setSnapshotResult(null);
    
    try {
      const res = await axios.post(
        `${API_BASE}/api/admin/connections/onchain-adapter/test/snapshot`,
        { asset: testAsset }
      );
      setSnapshotResult(res.data.data);
    } catch (err) {
      setSnapshotResult({ error: err.message });
    }
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-48 mb-6" />
        <div className="h-64 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="onchain-adapter-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">On-chain Adapter</h1>
            <p className="text-sm text-gray-400">E1: Configure on-chain data source</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status?.mode === 'ENGINE_READONLY' && status?.engine?.connected ? (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">
              <Wifi className="w-4 h-4" />
              Engine Connected
            </span>
          ) : status?.mode === 'MOCK' ? (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm">
              <Activity className="w-4 h-4" />
              Mock Mode
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-gray-400 rounded-lg text-sm">
              <WifiOff className="w-4 h-4" />
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Mode Selection */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Adapter Mode</h2>
        <div className="grid grid-cols-3 gap-4">
          {MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => handleSave({ mode: mode.value })}
              disabled={saving}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                config?.mode === mode.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-white">{mode.label}</div>
              <div className="text-xs text-gray-400 mt-1">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Engine Connection */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Engine Connection</h2>
          {config?.engineBaseUrl && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/20 rounded-lg text-sm"
            >
              <Link2Off className="w-4 h-4" />
              Disconnect
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Engine Base URL</label>
            <input
              type="url"
              value={engineUrl}
              onChange={e => setEngineUrl(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="https://your-onchain-engine.com/api"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key (optional)</label>
            <input
              type="password"
              value={engineApiKey}
              onChange={e => setEngineApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="Your API key"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={!engineUrl || testing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
              data-testid="test-engine-btn"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Test Connection
                </>
              )}
            </button>

            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.ok ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {testResult.ok ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Connection successful!
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    {testResult.error || 'Connection failed'}
                  </>
                )}
              </div>
            )}
          </div>

          {config?.engineBaseUrl && (
            <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Connected Engine:</span>
                <span className="text-white font-mono">{config.engineBaseUrl}</span>
              </div>
              {config?.engineLastCheck && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-400">Last Check:</span>
                  <span className="text-gray-300">{new Date(config.engineLastCheck).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Test Snapshot */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Test Snapshot</h2>
        
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Asset</label>
            <input
              type="text"
              value={testAsset}
              onChange={e => setTestAsset(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="BTC, ETH, SOL..."
            />
          </div>
          <button
            onClick={handleTestSnapshot}
            disabled={!testAsset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            data-testid="test-snapshot-btn"
          >
            <TestTube className="w-4 h-4" />
            Get Snapshot
          </button>
        </div>

        {snapshotResult && (
          <div className="mt-4">
            <pre className="p-3 bg-gray-900 rounded-lg overflow-auto text-xs text-gray-300 max-h-64">
              {JSON.stringify(snapshotResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confidence Floor (0-1)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={config?.confidence_floor_0_1 ?? 0.35}
              onChange={e => handleSave({ confidence_floor_0_1: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Assets Per Request</label>
            <input
              type="number"
              min="1"
              max="50"
              value={config?.max_assets_per_request ?? 5}
              onChange={e => handleSave({ max_assets_per_request: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={config?.enabled ?? true}
            onChange={e => handleSave({ enabled: e.target.checked })}
            className="rounded border-gray-600"
          />
          <label htmlFor="enabled" className="text-sm text-gray-300">
            Enable On-chain Adapter
          </label>
        </div>
      </div>
    </div>
  );
}
