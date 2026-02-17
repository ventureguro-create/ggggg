/**
 * Unified Page - PHASE B
 * 
 * Main page with Preset Switcher and Account Cards
 */

import React, { useEffect, useState, useCallback } from 'react';
import { PresetSwitcher } from './PresetSwitcher';
import { AccountCard } from './AccountCard';
import { fetchUnified } from './unified.api';
import { DEFAULT_PRESET } from './presets.constants';

function getPresetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('preset') || DEFAULT_PRESET;
}

export default function UnifiedPage() {
  const [preset, setPreset] = useState(getPresetFromUrl());
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update URL when preset changes
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('preset', preset);
    window.history.replaceState({}, '', url.toString());
  }, [preset]);

  // Fetch data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUnified(preset, query);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [preset, query]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300); // Debounce
    return () => clearTimeout(timer);
  }, [loadData]);

  const items = data?.data || [];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f9fafb',
        padding: '24px',
      }}
      data-testid="unified-page"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
          Connections · Unified
        </h1>

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by username..."
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid #374151',
            background: '#1f2937',
            color: '#f9fafb',
            minWidth: '250px',
            fontSize: '14px',
          }}
          data-testid="unified-search"
        />
      </div>

      {/* Preset Switcher */}
      <PresetSwitcher preset={preset} onChange={setPreset} />

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginTop: '16px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#9ca3af',
        }}
      >
        <span>
          Group: <strong style={{ color: '#f9fafb' }}>{data?.group || preset}</strong>
        </span>
        <span>
          Results: <strong style={{ color: '#f9fafb' }}>{items.length}</strong>
        </span>
        {loading && <span style={{ color: '#4f46e5' }}>• Loading...</span>}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#fecaca',
          }}
        >
          {error}
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        {items.map((item, idx) => (
          <AccountCard key={item.id || item.accountId || idx} item={item} onRefresh={loadData} />
        ))}
      </div>

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            color: '#6b7280',
          }}
        >
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No accounts found</p>
          <p style={{ fontSize: '14px' }}>
            Try selecting a different preset or adjusting your search.
          </p>
        </div>
      )}
    </div>
  );
}
