/**
 * Market Snapshot Service
 * 
 * PHASE G2: Get market data for time windows
 * Uses existing exchange/onchain modules
 */

import { MarketSnapshot } from '../models/ips.types';
import { TIME_WINDOWS, WindowKey } from '../constants/ips.constants';

/**
 * Mock price data (replace with real exchange adapter)
 */
async function getPriceChange(asset: string, from: number, to: number): Promise<number> {
  // In production: use exchange adapter
  // For now: return mock based on time difference
  const timeDiff = to - from;
  const volatility = Math.random() * 0.1; // 0-10%
  const direction = Math.random() > 0.5 ? 1 : -1;
  return direction * volatility * (1 + timeDiff / (24 * 60 * 60 * 1000));
}

/**
 * Mock volume data
 */
async function getVolumeChange(asset: string, from: number, to: number): Promise<number> {
  // In production: use exchange adapter
  return 0.8 + Math.random() * 0.4; // 0.8-1.2x
}

/**
 * Mock volatility
 */
async function getVolatility(asset: string, from: number, to: number): Promise<number> {
  // In production: calculate from price series
  return Math.random() * 3; // 0-3 standard deviations
}

/**
 * Mock on-chain flow
 */
async function getOnchainFlow(asset: string, from: number, to: number): Promise<number> {
  // In production: use onchain adapter
  // Returns: positive = net inflow, negative = net outflow
  return (Math.random() - 0.5) * 2; // -1 to +1
}

/**
 * Get market snapshot for a time range
 */
export async function getMarketSnapshot(
  asset: string,
  from: number,
  to: number
): Promise<MarketSnapshot> {
  const [priceDelta, volumeDelta, volatility, onchainFlow] = await Promise.all([
    getPriceChange(asset, from, to),
    getVolumeChange(asset, from, to),
    getVolatility(asset, from, to),
    getOnchainFlow(asset, from, to)
  ]);
  
  return {
    priceDelta: Math.round(priceDelta * 10000) / 100, // Percentage with 2 decimals
    volumeDelta: Math.round(volumeDelta * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    onchainFlow: Math.round(onchainFlow * 100) / 100
  };
}

/**
 * Get snapshots for all time windows
 */
export async function getWindowSnapshots(
  asset: string,
  eventTimestamp: number
): Promise<Record<WindowKey, MarketSnapshot>> {
  const result: Partial<Record<WindowKey, MarketSnapshot>> = {};
  
  for (const window of TIME_WINDOWS) {
    const snapshot = await getMarketSnapshot(
      asset,
      eventTimestamp,
      eventTimestamp + window.ms
    );
    result[window.key] = snapshot;
  }
  
  return result as Record<WindowKey, MarketSnapshot>;
}

/**
 * Check if we have sufficient market data
 */
export function hasValidMarketData(snapshot: MarketSnapshot): boolean {
  return (
    typeof snapshot.priceDelta === 'number' &&
    typeof snapshot.volatility === 'number' &&
    !isNaN(snapshot.priceDelta) &&
    !isNaN(snapshot.volatility)
  );
}
