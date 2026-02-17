/**
 * ConnectionsInfluenceGraphPage - Influence Graph Visualization
 * 
 * Uses ForceGraphCore from existing graph engine
 * with full filtering, ranking table below, and node details panel
 * 
 * P2.2: Share / Persist Graph State support
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Network,
  Filter,
  X,
  RefreshCw,
  Users,
  TrendingUp,
  AlertTriangle,
  Radio,
  Sparkles,
  Scale,
  Share2,
  Check,
  Copy,
  Building2,
  Trophy
} from 'lucide-react';
import { Button } from '../components/ui/button';
import ForceGraphCore from '../graph/core/ForceGraphCore';
import CompareModal from '../components/connections/CompareModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============================================================
// GRAPH STATE HELPERS (P2.2)
// ============================================================

/**
 * Build current graph state from UI
 */
const buildGraphState = (filters, selectedNode, compareState) => {
  const state = {
    version: '1.0',
    filters: {
      profiles: filters.profiles,
      early_signal: filters.early_signal,
      risk_level: filters.risk_level,
      edge_strength: filters.edge_strength,
      hide_isolated: filters.hide_isolated,
      limit_nodes: filters.limit_nodes,
    },
    view: 'graph',
  };
  
  // Selected nodes
  if (selectedNode) {
    state.selected_nodes = [selectedNode.id];
    state.focus = selectedNode.id;
  }
  
  // Compare mode
  if (compareState?.nodeA && compareState?.nodeB) {
    state.compare = {
      left: compareState.nodeA,
      right: compareState.nodeB,
      active: true,
    };
    state.view = 'compare';
  }
  
  return state;
};

/**
 * Apply decoded state to UI
 */
const applyGraphState = (state, setFilters, setSelectedNode, graphNodes) => {
  // Apply filters
  if (state.filters) {
    setFilters(prev => ({
      ...prev,
      profiles: state.filters.profiles || prev.profiles,
      early_signal: state.filters.early_signal || prev.early_signal,
      risk_level: state.filters.risk_level || prev.risk_level,
      edge_strength: state.filters.edge_strength || prev.edge_strength,
      hide_isolated: state.filters.hide_isolated ?? prev.hide_isolated,
      limit_nodes: state.filters.limit_nodes || prev.limit_nodes,
    }));
  }
  
  // Apply focus/highlight
  const focusId = state.focus || state.highlight;
  if (focusId && graphNodes?.length) {
    const node = graphNodes.find(n => n.id === focusId);
    if (node) {
      setSelectedNode(node);
    }
  }
  
  // Return compare state if present
  if (state.compare?.active || (state.compare?.left && state.compare?.right)) {
    return {
      nodeA: state.compare.left || state.compare.nodeA,
      nodeB: state.compare.right || state.compare.nodeB,
    };
  }
  
  return null;
};

const encodeState = async (state) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/connections/graph/state/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    const data = await res.json();
    return data.ok ? data.data.encoded : null;
  } catch (e) {
    console.error('[GraphState] Encode error:', e);
    return null;
  }
};

const decodeState = async (encoded) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/connections/graph/state/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encoded }),
    });
    const data = await res.json();
    return data.ok ? data.data.state : null;
  } catch (e) {
    console.error('[GraphState] Decode error:', e);
    return null;
  }
};

// ============================================================
// SUGGESTIONS PANEL ("Explore suggestions")
// ============================================================

