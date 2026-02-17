/**
 * Reality Gate Admin Page
 * 
 * E2: Admin control for Reality Gate configuration
 */

import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldX, Activity, Settings, Play, Pause, TestTube } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminRealityGatePage() {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testInput, setTestInput] = useState({
    eventId: 'test_' + Date.now(),
    actorId: 'tw:smart1',
    asset: 'SOL',
    eventType: 'BREAKOUT',
    occurredAt: new Date().toISOString(),
  });

  const loadData = async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/connections/reality-gate/config`),
        axios.get(`${API_BASE}/api/admin/connections/reality-gate/audit/stats`),
      ]);
      
      if (configRes.data.ok) setConfig(configRes.data.data);
      if (statsRes.data.ok) setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleGate = async () => {
    const endpoint = config?.enabled ? 'kill-switch' : 'enable';
    try {
      await axios.post(`${API_BASE}/api/admin/connections/reality-gate/${endpoint}`);
      loadData();
    } catch (err) {
      console.error('Failed to toggle gate:', err);
    }
  };

  const runTest = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/admin/connections/reality-gate/test`, testInput);
      if (res.data.ok) {
        setTestResult(res.data.data);
      }
    } catch (err) {
      console.error('Test failed:', err);
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Reality Gate</h1>
            <p className="text-sm text-gray-400">On-chain × Twitter → Alerts</p>
          </div>
        </div>
        
        <button
          onClick={toggleGate}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            config?.enabled 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          }`}
          data-testid="toggle-gate-btn"
        >
          {config?.enabled ? (
            <>
              <Pause className="w-4 h-4" />
              Disable Gate
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Enable Gate
            </>
          )}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border ${
          config?.enabled 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {config?.enabled ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <ShieldX className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm text-gray-400">Status</span>
          </div>
          <div className={`text-xl font-bold ${config?.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
            {config?.enabled ? 'ACTIVE' : 'DISABLED'}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Total Evaluated</div>
          <div className="text-xl font-bold text-white">{stats?.total || 0}</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Blocked (24h)</div>
          <div className="text-xl font-bold text-red-400">{stats?.last24h?.blocked || 0}</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Sent (24h)</div>
          <div className="text-xl font-bold text-emerald-400">{stats?.last24h?.sent || 0}</div>
        </div>
      </div>

      {/* Config Panel */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-white">Gate Policy</h2>
        </div>
        
        <div className="p-4 grid grid-cols-2 gap-6">
          {/* Thresholds */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Thresholds</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Block Below</span>
                <span className="text-red-400">{config?.thresholds?.blockBelow_0_1 * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Downgrade Below</span>
                <span className="text-amber-400">{config?.thresholds?.downgradeBelow_0_1 * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Boost Above</span>
                <span className="text-emerald-400">{config?.thresholds?.boostAbove_0_1 * 100}%</span>
              </div>
            </div>
          </div>

          {/* Trust Multipliers */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Trust Multipliers</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">On Confirmed</span>
                <span className="text-emerald-400">×{config?.trustMultipliers?.onConfirmed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">On Contradicted</span>
                <span className="text-red-400">×{config?.trustMultipliers?.onContradicted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">On No Data</span>
                <span className="text-gray-300">×{config?.trustMultipliers?.onNoData}</span>
              </div>
            </div>
          </div>

          {/* Required Events */}
          <div className="col-span-2">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Require Confirmation For</h3>
            <div className="flex flex-wrap gap-2">
              {config?.requireConfirmFor?.map(type => (
                <span 
                  key={type}
                  className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Panel */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <TestTube className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-white">Test Evaluation</h2>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Actor ID"
              value={testInput.actorId}
              onChange={e => setTestInput(prev => ({ ...prev, actorId: e.target.value }))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
            <input
              type="text"
              placeholder="Asset"
              value={testInput.asset}
              onChange={e => setTestInput(prev => ({ ...prev, asset: e.target.value }))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
            <select
              value={testInput.eventType}
              onChange={e => setTestInput(prev => ({ ...prev, eventType: e.target.value }))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="BREAKOUT">BREAKOUT</option>
              <option value="EARLY_SIGNAL">EARLY_SIGNAL</option>
              <option value="WHALE_ALERT">WHALE_ALERT</option>
              <option value="VC_MENTION">VC_MENTION</option>
              <option value="GENERIC">GENERIC</option>
            </select>
          </div>
          
          <button
            onClick={runTest}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            data-testid="run-test-btn"
          >
            Run Test
          </button>
          
          {/* Test Result */}
          {testResult && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Decision</span>
                <span className={`px-2 py-1 text-sm font-medium rounded ${
                  testResult.decision === 'BLOCK' ? 'bg-red-500/20 text-red-400' :
                  testResult.decision === 'SEND_HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                  testResult.decision === 'SEND_LOW' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {testResult.decision}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Reality Score</div>
                  <div className="text-white font-mono">{Math.round(testResult.realityScore_0_1 * 100)}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Verdict</div>
                  <div className={`font-mono ${
                    testResult.onchain.verdict === 'CONFIRMED' ? 'text-emerald-400' :
                    testResult.onchain.verdict === 'CONTRADICTED' ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    {testResult.onchain.verdict}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Trust Before</div>
                  <div className="text-white font-mono">{testResult.trustAdjustment.previousTrust_0_1.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Trust After</div>
                  <div className="text-white font-mono">{testResult.trustAdjustment.newTrust_0_1.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision Distribution */}
      {stats?.byDecision && Object.keys(stats.byDecision).length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="font-semibold text-white mb-4">Decision Distribution</h3>
          <div className="flex gap-4">
            {Object.entries(stats.byDecision).map(([decision, count]) => (
              <div key={decision} className="flex-1 text-center">
                <div className={`text-2xl font-bold ${
                  decision === 'BLOCK' ? 'text-red-400' :
                  decision === 'SEND_HIGH' ? 'text-emerald-400' :
                  decision === 'SEND_LOW' ? 'text-amber-400' :
                  decision === 'SUPPRESS' ? 'text-orange-400' :
                  'text-gray-300'
                }`}>
                  {count}
                </div>
                <div className="text-xs text-gray-500">{decision}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
