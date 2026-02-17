/**
 * Project Detail Page - E2 Phase
 * 
 * Shows WHY a project matters through network, capital and influence.
 * 
 * Key sections:
 * 1. Header - Name, Stage, Authority, Reality
 * 2. Why It Matters - Generated explanation
 * 3. Backers - Anchor badges, co-invest strength  
 * 4. Influence Accounts - Grouped by role
 * 5. Network Graph - Local subgraph
 * 6. Related Projects - With reasons
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Network,
  TrendingUp,
  Shield,
  Star,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  CircleDot,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============================================================
// HELPER COMPONENTS
// ============================================================

const StageBadge = ({ stage }) => {
  const colors = {
    EARLY: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    GROWTH: 'bg-blue-100 text-blue-700 border-blue-300',
    MATURE: 'bg-green-100 text-green-700 border-green-300',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[stage] || colors.EARLY}`}>
      {stage}
    </span>
  );
};

const RealityBadge = ({ signal }) => {
  const configs = {
    STRONG: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Confirmed' },
    MODERATE: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, label: 'Mixed' },
    WEAK: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Weak' },
    UNKNOWN: { color: 'bg-gray-100 text-gray-500', icon: CircleDot, label: 'Unknown' },
  };
  const cfg = configs[signal] || configs.UNKNOWN;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const CategoryBadge = ({ category }) => (
  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
    {category}
  </span>
);

const RoleBadge = ({ role }) => {
  const colors = {
    FOUNDER: 'bg-purple-100 text-purple-700',
    DEV: 'bg-blue-100 text-blue-700',
    CORE: 'bg-indigo-100 text-indigo-700',
    ADVOCATE: 'bg-green-100 text-green-700',
    MEDIA: 'bg-orange-100 text-orange-700',
    INVESTOR: 'bg-yellow-100 text-yellow-700',
    OTHER: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] || colors.OTHER}`}>
      {role}
    </span>
  );
};

const AuthorityMeter = ({ score, size = 'md' }) => {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  
  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full ${height}`}>
        <div 
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/connections/projects/${slug}/full`);
      const json = await res.json();
      
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load project');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-gray-700">{error || 'Project not found'}</h2>
          <Link to="/connections" className="text-blue-500 mt-4 inline-block">← Back to Connections</Link>
        </div>
      </div>
    );
  }

  const { project, backers, accounts, network, related, whyItMatters } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Back Link */}
        <Link 
          to="/connections" 
          className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Connections
        </Link>

        {/* ============================================================ */}
        {/* HEADER */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <StageBadge stage={project.stage} />
              </div>
              
              {project.description && (
                <p className="text-gray-500 mb-3">{project.description}</p>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                {project.categories?.map(cat => (
                  <CategoryBadge key={cat} category={cat} />
                ))}
                {project.launchYear && (
                  <span className="text-xs text-gray-400">Since {project.launchYear}</span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{project.authorityScore}</div>
              <div className="text-xs text-gray-500 uppercase">Authority Score</div>
              <div className="w-24 mt-2">
                <AuthorityMeter score={project.authorityScore} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* WHY IT MATTERS */}
        {/* ============================================================ */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-800">Why It Matters</h2>
            <RealityBadge signal={whyItMatters.realitySignal} />
          </div>
          
          <div className="space-y-2 text-gray-700">
            <p className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              {whyItMatters.summary.backers}
            </p>
            <p className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              {whyItMatters.summary.accounts}
            </p>
            <p className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              {whyItMatters.summary.reality}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ============================================================ */}
          {/* BACKERS */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                Backers
              </h2>
              {backers.hasAnchor && (
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" /> Has Anchor
                </span>
              )}
            </div>
            
            {backers.list.length === 0 ? (
              <p className="text-gray-400 text-sm">No backers linked</p>
            ) : (
              <div className="space-y-3">
                {backers.list.map((backer) => (
                  <div 
                    key={backer.backerId}
                    className={`p-3 rounded-lg border ${backer.isAnchor ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{backer.backerName}</span>
                          {backer.isAnchor && (
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Star className="w-3 h-3" /> Anchor
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {backer.backerType} • {backer.rounds?.join(', ') || 'Unknown rounds'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{backer.seedAuthority}</div>
                        <div className="text-xs text-gray-400">Authority</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* ACCOUNTS */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-400" />
              Influence Accounts
            </h2>
            
            {accounts.list.length === 0 ? (
              <p className="text-gray-400 text-sm">No accounts linked</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(accounts.byRole || {}).map(([role, roleAccounts]) => (
                  <div key={role}>
                    <div className="text-xs font-medium text-gray-500 uppercase mb-2">{role}</div>
                    <div className="space-y-2">
                      {roleAccounts.map((account) => (
                        <div 
                          key={account.actorId}
                          className="p-2.5 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">
                              @{account.twitterHandle || account.actorId}
                            </span>
                            <RoleBadge role={account.role} />
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">
                              Authority: <span className="font-medium">{account.authority}</span>
                            </span>
                            <RealityBadge signal={account.realityBadge === 'CONFIRMED' ? 'STRONG' : account.realityBadge === 'RISKY' ? 'WEAK' : 'UNKNOWN'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* NETWORK GRAPH (Simplified) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-gray-400" />
            Network Snapshot
          </h2>
          
          {network.nodes.length === 0 ? (
            <p className="text-gray-400 text-sm">No network data</p>
          ) : (
            <div>
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">{network.nodes.length}</span> nodes • 
                  <span className="font-medium"> {network.edges.length}</span> edges
                </div>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="w-3 h-3 rounded-full bg-purple-400" /> Project
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="w-3 h-3 rounded-full bg-blue-400" /> Backer
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="w-3 h-3 rounded-full bg-green-400" /> Account
                  </span>
                </div>
              </div>
              
              {/* Simplified node list - can be replaced with actual graph visualization */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {network.nodes.map(node => (
                  <div 
                    key={node.id}
                    className={`p-2 rounded-lg text-xs border ${
                      node.type === 'PROJECT' ? 'bg-purple-50 border-purple-200' :
                      node.type === 'BACKER' ? 'bg-blue-50 border-blue-200' :
                      'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="font-medium truncate">{node.name}</div>
                    <div className="text-gray-500">{node.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* RELATED PROJECTS */}
        {/* ============================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-gray-400" />
            Related Projects
          </h2>
          
          {related.length === 0 ? (
            <p className="text-gray-400 text-sm">No related projects found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {related.map((rel) => (
                <Link 
                  key={rel.projectId}
                  to={`/connections/projects/${rel.projectSlug}`}
                  className="p-4 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{rel.projectName}</span>
                    <span className="text-xs text-gray-500">{Math.round(rel.strength * 100)}% match</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rel.reasons.map(reason => (
                      <span key={reason} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {reason.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  {rel.explain?.sharedBackers?.length > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Shared: {rel.explain.sharedBackers.join(', ')}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8">
          Project Detail Page — E2 Phase — FREEZE v2
        </div>
      </div>
    </div>
  );
}
