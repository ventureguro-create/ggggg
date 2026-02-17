/**
 * Admin Wallet Attribution Page
 * 
 * E3: Manage wallet → actor attributions
 */

import React, { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Check, X, Search, Filter, 
  ExternalLink, Shield, AlertCircle 
} from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const CHAINS = ['ethereum', 'solana', 'bitcoin', 'arbitrum', 'optimism', 'base', 'polygon'];
const SOURCES = ['MANUAL', 'ARKHAM', 'NANSEN', 'ONCHAIN_LABEL', 'SELF_REPORTED', 'INFERRED'];
const CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'];

export default function AdminWalletAttributionPage() {
  const [stats, setStats] = useState(null);
  const [attributions, setAttributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ chain: '', confidence: '', verified: '' });
  
  const [formData, setFormData] = useState({
    walletAddress: '',
    chain: 'ethereum',
    actorId: '',
    backerId: '',
    actorLabel: '',
    source: 'MANUAL',
    confidence: 'MEDIUM',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/connections/wallets/stats`),
        axios.get(`${API_BASE}/api/admin/connections/wallets/list`, { params: filters }),
      ]);
      
      if (statsRes.data.ok) setStats(statsRes.data.data);
      if (listRes.data.ok) setAttributions(listRes.data.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleCreate = async () => {
    try {
      await axios.post(`${API_BASE}/api/admin/connections/wallets/create`, formData);
      setShowForm(false);
      setFormData({
        walletAddress: '',
        chain: 'ethereum',
        actorId: '',
        backerId: '',
        actorLabel: '',
        source: 'MANUAL',
        confidence: 'MEDIUM',
        notes: '',
      });
      loadData();
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const handleVerify = async (walletAddress, chain) => {
    try {
      await axios.post(`${API_BASE}/api/admin/connections/wallets/verify`, {
        walletAddress,
        chain,
        verifiedBy: 'admin',
      });
      loadData();
    } catch (err) {
      console.error('Failed to verify:', err);
    }
  };

  const handleDelete = async (walletAddress, chain) => {
    if (!confirm('Delete this attribution?')) return;
    try {
      await axios.delete(`${API_BASE}/api/admin/connections/wallets/delete`, {
        data: { walletAddress, chain }
      });
      loadData();
    } catch (err) {
      console.error('Failed to delete:', err);
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
          <Wallet className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Wallet Attribution</h1>
            <p className="text-sm text-gray-400">E3: Connect wallets to actors</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          data-testid="add-attribution-btn"
        >
          <Plus className="w-4 h-4" />
          Add Attribution
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Verified</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.verified}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Chains</div>
            <div className="text-2xl font-bold text-blue-400">{Object.keys(stats.byChain || {}).length}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">High Confidence</div>
            <div className="text-2xl font-bold text-amber-400">{stats.byConfidence?.HIGH || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filters.chain}
          onChange={e => setFilters(f => ({ ...f, chain: e.target.value }))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All Chains</option>
          {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filters.confidence}
          onChange={e => setFilters(f => ({ ...f, confidence: e.target.value }))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All Confidence</option>
          {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filters.verified}
          onChange={e => setFilters(f => ({ ...f, verified: e.target.value }))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All Status</option>
          <option value="true">Verified Only</option>
          <option value="false">Unverified Only</option>
        </select>
      </div>

      {/* Attributions Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Wallet</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Chain</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {attributions.map((attr, idx) => (
              <tr key={idx} className="hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">
                      {attr.walletAddress.slice(0, 8)}...{attr.walletAddress.slice(-6)}
                    </span>
                    <a 
                      href={`https://etherscan.io/address/${attr.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-400"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                    {attr.chain}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">{attr.actorLabel}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">{attr.source}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    attr.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                    attr.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                    attr.confidence === 'LOW' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-600 text-gray-400'
                  }`}>
                    {attr.confidence}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {attr.verified ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Shield className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <AlertCircle className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {!attr.verified && (
                      <button
                        onClick={() => handleVerify(attr.walletAddress, attr.chain)}
                        className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                        title="Verify"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(attr.walletAddress, attr.chain)}
                      className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {attributions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No wallet attributions found
          </div>
        )}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-white">Add Wallet Attribution</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Wallet Address *</label>
                <input
                  type="text"
                  value={formData.walletAddress}
                  onChange={e => setFormData(f => ({ ...f, walletAddress: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="0x..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Chain *</label>
                  <select
                    value={formData.chain}
                    onChange={e => setFormData(f => ({ ...f, chain: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Source *</label>
                  <select
                    value={formData.source}
                    onChange={e => setFormData(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Actor Label *</label>
                <input
                  type="text"
                  value={formData.actorLabel}
                  onChange={e => setFormData(f => ({ ...f, actorLabel: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="a16z Crypto, Paradigm, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Actor ID (Twitter)</label>
                  <input
                    type="text"
                    value={formData.actorId}
                    onChange={e => setFormData(f => ({ ...f, actorId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="tw:1234567"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Backer ID</label>
                  <input
                    type="text"
                    value={formData.backerId}
                    onChange={e => setFormData(f => ({ ...f, backerId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="backer:a16z"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Confidence *</label>
                <select
                  value={formData.confidence}
                  onChange={e => setFormData(f => ({ ...f, confidence: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.walletAddress || !formData.actorLabel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
