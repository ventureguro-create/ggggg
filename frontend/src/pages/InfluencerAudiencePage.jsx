/**
 * Influencer Audience Page
 * 
 * Detailed audience quality view for an influencer.
 * Shows: AQE metrics, follower samples, classification breakdown.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAudienceQuality, fetchAudienceQualityClassify } from '../api/audienceQuality.api';
import AudienceQualityBar from '../components/connections/AudienceQualityBar';

function pct(x) {
  return Math.round((x ?? 0) * 100);
}

function LabelBadge({ label }) {
  const colors = {
    REAL: 'bg-green-900/50 text-green-400 border-green-700',
    LOW_QUALITY: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    BOT_LIKELY: 'bg-orange-900/50 text-orange-400 border-orange-700',
    FARM_NODE: 'bg-red-900/50 text-red-400 border-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${colors[label] || 'bg-gray-700 text-gray-300'}`}>
      {label}
    </span>
  );
}

export default function InfluencerAudiencePage() {
  const { handle } = useParams();
  const [aqe, setAqe] = useState(null);
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [aqeData, classifyData] = await Promise.all([
          fetchAudienceQuality(handle),
          fetchAudienceQualityClassify(handle, 100),
        ]);
        setAqe(aqeData);
        setClassification(classifyData);
      } catch (err) {
        setError(err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="animate-pulse">Loading audience data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/connections" className="text-blue-400 hover:underline text-sm mb-2 inline-block">
          ← Back to Connections
        </Link>
        <h1 className="text-2xl font-bold">
          Audience Quality: @{handle}
        </h1>
        <p className="text-gray-400 mt-1">
          Analysis of follower quality and patterns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Real Audience</div>
          <div className={`text-3xl font-bold ${
            pct(aqe?.real_audience_pct) >= 70 ? 'text-green-400' :
            pct(aqe?.real_audience_pct) >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {pct(aqe?.real_audience_pct)}%
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Bot Pressure</div>
          <div className={`text-3xl font-bold ${
            pct(aqe?.bot_pressure_pct) <= 15 ? 'text-green-400' :
            pct(aqe?.bot_pressure_pct) <= 30 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {pct(aqe?.bot_pressure_pct)}%
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Confidence</div>
          <div className="text-3xl font-bold text-white">
            {aqe?.confidence_level || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            {aqe?.sampledFollowers || 0} sampled
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Anomaly</div>
          <div className={`text-3xl font-bold ${
            aqe?.anomaly?.anomaly ? 'text-red-400' : 'text-green-400'
          }`}>
            {aqe?.anomaly?.anomaly ? 'DETECTED' : 'NONE'}
          </div>
        </div>
      </div>

      {/* AQE Quality Bar */}
      <div className="mb-8 max-w-md">
        <AudienceQualityBar aqe={aqe} />
      </div>

      {/* Breakdown */}
      {classification?.breakdown && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Classification Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(classification.breakdown).map(([label, count]) => (
              <div key={label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <LabelBadge label={label.toUpperCase()} />
                <div className="text-2xl font-bold mt-2">{count}</div>
                <div className="text-gray-500 text-xs">
                  {Math.round((count / classification.sampleSize) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follower Samples Table */}
      {classification?.classified && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Follower Samples ({classification.classified.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="py-2 px-3">Username</th>
                  <th className="py-2 px-3">Label</th>
                  <th className="py-2 px-3">Age (days)</th>
                  <th className="py-2 px-3">Tweets</th>
                  <th className="py-2 px-3">Followers</th>
                  <th className="py-2 px-3">Following</th>
                  <th className="py-2 px-3">Ratio</th>
                  <th className="py-2 px-3">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {classification.classified.map((f) => (
                  <tr key={f.followerId} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-2 px-3 font-mono text-xs">
                      @{f.username || f.followerId.slice(0, 12)}
                    </td>
                    <td className="py-2 px-3">
                      <LabelBadge label={f.label} />
                    </td>
                    <td className="py-2 px-3">{f.features?.account_age_days}</td>
                    <td className="py-2 px-3">{f.features?.tweets_total}</td>
                    <td className="py-2 px-3">{f.features?.followers_count}</td>
                    <td className="py-2 px-3">{f.features?.following_count}</td>
                    <td className="py-2 px-3">
                      {f.features?.follow_ratio?.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-400 max-w-xs truncate">
                      {f.reasons?.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Anomaly Details */}
      {aqe?.anomaly?.notes?.length > 0 && (
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-2">Anomaly Detection Notes</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            {aqe.anomaly.notes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
