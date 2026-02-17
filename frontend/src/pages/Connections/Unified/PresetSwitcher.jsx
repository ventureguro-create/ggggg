/**
 * Preset Switcher Component
 * 
 * PHASE B: UI Presets v2
 */

import React from 'react';
import { PRESETS } from './presets.constants';

const buttonStyles = {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #374151',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    transition: 'all 0.15s ease',
  },
  active: {
    background: '#4f46e5',
    borderColor: '#4f46e5',
    color: '#fff',
  },
  inactive: {
    background: '#1f2937',
    borderColor: '#374151',
    color: '#9ca3af',
  },
};

export function PresetSwitcher({ preset, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '8px 0' }}>
      {PRESETS.map(p => {
        const isActive = preset === p.key;
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            style={{
              ...buttonStyles.base,
              ...(isActive ? buttonStyles.active : buttonStyles.inactive),
            }}
            title={p.description}
            data-testid={`preset-${p.key.toLowerCase()}`}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PresetSwitcher;
