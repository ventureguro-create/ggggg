/**
 * Telegram Leaderboard Table
 * Card-based watchlist style with sparkline
 */
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function TierBadge({ tier }) {
  const colors = {
    S: 'bg-violet-100 text-violet-700 border-violet-200',
    A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    B: 'bg-blue-100 text-blue-700 border-blue-200',
    C: 'bg-amber-100 text-amber-700 border-amber-200',
    D: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${colors[tier] || colors.D}`}>
      {tier}
    </span>
  );
}

function ScoreCell({ value, color = 'text-gray-900' }) {
  const num = Number(value ?? 0);
  return (
    <span className={`font-medium ${color}`}>
      {num.toFixed(1)}
    </span>
  );
}

function FraudCell({ value }) {
  const num = Number(value ?? 0);
  const color = num > 0.5 ? 'text-red-600' : num > 0.25 ? 'text-amber-600' : 'text-gray-500';
  return <span className={`text-sm ${color}`}>{num.toFixed(2)}</span>;
}

function TrendCell({ delta }) {
  if (delta == null) return <Minus className="w-4 h-4 text-gray-300" />;
  const num = Number(delta);
  if (Math.abs(num) < 1) return <Minus className="w-4 h-4 text-gray-400" />;
  if (num > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  return <TrendingDown className="w-4 h-4 text-red-500" />;
}

export default function LeaderboardTable({ items = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        No channels found. Run the scoring pipeline first.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="leaderboard-table">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Channel</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Intel</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Alpha</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Cred</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">NetAlpha</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Fraud</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Tier</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Trend</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr 
              key={row.username || i} 
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/telegram/${row.username}`}
                  className="font-medium text-blue-600 hover:text-blue-800"
                  data-testid={`channel-link-${row.username}`}
                >
                  @{row.username}
                </Link>
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell value={row.intelScore} color="text-blue-600" />
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell value={row.components?.alphaScore} color="text-emerald-600" />
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell value={row.components?.credibilityScore} color="text-amber-600" />
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell value={row.components?.networkAlphaScore} color="text-violet-600" />
              </td>
              <td className="px-4 py-3 text-center">
                <FraudCell value={row.components?.fraudRisk} />
              </td>
              <td className="px-4 py-3 text-center">
                <TierBadge tier={row.tier} />
              </td>
              <td className="px-4 py-3 text-center">
                <TrendCell delta={row.explain?.delta7d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
