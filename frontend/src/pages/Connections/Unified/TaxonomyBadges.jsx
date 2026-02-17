/**
 * Taxonomy Badges Component
 * 
 * Shows group membership badges on account cards
 */

import React from 'react';

const GROUP_COLORS = {
  EARLY_PROJECTS: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  VC: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  SMART: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  INFLUENCE: { bg: '#fae8ff', border: '#d946ef', text: '#86198f' },
  MEDIA: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
  NFT: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  TRENDING_TRADING: { bg: '#ffedd5', border: '#f97316', text: '#9a3412' },
  POPULAR_PROJECTS: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  MOST_SEARCHED: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
};

const GROUP_LABELS = {
  EARLY_PROJECTS: 'Early',
  VC: 'VC',
  SMART: 'Smart',
  INFLUENCE: 'Influence',
  MEDIA: 'Media',
  NFT: 'NFT',
  TRENDING_TRADING: 'Trading',
  POPULAR_PROJECTS: 'Popular',
  MOST_SEARCHED: 'Searched',
};

export function TaxonomyBadges({ groups, maxShow = 3 }) {
  if (!groups || groups.length === 0) return null;

  const displayGroups = groups.slice(0, maxShow);

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {displayGroups.map((g, idx) => {
        const colors = GROUP_COLORS[g.group] || GROUP_COLORS.MOST_SEARCHED;
        const label = GROUP_LABELS[g.group] || g.group;
        const percent = Math.round((g.weight || 0) * 100);

        return (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '999px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            {label}
            <span style={{ opacity: 0.7 }}>{percent}%</span>
          </span>
        );
      })}
      {groups.length > maxShow && (
        <span style={{
          fontSize: '11px',
          padding: '3px 6px',
          color: '#6b7280',
        }}>
          +{groups.length - maxShow}
        </span>
      )}
    </div>
  );
}

export default TaxonomyBadges;
