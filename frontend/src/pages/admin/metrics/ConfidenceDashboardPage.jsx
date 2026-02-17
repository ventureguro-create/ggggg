/**
 * P2.A — Confidence Dashboard Page
 * 
 * Admin metrics page for confidence quality monitoring.
 */

import React from 'react';
import { ConfidenceDashboard } from '../../../components/admin/metrics/ConfidenceDashboard';

export function ConfidenceDashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <ConfidenceDashboard />
    </div>
  );
}

export default ConfidenceDashboardPage;
