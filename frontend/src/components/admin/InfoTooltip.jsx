/**
 * Info Tooltip Component
 * 
 * Reusable tooltip for explaining admin controls
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function InfoTooltip({ text, className = '' }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className={`text-slate-400 hover:text-slate-600 ${className}`}>
            <HelpCircle className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-900 text-white border-slate-700">
          <p className="text-sm">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Predefined tooltips for admin sections
export const ADMIN_TOOLTIPS = {
  // System Health
  backend: 'Node.js API server status. Handles all API requests and business logic.',
  mlService: 'Python ML service status. Provides predictions and model inference.',
  priceService: 'Market data provider status. Fetches token prices from CoinGecko/Binance.',
  providerPool: 'Pool of market data providers. Multiple providers ensure redundancy.',
  
  // Runtime Config
  decisionMode: 'How the system makes trading decisions. RULES_ONLY = pure algorithmic, ADVISORY = ML suggests, INFLUENCE = ML adjusts confidence.',
  killSwitch: 'Emergency stop. When ACTIVATED, disables all automated trading immediately.',
  mlInfluence: 'How much ML can adjust confidence scores (0-100%). Higher = more ML impact.',
  driftThreshold: 'Maximum allowed deviation from expected model behavior. Triggers alerts when exceeded.',
  
  // Networks
  networkEnabled: 'Enable/disable data collection for this blockchain network.',
  networkPriority: 'Processing priority. Lower number = processed first.',
  networkLastSync: 'Last time data was synced from this network.',
  
  // Pipeline Timestamps
  lastFeatureBuild: 'Last time ML features were computed from raw data.',
  lastLabeling: 'Last time signals were labeled with price outcomes.',
  lastDatasetBuild: 'Last time training dataset was updated.',
  lastMLInference: 'Last time ML model made predictions.',
  
  // Settings - System
  featureFlags: 'Feature toggles. Enable/disable specific platform features.',
  
  // Settings - ML
  mlEnabled: 'Master switch for all ML functionality. OFF = pure rules-based system.',
  fallbackMode: 'What happens when ML fails. RULES = use algorithmic rules, CACHED = use last prediction, DISABLE = skip ML.',
  marketModel: 'ML model for predicting market direction (BUY/SELL/NEUTRAL).',
  actorModel: 'ML model for classifying wallet behavior (SMART/NOISY).',
  confidenceThreshold: 'Minimum confidence required for ML prediction to be used.',
  ensembleWeights: 'How much each signal source contributes to final decision. Must sum to 1.0.',
  
  // Settings - Market
  providers: 'External API sources for market data (prices, volumes, etc.).',
  cacheL1Ttl: 'How long to cache prices in memory (fast but uses RAM).',
  cacheL2Ttl: 'How long to cache prices on disk (slower but persistent).',
  defaultProvider: 'Primary provider used when multiple are available.',
  
  // Backtesting
  backtestAccuracy: 'Percentage of correct predictions. Higher is better.',
  confusionMatrix: 'Shows where model makes mistakes. Diagonal = correct, off-diagonal = errors.',
  precisionBuy: 'When model predicts BUY, how often is it correct?',
  precisionSell: 'When model predicts SELL, how often is it correct?',
  samples: 'Total number of predictions evaluated.',
  
  // Data Pipelines
  pipelineStatus: 'Current state of this processing stage.',
  pipelineLatency: 'Time taken to complete last run.',
  pipelineRows: 'Number of records processed.',
  
  // Telegram Notifications (Phase 2.3)
  telegramEnabled: 'Global toggle for Telegram alert delivery. When OFF — no alerts are sent.',
  telegramPreviewOnly: 'Preview mode. Alerts are logged but NOT sent to Telegram. Use for testing.',
  telegramChatId: 'Channel/group ID for admin alerts. Optional — main delivery goes to subscriber private chats.',
  telegramEarlyBreakout: 'Alerts about early influence growth. Signal that account shows growth the market hasn\'t noticed yet.',
  telegramStrongAcceleration: 'Alerts about sharp acceleration. Account dynamics are strengthening, possible breakout transition.',
  telegramTrendReversal: 'Alerts about trend changes. Account dynamics direction has changed.',
  telegramCooldown: 'Minimum interval between alerts of the same type for one account. Spam protection.',
  telegramTestMessage: 'Send a test message to all active subscribers to verify setup.',
  telegramDispatch: 'Force send accumulated alerts. Usually happens automatically.',
  telegramStats: 'Delivery statistics for the last 24 hours: sent, skipped, errors.',
  telegramHistory: 'History of sent alerts with details: type, account, time, status.',
  telegramSubscribers: 'Users receive alerts after /start in the bot. Mute: /connections off. All settings — on the platform.',
};

export default InfoTooltip;
