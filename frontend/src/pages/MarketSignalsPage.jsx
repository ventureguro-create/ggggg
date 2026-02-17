/**
 * MarketSignalsPage - P1 Market Analytics Dashboard
 * 
 * Unified view of all market signals:
 * - Exchange Pressure (P1.3)
 * - Accumulation/Distribution Zones (P1.5)
 * - Relations Statistics (P1.2)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw, 
  Building2,
  Target,
  Network,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api/client';
import { NetworkBadge } from '../components/NetworkSelector';

// Signal colors
const SIGNAL_COLORS = {
  STRONG_BUY: 'text-green-400 bg-green-500/10',
  BUY: 'text-green-400 bg-green-500/10',
  NEUTRAL: 'text-gray-400 bg-gray-500/10',
  SELL: 'text-red-400 bg-red-500/10',
  STRONG_SELL: 'text-red-400 bg-red-500/10',
  STRONG_ACCUMULATION: 'text-green-400 bg-green-500/10',
  ACCUMULATION: 'text-green-400 bg-green-500/10',
  DISTRIBUTION: 'text-red-400 bg-red-500/10',
  STRONG_DISTRIBUTION: 'text-red-400 bg-red-500/10',
};

// Format number
function formatNumber(n) {
  if (n === null || n === undefined) return '-';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

// Signal Card Component
function SignalCard({ title, signal, strength, icon: Icon, details, interpretation }) {
  const colorClass = SIGNAL_COLORS[signal] || SIGNAL_COLORS.NEUTRAL;
  const [textColor, bgColor] = colorClass.split(' ');
  
  const getSignalIcon = () => {
    if (signal?.includes('BUY') || signal?.includes('ACCUMULATION')) {
      return <TrendingUp className={`w-6 h-6 ${textColor}`} />;
    }
    if (signal?.includes('SELL') || signal?.includes('DISTRIBUTION')) {
      return <TrendingDown className={`w-6 h-6 ${textColor}`} />;
    }
    return <Minus className="w-6 h-6 text-gray-400" />;
  };
  
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">P1</span>
      </div>
      
      <div className={`p-4 rounded-lg ${bgColor} mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getSignalIcon()}
            <div>
              <div className={`text-xl font-bold ${textColor}`}>
                {signal?.replace(/_/g, ' ') || 'LOADING'}
              </div>
              <div className="text-sm text-gray-500">
                Strength: {strength}%
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {details && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="text-sm">
              <div className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
              <div className="text-slate-900 font-medium">{typeof value === 'number' ? formatNumber(value) : value}</div>
            </div>
          ))}
        </div>
      )}
      
      {interpretation && (
        <div className="text-sm text-gray-400 italic border-t border-gray-800 pt-3">
          {interpretation}
        </div>
      )}
    </div>
  );
}

// Zone Summary Component
function ZoneSummary({ zones, type }) {
  const isAccumulation = type === 'ACCUMULATION';
  const color = isAccumulation ? 'green' : 'red';
  
  return (
    <div className={`bg-${color}-500/5 border border-${color}-500/20 rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Target className={`w-4 h-4 text-${color}-400`} />
        <span className={`font-semibold text-${color}-400`}>
          {type} Zones
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-gray-500">Total</div>
          <div className="text-slate-900 font-bold">{zones?.total || 0}</div>
        </div>
        <div>
          <div className="text-gray-500">Strong</div>
          <div className={`font-bold text-${color}-400`}>{zones?.strong || 0}</div>
        </div>
        <div>
          <div className="text-gray-500">Moderate</div>
          <div className="text-gray-300">{zones?.moderate || 0}</div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function MarketSignalsPage() {
  const [network, setNetwork] = useState('ethereum');
  const [window, setWindow] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [exchangePressure, setExchangePressure] = useState(null);
  const [zoneSignal, setZoneSignal] = useState(null);
  const [relationsStats, setRelationsStats] = useState(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [pressureRes, zonesRes, relationsRes] = await Promise.all([
        api.get(`/api/market/exchange-pressure?network=${network}&window=${window}`).catch(e => ({ data: null })),
        api.get(`/api/v2/zones/signal?network=${network}`).catch(e => ({ data: null })),
        api.get(`/api/v2/relations/stats?network=${network}`).catch(e => ({ data: null })),
      ]);
      
      if (pressureRes.data?.ok) setExchangePressure(pressureRes.data.data);
      if (zonesRes.data?.ok) setZoneSignal(zonesRes.data.data);
      if (relationsRes.data?.ok) setRelationsStats(relationsRes.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [network, window]);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);
  
  // Calculate combined signal
  const getCombinedSignal = () => {
    if (!exchangePressure || !zoneSignal) return { signal: 'NEUTRAL', strength: 0 };
    
    const pressureSignal = exchangePressure.aggregate?.signal || 'NEUTRAL';
    const zonesSignal = zoneSignal.signal || 'NEUTRAL';
    
    // Map signals to scores (-2 to +2)
    const signalScores = {
      'STRONG_BUY': 2, 'STRONG_ACCUMULATION': 2,
      'BUY': 1, 'ACCUMULATION': 1,
      'NEUTRAL': 0,
      'SELL': -1, 'DISTRIBUTION': -1,
      'STRONG_SELL': -2, 'STRONG_DISTRIBUTION': -2,
    };
    
    const pressureScore = signalScores[pressureSignal] || 0;
    const zoneScore = signalScores[zonesSignal] || 0;
    const avgScore = (pressureScore + zoneScore) / 2;
    
    let signal;
    if (avgScore >= 1.5) signal = 'STRONG_BUY';
    else if (avgScore >= 0.5) signal = 'BUY';
    else if (avgScore <= -1.5) signal = 'STRONG_SELL';
    else if (avgScore <= -0.5) signal = 'SELL';
    else signal = 'NEUTRAL';
    
    return { signal, strength: Math.abs(avgScore) * 50 };
  };
  
  const combined = getCombinedSignal();
  
  return (
    <div className="min-h-screen bg-gray-950 text-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <Activity className="w-7 h-7 text-blue-400" />
          Market Signals
          <span className="text-xs font-normal px-2 py-1 bg-purple-500/20 text-purple-400 rounded">P1 ANALYTICS</span>
        </h1>
        <p className="text-gray-500">Combined market signals from exchange flows and on-chain activity</p>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-gray-500" />
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-800 rounded-lg text-slate-900"
          >
            <option value="ethereum">Ethereum</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="optimism">Optimism</option>
            <option value="base">Base</option>
            <option value="polygon">Polygon</option>
          </select>
        </div>
        
        <select
          value={window}
          onChange={(e) => setWindow(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-800 rounded-lg text-slate-900"
        >
          <option value="1h">1 Hour</option>
          <option value="24h">24 Hours</option>
          <option value="7d">7 Days</option>
        </select>
        
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        
        <NetworkBadge network={network} />
      </div>
      
      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}
      
      {/* Combined Signal - Hero */}
      <div className="mb-6">
        <div className={`p-6 rounded-xl border ${
          combined.signal.includes('BUY') ? 'bg-green-500/5 border-green-500/30' :
          combined.signal.includes('SELL') ? 'bg-red-500/5 border-red-500/30' :
          'bg-white border-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Combined Market Signal</div>
              <div className={`text-3xl font-bold flex items-center gap-3 ${
                combined.signal.includes('BUY') ? 'text-green-400' :
                combined.signal.includes('SELL') ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {combined.signal.includes('BUY') ? <TrendingUp className="w-8 h-8" /> :
                 combined.signal.includes('SELL') ? <TrendingDown className="w-8 h-8" /> :
                 <Minus className="w-8 h-8" />}
                {combined.signal.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Confidence</div>
              <div className="text-2xl font-bold text-slate-900">{Math.round(combined.strength)}%</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Signal Cards Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Exchange Pressure */}
        <SignalCard
          title="Exchange Pressure"
          signal={exchangePressure?.aggregate?.signal}
          strength={Math.abs(exchangePressure?.aggregate?.pressure || 0) * 100}
          icon={Building2}
          details={{
            'CEX Deposits': exchangePressure?.aggregate?.totalInflow,
            'CEX Withdrawals': exchangePressure?.aggregate?.totalOutflow,
            'Net Flow': exchangePressure?.aggregate?.netFlow,
          }}
          interpretation={
            exchangePressure?.aggregate?.pressure < 0 
              ? 'More withdrawals than deposits - buying pressure'
              : exchangePressure?.aggregate?.pressure > 0
              ? 'More deposits than withdrawals - selling pressure'
              : 'Balanced exchange flows'
          }
        />
        
        {/* Zone Signal */}
        <SignalCard
          title="Accumulation/Distribution"
          signal={zoneSignal?.signal}
          strength={zoneSignal?.signalStrength || 0}
          icon={Target}
          details={{
            'Accumulation Zones': zoneSignal?.breakdown?.accumulation?.total,
            'Distribution Zones': zoneSignal?.breakdown?.distribution?.total,
            'Acc Score': zoneSignal?.breakdown?.accumulation?.score,
            'Dist Score': zoneSignal?.breakdown?.distribution?.score,
          }}
          interpretation={zoneSignal?.interpretation}
        />
      </div>
      
      {/* Zone Breakdown */}
      {zoneSignal && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <ZoneSummary zones={zoneSignal.breakdown?.accumulation} type="ACCUMULATION" />
          <ZoneSummary zones={zoneSignal.breakdown?.distribution} type="DISTRIBUTION" />
        </div>
      )}
      
      {/* Relations Stats */}
      {relationsStats && (
        <div className="bg-white rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Network Activity (P1.2)</h3>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Relations</div>
              <div className="text-xl font-bold text-slate-900">{formatNumber(relationsStats.totalRelations)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Interactions</div>
              <div className="text-xl font-bold text-slate-900">{formatNumber(relationsStats.totalInteractions)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Unique Addresses</div>
              <div className="text-xl font-bold text-slate-900">{formatNumber(relationsStats.uniqueAddresses)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Avg Density</div>
              <div className="text-xl font-bold text-slate-900">{relationsStats.avgDensity?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Max Density</div>
              <div className="text-xl font-bold text-slate-900">{relationsStats.maxDensity?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {loading && !exchangePressure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl flex items-center gap-4">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span>Loading market signals...</span>
          </div>
        </div>
      )}
    </div>
  );
}