const SuggestionsPanel = ({ onSelect, selectedId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/connections/graph/suggestions`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setSuggestions(data.suggestions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!suggestions.length) return null;

  const reasonLabels = {
    top_influence: 'Top Influencer',
    breakout: 'Breakout Signal',
    rising: 'Rising Star',
    high_connections: 'Well Connected',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          Explore Suggestions
        </h3>
        <span className="text-xs text-gray-400">{suggestions.length} suggested</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {suggestions.slice(0, 6).map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg border transition-all ${
              selectedId === s.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                s.badge === 'breakout' ? 'bg-green-500' :
                s.badge === 'rising' ? 'bg-yellow-500' : 'bg-gray-400'
              }`}>
                {s.display_name?.charAt(0) || '?'}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900 truncate max-w-24">{s.display_name}</div>
                <div className="text-xs text-gray-500">{reasonLabels[s.reason] || s.reason}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// FILTER PANEL
// ============================================================

const GraphFilterPanel = ({ filters, onChange, onClose }) => {
  const [local, setLocal] = useState(filters);

  const toggleArrayValue = (arr, value) => {
    return arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
  };

  const handleApply = () => {
    onChange(local);
    onClose();
  };

  const handleReset = () => {
    const reset = {
      profiles: ['retail', 'influencer', 'whale'],
      early_signal: [],
      risk_level: [],
      edge_strength: [],
      hide_isolated: false,
      limit_nodes: 50,
    };
    setLocal(reset);
    onChange(reset);
  };

  return (
    <div className="absolute left-4 top-4 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-5 z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Graph Filters</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* NODES */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Nodes</h4>
        
        {/* Profile */}
        <div className="mb-3">
          <label className="text-sm text-gray-600 mb-1 block">Profile</label>
          <div className="flex gap-1 flex-wrap">
            {['retail', 'influencer', 'whale'].map(p => (
              <button
                key={p}
                onClick={() => setLocal({ ...local, profiles: toggleArrayValue(local.profiles, p) })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  local.profiles.includes(p)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Early Signal */}
        <div className="mb-3">
          <label className="text-sm text-gray-600 mb-1 block">Early Signal</label>
          <div className="flex gap-1 flex-wrap">
            {['breakout', 'rising', 'none'].map(s => (
              <button
                key={s}
                onClick={() => setLocal({ ...local, early_signal: toggleArrayValue(local.early_signal, s) })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  local.early_signal.includes(s)
                    ? s === 'breakout' ? 'bg-green-500 text-white' : s === 'rising' ? 'bg-yellow-500 text-white' : 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'breakout' ? 'Breakout' : s === 'rising' ? 'Rising' : 'None'}
              </button>
            ))}
          </div>
        </div>

        {/* Risk */}
        <div className="mb-3">
          <label className="text-sm text-gray-600 mb-1 block">Risk Level</label>
          <div className="flex gap-1">
            {['low', 'medium', 'high'].map(r => (
              <button
                key={r}
                onClick={() => setLocal({ ...local, risk_level: toggleArrayValue(local.risk_level, r) })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  local.risk_level.includes(r)
                    ? r === 'low' ? 'bg-green-500 text-white' : r === 'medium' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* EDGES */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Edges</h4>
        <div className="mb-3">
          <label className="text-sm text-gray-600 mb-1 block">Strength</label>
          <div className="flex gap-1">
            {['low', 'medium', 'high'].map(s => (
              <button
                key={s}
                onClick={() => setLocal({ ...local, edge_strength: toggleArrayValue(local.edge_strength, s) })}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  local.edge_strength.includes(s)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW */}
      <div className="mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">View</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={local.hide_isolated}
            onChange={(e) => setLocal({ ...local, hide_isolated: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-500"
          />
          <span className="text-sm text-gray-600">Hide isolated nodes</span>
        </label>
        <div className="mt-2">
          <label className="text-sm text-gray-600 mb-1 block">Max nodes: {local.limit_nodes}</label>
          <input
            type="range"
            min={10}
            max={100}
            value={local.limit_nodes}
            onChange={(e) => setLocal({ ...local, limit_nodes: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleReset} className="flex-1">Reset</Button>
        <Button onClick={handleApply} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Apply</Button>
      </div>
    </div>
  );
};

// ============================================================
// NODE DETAILS PANEL
// ============================================================

const NodeDetailsPanel = ({ node, details, onClose, onCompare }) => {
  if (!node) return null;

  return (
    <div className="absolute right-4 top-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: node.color || '#64748b' }}
          >
            {node.label?.charAt(1)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{node.label}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${
              node.profile === 'whale' ? 'bg-indigo-100 text-indigo-700' :
              node.profile === 'influencer' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {node.profile}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Influence Score */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            Influence Score
          </div>
          <div className="text-2xl font-bold text-gray-900">{node.influence_score}</div>
        </div>

        {/* Early Signal */}
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <AlertTriangle className="w-4 h-4" />
            Early Signal
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            node.early_signal === 'breakout' ? 'bg-green-100 text-green-700' :
            node.early_signal === 'rising' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {node.early_signal === 'breakout' ? 'Breakout' :
             node.early_signal === 'rising' ? 'Rising' : 'None'}
          </span>
        </div>

        {/* Connected Nodes */}
        {details?.connected_nodes?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Users className="w-4 h-4" />
              Connected ({details.connected_nodes.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {details.connected_nodes.slice(0, 5).map((conn, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                  <span className="text-gray-700">{conn.label}</span>
                  <span className="text-xs text-gray-400">{(conn.weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Link to={`/connections/${node.id}`} className="block w-full">
            <Button className="w-full">View Full Profile</Button>
          </Link>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={() => onCompare(node)}
          >
            <Scale className="w-4 h-4" />
            Compare with...
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// RANKING TABLE (Below graph)
// ============================================================

const RankingTable = ({ ranking, onNodeSelect, selectedId }) => {
  const [sortBy, setSortBy] = useState('influence');

  if (!ranking?.items?.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Top Influencers</h3>
        <div className="flex gap-1">
          {['influence', 'early_signal'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'influence' ? 'Influence' : 'Signal'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranking.items.slice(0, 10).map((item, idx) => (
              <tr 
                key={item.id}
                onClick={() => onNodeSelect(item.id)}
                className={`cursor-pointer transition-colors ${
                  selectedId === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-2 text-sm text-gray-400 font-medium">{idx + 1}</td>
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-900">{item.label}</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{Math.round(item.score)}</td>
                <td className="px-4 py-2">
                  {item.early_signal && item.early_signal !== 'none' ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.early_signal === 'breakout' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {item.early_signal === 'breakout' ? 'Breakout' : 'Rising'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function ConnectionsInfluenceGraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [compareNode, setCompareNode] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [stateRestored, setStateRestored] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [filters, setFilters] = useState({
    profiles: ['retail', 'influencer', 'whale'],
    early_signal: [],
    risk_level: [],
    edge_strength: [],
    hide_isolated: false,
    limit_nodes: 50,
  });

  // P2.2.2: Restore state from URL on mount
  useEffect(() => {
    const restoreState = async () => {
      const stateParam = searchParams.get('state');
      if (stateParam && !stateRestored) {
        console.log('[GraphState] Restoring from URL...');
        const decoded = await decodeState(stateParam);
        if (decoded) {
          // Apply state using helper
          const compareResult = applyGraphState(decoded, setFilters, setSelectedNode, graphData.nodes);
          
          // Handle compare mode
          if (compareResult) {
            setCompareNode({ id: compareResult.nodeA });
            setShowCompareModal(true);
          }
          
          console.log('[GraphState] Restored:', decoded);
        }
        setStateRestored(true);
      }
    };
    restoreState();
  }, [searchParams, stateRestored, graphData.nodes]);

  // P2.2.2b: Update URL when state changes (replaceState - no history pollution)
  useEffect(() => {
    if (!stateRestored) return; // Wait for initial restore
    
    const updateUrl = async () => {
      const state = buildGraphState(filters, selectedNode, null);
      const encoded = await encodeState(state);
      
      if (encoded) {
        const newUrl = `${window.location.pathname}?state=${encoded}`;
        window.history.replaceState(null, '', newUrl);
      }
    };
    
    // Debounce URL updates
    const timeout = setTimeout(updateUrl, 500);
    return () => clearTimeout(timeout);
  }, [filters, selectedNode, stateRestored]);

  // P2.2.3: Share current state
  const handleShare = useCallback(async () => {
    const state = buildGraphState(filters, selectedNode, compareNode ? {
      nodeA: compareNode.id,
      nodeB: null, // Will be set when comparison is active
    } : null);
    
    const encoded = await encodeState(state);
    if (encoded) {
      const shareUrl = `${window.location.origin}/connections/graph?state=${encoded}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      } catch (e) {
        // Fallback for older browsers
        prompt('Copy this link:', shareUrl);
      }
    }
  }, [filters, selectedNode, compareNode]);

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use GET with query params for new API
      const params = new URLSearchParams({
        limit: filters.limit_nodes?.toString() || '50',
      });
      if (filters.profiles?.length) params.append('profile_types', filters.profiles.join(','));
      if (filters.early_signal?.length) params.append('early_signals', filters.early_signal.join(','));
      if (filters.risk_level?.length) params.append('risk_levels', filters.risk_level.join(','));
      
      const res = await fetch(`${BACKEND_URL}/api/connections/graph?${params}`);
      const data = await res.json();
      
      // New API format: nodes/edges at top level, not nested in data
      if (data.ok && data.nodes) {
        const transformed = {
          nodes: data.nodes.map(n => ({
            id: n.id,
            label: n.display_name || `@${n.handle}`,
            handle: n.handle,
            displayName: n.display_name,
            profile: n.profile_type,
            influence_score: n.influence_score,
            early_signal: n.early_signal,
            risk_level: n.risk_level,
            color: n.color,
            size: n.size,
            val: n.size || 10,
          })),
          links: data.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            from: e.source,
            to: e.target,
            type: e.edge_type,
            weight: e.weight,
            strength: e.strength,
            jaccard: e.jaccard,
            shared: e.shared_count,
          })),
        };
        setGraphData(transformed);
        console.log('[Graph] Loaded:', data.stats);
      } else {
        console.error('[Graph] API error:', data);
      }
    } catch (err) {
      setError(err.message);
      console.error('[Graph] Fetch error:', err);
    }
    setLoading(false);
  }, [filters]);

  // Fetch ranking
  const fetchRanking = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/connections/graph/ranking?limit=20`);
      const data = await res.json();
      if (data.ok) {
        setRanking(data.data);
      }
    } catch (err) {
      console.error('Ranking fetch error:', err);
    }
  }, []);

  // Fetch node details
  const fetchNodeDetails = useCallback(async (nodeId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/connections/graph/node/${nodeId}`);
      const data = await res.json();
      if (data.ok) {
        setNodeDetails(data.data);
      }
    } catch (err) {
      console.error('Node details fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
    fetchRanking();
  }, [fetchGraph, fetchRanking]);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (node?.id) {
      fetchNodeDetails(node.id);
    }
  }, [fetchNodeDetails]);

  // Handle node selection from ranking
  const handleRankingSelect = useCallback((nodeId) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      fetchNodeDetails(nodeId);
    }
  }, [graphData.nodes, fetchNodeDetails]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <Network className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Connections Graph</h1>
                <p className="text-sm text-gray-500 mt-1">Influence relationships visualization</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg text-sm">
                <span><strong>{graphData.nodes.length}</strong> nodes</span>
                <span className="text-gray-300">|</span>
                <span><strong>{graphData.links.length}</strong> edges</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => { fetchGraph(); fetchRanking(); }}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Link 
            to="/connections"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Influencers
          </Link>
          <span className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white flex items-center gap-2">
            <Network className="w-4 h-4" />
            Graph
          </span>
          <Link 
            to="/connections/radar"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Radio className="w-4 h-4" />
            Radar
          </Link>
          <Link 
            to="/connections/backers"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Backers
          </Link>
          <Link 
            to="/connections/reality"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            Leaderboard
          </Link>
          
          {/* Filters button */}
          <div className="ml-auto flex items-center gap-2">
            {/* Share Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleShare}
              className="relative"
              data-testid="graph-share-btn"
            >
              {shareToast ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-1" />
                  Share
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>
          </div>
        </div>

        {/* Suggestions Panel */}
        <SuggestionsPanel
          onSelect={handleRankingSelect}
          selectedId={selectedNode?.id}
        />

        {/* Graph Container */}
        <div className="relative bg-[#0a0e1a] rounded-xl overflow-hidden mb-6" style={{ height: '500px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">Loading graph...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-gray-400">{error}</p>
              </div>
            </div>
          ) : (
            <ForceGraphCore
              data={graphData}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id}
              fitOnLoad={true}
              width={1200}
              height={500}
            />
          )}

          {/* Overlay Panels */}
          {showFilters && (
            <GraphFilterPanel
              filters={filters}
              onChange={setFilters}
              onClose={() => setShowFilters(false)}
            />
          )}

          {selectedNode && (
            <NodeDetailsPanel
              node={selectedNode}
              details={nodeDetails}
              onClose={() => { setSelectedNode(null); setNodeDetails(null); }}
              onCompare={(node) => {
                setCompareNode(node);
                setShowCompareModal(true);
              }}
            />
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-gray-800/90 backdrop-blur rounded-lg p-3 text-xs space-y-2">
            <div className="text-gray-400 font-medium mb-2">Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-300">Breakout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-300">Rising</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-gray-300">Whale</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-gray-300">Influencer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-gray-300">Retail</span>
            </div>
          </div>
        </div>

        {/* Ranking Table (Below Graph) */}
        <RankingTable
          ranking={ranking}
          onNodeSelect={handleRankingSelect}
          selectedId={selectedNode?.id}
        />
      </div>

      {/* Compare Modal */}
      {showCompareModal && compareNode && (
        <GraphCompareWrapper
          nodeA={compareNode}
          allNodes={graphData.nodes}
          onClose={() => {
            setShowCompareModal(false);
            setCompareNode(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// GRAPH COMPARE WRAPPER
// ============================================================

const GraphCompareWrapper = ({ nodeA, allNodes, onClose }) => {
  const [selectedB, setSelectedB] = useState(null);
  const [accountA, setAccountA] = useState(null);
  const [accountB, setAccountB] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filter out current node from options
  const availableNodes = allNodes.filter(n => n.id !== nodeA?.id);

  // Fetch account details when selection changes
  useEffect(() => {
    if (!nodeA) return;
    // Create account object from node
    setAccountA({
      id: nodeA.id,
      handle: nodeA.handle || nodeA.label,
      display_name: nodeA.label || nodeA.displayName,
      influence_base: nodeA.influence_score || 0,
      influence_adjusted: nodeA.influence_score || 0,
      profile: nodeA.profile,
      risk_level: nodeA.risk_level,
      early_signal: { badge: nodeA.early_signal || 'none', score: 0 },
      trend: { velocity_norm: 0, acceleration_norm: 0, state: 'stable' },
    });
  }, [nodeA]);

  const handleSelectB = async (nodeB) => {
    setSelectedB(nodeB.id);
    setLoading(true);
    try {
      // Fetch full account data from API if available
      const res = await fetch(`${BACKEND_URL}/api/connections/graph/node/${nodeB.id}`);
      const data = await res.json();
      
      setAccountB({
        id: nodeB.id,
        handle: nodeB.handle || nodeB.label,
        display_name: nodeB.label || nodeB.displayName,
        influence_base: nodeB.influence_score || data?.data?.influence_score || 0,
        influence_adjusted: nodeB.influence_score || 0,
        profile: nodeB.profile,
        risk_level: nodeB.risk_level,
        early_signal: { badge: nodeB.early_signal || 'none', score: 0 },
        trend: { velocity_norm: 0, acceleration_norm: 0, state: 'stable' },
      });
    } catch (e) {
      // Fallback to node data
      setAccountB({
        id: nodeB.id,
        handle: nodeB.handle || nodeB.label,
        display_name: nodeB.label || nodeB.displayName,
        influence_base: nodeB.influence_score || 0,
        influence_adjusted: nodeB.influence_score || 0,
        profile: nodeB.profile,
        risk_level: nodeB.risk_level,
        early_signal: { badge: nodeB.early_signal || 'none', score: 0 },
        trend: { velocity_norm: 0, acceleration_norm: 0, state: 'stable' },
      });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">Compare Accounts</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Account A (Selected) */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="text-xs text-blue-600 font-medium mb-2">Account A (Selected)</div>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: nodeA?.color || '#3b82f6' }}
              >
                {nodeA?.label?.charAt(0) || '?'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{nodeA?.label}</div>
                <div className="text-sm text-gray-500">Score: {nodeA?.influence_score}</div>
              </div>
            </div>
          </div>

          {/* Select Account B */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Select Account to Compare</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {availableNodes.slice(0, 20).map(node => (
                <button
                  key={node.id}
                  onClick={() => handleSelectB(node)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                    selectedB === node.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: node.color || '#64748b' }}
                  >
                    {node.label?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{node.label}</div>
                    <div className="text-xs text-gray-500">{node.influence_score}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Result */}
          {accountA && accountB && !loading && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Comparison Result</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Account A */}
                <div className={`p-4 rounded-xl border-2 ${
                  accountA.influence_base > accountB.influence_base ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{accountA.influence_base}</div>
                    <div className="text-sm text-gray-500">{accountA.display_name}</div>
                    {accountA.influence_base > accountB.influence_base && (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">WINNER</span>
                    )}
                  </div>
                </div>
                {/* Account B */}
                <div className={`p-4 rounded-xl border-2 ${
                  accountB.influence_base > accountA.influence_base ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{accountB.influence_base}</div>
                    <div className="text-sm text-gray-500">{accountB.display_name}</div>
                    {accountB.influence_base > accountA.influence_base && (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">WINNER</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-700">
                  {accountA.influence_base > accountB.influence_base ? (
                    <><strong>{accountA.display_name}</strong> has stronger influence (+{accountA.influence_base - accountB.influence_base} points)</>
                  ) : accountB.influence_base > accountA.influence_base ? (
                    <><strong>{accountB.display_name}</strong> has stronger influence (+{accountB.influence_base - accountA.influence_base} points)</>
                  ) : (
                    <>Both accounts have equal influence</>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading comparison...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
