/**
 * T2.4 Expansion Tab
 * 
 * Admin panel for controlled network & alerts expansion.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  RotateCcw,
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';
const PREFIX = '/api/admin/t24';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${PREFIX}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json();
  return data.data;
}

interface T24Status {
  version: string;
  expansion: {
    config: any;
    network_weight: number;
    pilot_only: boolean;
  };
  drift: {
    level: string;
    score: number;
    trend: string;
    auto_rollback_triggered: boolean;
    warnings: string[];
  };
  aqm: {
    metrics: any;
    health: { healthy: boolean; warnings: string[] };
  };
  ml2_shadow: {
    total_evaluated: number;
    agreement_rate: number;
    potential_fp_count: number;
    potential_fn_count: number;
  };
  network: {
    edges_count: number;
    co_engagement_edges: number;
    avg_weight: number;
  };
  safety: {
    auto_rollback_enabled: boolean;
    last_rollback_triggered: boolean;
  };
}

export default function T24ExpansionTab() {
  const [status, setStatus] = useState<T24Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkWeight, setNetworkWeight] = useState(0.15);
  const [enrichedTest, setEnrichedTest] = useState<any>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<T24Status>('/status');
      setStatus(data);
      setNetworkWeight(data.expansion.network_weight);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleWeightChange = async () => {
    await fetchApi('/network-weight', {
      method: 'PATCH',
      body: JSON.stringify({ weight: networkWeight }),
    });
    fetchStatus();
  };

  const handleCheckDrift = async () => {
    await fetchApi('/check-drift', { method: 'POST' });
    fetchStatus();
  };

  const handleRollback = async () => {
    if (!window.confirm('Rollback network weight to 15% baseline?')) return;
    await fetchApi('/rollback', { method: 'POST' });
    fetchStatus();
  };

  const handleTestEnriched = async () => {
    const result = await fetchApi<any>('/test-enriched', { method: 'POST' });
    setEnrichedTest(result);
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading T2.4 status...</div>;
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

  const driftColor = status.drift.level === 'LOW' ? 'text-green-500' : 
                     status.drift.level === 'MEDIUM' ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="space-y-4 p-4" data-testid="t24-expansion-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-bold">T2.4 Expansion</h2>
          <Badge variant="outline">{status.version}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Drift Warning */}
      {status.drift.level !== 'LOW' && (
        <Card className={status.drift.level === 'HIGH' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${driftColor}`} />
              <span className="font-bold">Drift Level: {status.drift.level}</span>
              <Badge variant="outline">{status.drift.trend}</Badge>
            </div>
            {status.drift.warnings.map((w, i) => (
              <div key={i} className="text-sm mt-1">{w}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Network Weight Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Network Weight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0.10"
              max="0.20"
              step="0.01"
              value={networkWeight}
              onChange={(e) => setNetworkWeight(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-bold w-16">{(networkWeight * 100).toFixed(0)}%</span>
            <Button size="sm" onClick={handleWeightChange}>Apply</Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Current: {(status.expansion.network_weight * 100).toFixed(0)}% | 
            Baseline: 15% | Max T2.4: 20%
          </div>
        </CardContent>
      </Card>

      {/* Drift Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Drift Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className={`text-2xl font-bold ${driftColor}`}>{status.drift.level}</div>
              <div className="text-xs text-muted-foreground">Level</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{(status.drift.score * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.drift.trend}</div>
              <div className="text-xs text-muted-foreground">Trend</div>
            </div>
            <div>
              {status.drift.auto_rollback_triggered ? (
                <XCircle className="h-8 w-8 text-red-500 mx-auto" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              )}
              <div className="text-xs text-muted-foreground">Rollback</div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleCheckDrift}>
            Force Drift Check
          </Button>
        </CardContent>
      </Card>

      {/* AQM & ML2 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AQM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Send Rate</span>
                <span>{(status.aqm.metrics.send_rate * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Suppress Rate</span>
                <span>{(status.aqm.metrics.suppress_rate * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence Avg</span>
                <span>{(status.aqm.metrics.confidence_avg * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                {status.aqm.health.healthy ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                <span>{status.aqm.health.healthy ? 'Healthy' : 'Warnings'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ML2 Shadow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Evaluated</span>
                <span>{status.ml2_shadow.total_evaluated}</span>
              </div>
              <div className="flex justify-between">
                <span>Agreement</span>
                <span>{(status.ml2_shadow.agreement_rate * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Potential FP</span>
                <span className="text-yellow-600">{status.ml2_shadow.potential_fp_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Potential FN</span>
                <span className="text-red-600">{status.ml2_shadow.potential_fn_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Network</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{status.network.edges_count}</div>
              <div className="text-xs text-muted-foreground">Total Edges</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{status.network.co_engagement_edges}</div>
              <div className="text-xs text-muted-foreground">Co-Engagement</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{(status.network.avg_weight * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Avg Weight</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestEnriched}>
            Test Enriched Alerts
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRollback}>
            <RotateCcw className="h-4 w-4 mr-1" /> Rollback to Baseline
          </Button>
        </CardContent>
      </Card>

      {/* Enriched Test Results */}
      {enrichedTest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Enriched Alerts Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-2">Total: {enrichedTest.total}</div>
            <div className="space-y-2">
              {enrichedTest.sample?.map((e: any, i: number) => (
                <div key={i} className="bg-muted p-2 rounded text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{e.account}</span>
                    <Badge variant="outline">{e.signal}</Badge>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span>Conf: {e.confidence}</span>
                    <span>Net: {e.network_score}</span>
                    <span>Cluster: {e.cluster}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.flags?.map((f: string, j: number) => (
                      <Badge key={j} variant="secondary" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safety Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          <div>Auto-rollback: {status.safety.auto_rollback_enabled ? 'ON' : 'OFF'}</div>
          <div>Pilot only: {status.expansion.pilot_only ? 'YES' : 'NO'}</div>
          <div>⚠️ Network cap: 20% max | Drift HIGH → auto rollback to 15%</div>
        </CardContent>
      </Card>
    </div>
  );
}
