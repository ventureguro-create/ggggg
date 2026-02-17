/**
 * Twitter Adapter Admin Tab
 * 
 * Control plane for Twitter adapter:
 * - Mode: OFF / READ_ONLY / BLENDED
 * - Weights & Gates
 * - Data health
 * - Dry-run & Diff
 * - Rollback
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  RotateCcw,
  Lock,
  Database,
  Activity,
  TrendingUp,
} from 'lucide-react';
import * as api from '../../../api/adminConnectionsTwitterAdapter.api';
import type { FullStatus, AdapterMode, DryRunResult } from '../../../api/adminConnectionsTwitterAdapter.api';

export default function TwitterAdapterTab() {
  const [status, setStatus] = useState<FullStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Local state for weight inputs
  const [engagementWeight, setEngagementWeight] = useState(0);
  const [trendWeight, setTrendWeight] = useState(0);
  const [confidenceGate, setConfidenceGate] = useState(0.7);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFullStatus();
      setStatus(data);
      setEngagementWeight(data.weights.engagement);
      setTrendWeight(data.weights.trend);
      setConfidenceGate(data.confidence_gate);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSetMode = async (mode: AdapterMode) => {
    setActionLoading(true);
    try {
      await api.setMode(mode);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleApplyWeights = async () => {
    setActionLoading(true);
    try {
      await api.setWeights({
        engagement: engagementWeight,
        trend: trendWeight,
        confidence_gate: confidenceGate,
      });
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleDryRun = async () => {
    setActionLoading(true);
    try {
      const result = await api.runDryRun();
      setDryRunResult(result);
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleRollback = async () => {
    if (!window.confirm('Rollback to OFF mode with all weights = 0?')) return;
    setActionLoading(true);
    try {
      await api.rollback();
      await fetchStatus();
      setDryRunResult(null);
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading Twitter Adapter status...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-destructive mb-2">Error: {error}</div>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          <RefreshCw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (!status) return null;

  const ModeIcon = status.mode === 'OFF' ? XCircle : status.mode === 'BLENDED' ? TrendingUp : Activity;
  const modeColor = status.mode === 'OFF' ? 'text-red-500' : status.mode === 'BLENDED' ? 'text-green-500' : 'text-blue-500';

  return (
    <div className="space-y-4 p-4" data-testid="twitter-adapter-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ModeIcon className={`h-6 w-6 ${modeColor}`} />
          <h2 className="text-xl font-bold">Twitter Adapter</h2>
          <Badge variant={status.mode === 'OFF' ? 'secondary' : status.mode === 'BLENDED' ? 'default' : 'outline'}>
            {status.mode}
          </Badge>
          {status.locks.read_only && (
            <Badge variant="outline" className="text-orange-500 border-orange-500">
              <Lock className="h-3 w-3 mr-1" /> READ-ONLY
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={actionLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${actionLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Warnings */}
      {status.warnings.length > 0 && (
        <Card className="border-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                {status.warnings.map((w, i) => (
                  <div key={i} className="text-sm text-orange-700">{w}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['OFF', 'READ_ONLY', 'BLENDED'] as AdapterMode[]).map((mode) => (
              <Button
                key={mode}
                variant={status.mode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSetMode(mode)}
                disabled={actionLoading}
                data-testid={`mode-${mode.toLowerCase()}-btn`}
              >
                {mode.replace('_', ' ')}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <strong>OFF</strong>: No Twitter data used |{' '}
            <strong>READ_ONLY</strong>: Read & compare, no influence |{' '}
            <strong>BLENDED</strong>: Active blend into scores
          </div>
        </CardContent>
      </Card>

      {/* Data Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Data Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{status.data.available ? status.data.tweets_count : 'N/A'}</div>
              <div className="text-xs text-muted-foreground">Tweets</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.data.available ? status.data.authors_count : 'N/A'}</div>
              <div className="text-xs text-muted-foreground">Authors</div>
            </div>
            <div>
              <Badge variant={status.data.freshness === 'FRESH' ? 'default' : status.data.freshness === 'STALE' ? 'secondary' : 'destructive'}>
                {status.data.freshness}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">Freshness</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.data.freshness_hours?.toFixed(0) || 'N/A'}h</div>
              <div className="text-xs text-muted-foreground">Age</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weights & Gates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Weights & Gates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Engagement Weight (max {status.caps.engagement_max})</label>
              <input
                type="range"
                min="0"
                max={status.caps.engagement_max}
                step="0.05"
                value={engagementWeight}
                onChange={(e) => setEngagementWeight(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-sm font-mono">{(engagementWeight * 100).toFixed(0)}%</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Trend Weight (max {status.caps.trend_max})</label>
              <input
                type="range"
                min="0"
                max={status.caps.trend_max}
                step="0.05"
                value={trendWeight}
                onChange={(e) => setTrendWeight(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-sm font-mono">{(trendWeight * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Confidence Gate (min 0.5)</label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={confidenceGate}
              onChange={(e) => setConfidenceGate(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-sm font-mono">{(confidenceGate * 100).toFixed(0)}%</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApplyWeights} disabled={actionLoading}>
              Apply Weights
            </Button>
            <div className="text-xs text-muted-foreground self-center">
              Network & Authority locked at 0 (no follow graph)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold">{(status.confidence.avg * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Average</div>
            </div>
            <div>
              <div className="text-lg font-bold">{(status.confidence.min * 100).toFixed(0)}% - {(status.confidence.max * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Range</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{status.confidence.above_gate_count}</div>
              <div className="text-xs text-muted-foreground">Above Gate</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">{status.confidence.below_gate_count}</div>
              <div className="text-xs text-muted-foreground">Below Gate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diff Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mock vs Live Diff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-lg font-bold">{status.diff.avg_delta.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Avg Delta</div>
            </div>
            <div>
              <div className="text-lg font-bold">{status.diff.max_delta.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Max Delta</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">{status.diff.divergent_count}</div>
              <div className="text-xs text-muted-foreground">Divergent ({'>'}50%)</div>
            </div>
          </div>
          {status.diff.top_deltas.length > 0 && (
            <div className="text-xs">
              <div className="font-medium mb-1">Top Deltas:</div>
              {status.diff.top_deltas.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span>{d.author}</span>
                  <span className={d.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                    {d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDryRun} disabled={actionLoading} data-testid="dry-run-btn">
            <Play className="h-4 w-4 mr-1" /> Dry Run
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRollback} disabled={actionLoading} data-testid="rollback-btn">
            <RotateCcw className="h-4 w-4 mr-1" /> Rollback
          </Button>
        </CardContent>
      </Card>

      {/* Dry Run Results */}
      {dryRunResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" /> Dry Run Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center mb-4">
              <div>
                <div className="text-lg font-bold">{dryRunResult.results_count}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">{dryRunResult.blended_count}</div>
                <div className="text-xs text-muted-foreground">Blended</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-600">{dryRunResult.mock_only_count}</div>
                <div className="text-xs text-muted-foreground">Mock Only</div>
              </div>
              <div>
                <div className="text-lg font-bold">{(dryRunResult.avg_delta * 100).toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Avg Delta</div>
              </div>
            </div>
            {dryRunResult.sample_results.length > 0 && (
              <div className="text-xs">
                <div className="font-medium mb-1">Sample Results:</div>
                <table className="w-full">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left">Author</th>
                      <th>Mock</th>
                      <th>Blended</th>
                      <th>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunResult.sample_results.map((r, i) => (
                      <tr key={i}>
                        <td>{r.author}</td>
                        <td className="text-center">{r.mock}</td>
                        <td className="text-center">{r.blended}</td>
                        <td className={`text-center ${parseFloat(r.delta) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(r.delta) > 0 ? '+' : ''}{r.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Locks Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>
              Hard locks: read_only=true, alerts_disabled=true, network=0, authority=0
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Last change: {new Date(status.last_change).toLocaleString()} by {status.changed_by}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
