/**
 * Account Card Component
 * 
 * Displays account with taxonomy badges and engagement metrics
 */

import React, { useState } from 'react';
import { TaxonomyBadges } from './TaxonomyBadges';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export function AccountCard({ item, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  
  const groups = item.groups || item.categories?.map(c => ({ group: c, weight: 1 })) || [];
  const score = item.score || item.smart || 0;
  const handle = item.handle || '';
  const username = handle.replace('@', '') || item.username || item.accountId || 'Unknown';
  const name = item.title || item.name || '';
  const avatar = item.profile_image_url || item.avatar;
  
  // Metrics
  const followers = item.followers || 0;
  const engagement = item.engagement || 0;
  const influence = item.influence || 0;
  const smart = item.smart || 0;

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleRefreshEngagement = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/connections/unified/refresh-engagement/${username}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.ok && onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      data-testid={`account-card-${username}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {avatar ? (
            <img
              src={avatar}
              alt={username}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, color: '#f9fafb', fontSize: '14px' }}>
              {name || username}
            </div>
            <div style={{ color: '#6b7280', fontSize: '12px' }}>@{username}</div>
          </div>
        </div>

        {/* Smart Score */}
        <div
          style={{
            background: score >= 0.7 ? '#065f46' : score >= 0.4 ? '#1e40af' : '#374151',
            padding: '4px 10px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '13px',
            color: '#fff',
          }}
          title="Smart Score"
        >
          {Math.round(score * 100)}%
        </div>
      </div>

      {/* Taxonomy Badges */}
      <TaxonomyBadges groups={groups} maxShow={3} />

      {/* Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px',
        background: '#1f2937',
        borderRadius: '8px',
        padding: '10px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f9fafb' }}>
            {formatNumber(followers)}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
            Followers
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
            {(engagement * 100).toFixed(2)}%
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
            Engagement
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#8b5cf6' }}>
            {Math.round(influence * 100)}%
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
            Influence
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={handleRefreshEngagement}
        disabled={refreshing}
        style={{
          background: refreshing ? '#374151' : '#2563eb',
          border: 'none',
          borderRadius: '6px',
          padding: '8px 12px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 600,
          cursor: refreshing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'background 0.2s',
        }}
        data-testid={`refresh-engagement-${username}`}
      >
        {refreshing ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
            Обновление...
          </>
        ) : (
          <>
            ⟳ Обновить Engagement
          </>
        )}
      </button>
    </div>
  );
}

export default AccountCard;
