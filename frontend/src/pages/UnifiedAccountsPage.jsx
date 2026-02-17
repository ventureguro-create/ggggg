import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Users, Zap, TrendingUp, Building2, Newspaper, Image, Flame, Brain } from 'lucide-react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const FACET_TABS = [
  { key: 'SMART', label: 'Smart', icon: Brain, color: 'text-purple-600' },
  { key: 'INFLUENCE', label: 'Influencers', icon: Users, color: 'text-blue-600' },
  { key: 'EARLY', label: 'Early', icon: Zap, color: 'text-yellow-600' },
  { key: 'VC', label: 'VCs & Funds', icon: Building2, color: 'text-green-600' },
  { key: 'MEDIA', label: 'Media', icon: Newspaper, color: 'text-red-600' },
  { key: 'NFT', label: 'NFT', icon: Image, color: 'text-pink-600' },
  { key: 'TRENDING', label: 'Trending', icon: TrendingUp, color: 'text-orange-600' },
  { key: 'POPULAR', label: 'Popular', icon: Flame, color: 'text-amber-600' },
];

export default function UnifiedAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facetTitle, setFacetTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const activeFacet = searchParams.get('facet') || 'SMART';

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/connections/unified?facet=${activeFacet}`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
        setFacetTitle(data.title || activeFacet);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [activeFacet]);

  const handleFacetChange = (key) => {
    setSearchParams({ facet: key });
  };

  const filteredAccounts = accounts.filter(acc =>
    !searchQuery ||
    acc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unified Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Browse accounts by category</p>
        </div>
      </div>

      {/* Facet Tabs */}
      <div className="flex flex-wrap gap-2">
        {FACET_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFacet === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleFacetChange(tab.key)}
              data-testid={`facet-tab-${tab.key.toLowerCase()}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? '' : tab.color}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Current Facet Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{facetTitle}</h2>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {filteredAccounts.length} accounts found
        </p>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {/* Accounts Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              data-testid={`account-card-${account.id}`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-3">
                {/* Avatar placeholder */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                  account.kind === 'BACKER' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                  {account.title?.[0] || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {account.title}
                  </h3>
                  {account.handle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {account.handle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {account.categories?.slice(0, 2).map((cat) => (
                      <span key={cat} className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Kind badge */}
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  account.kind === 'BACKER'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {account.kind}
                </span>
              </div>

              {/* Scores */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {account.smart != null && (
                  <div>
                    <div className={`text-lg font-bold ${getScoreColor(account.smart)} px-2 py-1 rounded`}>
                      {Math.round(account.smart * 100)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Smart</div>
                  </div>
                )}
                {account.influence != null && (
                  <div>
                    <div className={`text-lg font-bold ${getScoreColor(account.influence)} px-2 py-1 rounded`}>
                      {Math.round(account.influence * 100)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Influence</div>
                  </div>
                )}
                {account.early != null && (
                  <div>
                    <div className={`text-lg font-bold ${getScoreColor(account.early)} px-2 py-1 rounded`}>
                      {Math.round(account.early * 100)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Early</div>
                  </div>
                )}
                {account.authority != null && (
                  <div>
                    <div className={`text-lg font-bold ${getScoreColor(account.authority)} px-2 py-1 rounded`}>
                      {Math.round(account.authority * 100)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Authority</div>
                  </div>
                )}
              </div>

              {/* Footer stats */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                {account.followers != null && (
                  <span>{account.followers.toLocaleString()} followers</span>
                )}
                <span className={`px-2 py-0.5 rounded ${getScoreColor(account.confidence)}`}>
                  {Math.round((account.confidence || 0) * 100)}% conf
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredAccounts.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No accounts found for this filter.
        </div>
      )}
    </div>
  );
}
