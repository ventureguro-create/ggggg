/**
 * Port Access Helper
 * 
 * Provides safe access to module ports from any file within connections module.
 * Uses module state to get port instances.
 */

import type { 
  ITwitterLivePort, 
  IAlertPort, 
  INotificationPort,
  ITaxonomyPort,
  IConfidencePort,
  IConnectionsPorts 
} from './index.js';
import { 
  nullTwitterLivePort,
  nullAlertPort,
  nullNotificationPort,
  nullTaxonomyPort,
  nullConfidencePort
} from './index.js';

// Module state reference (set during registration)
let modulePortsRef: IConnectionsPorts | null = null;

/**
 * Initialize ports reference (called from module.ts)
 */
export function setPortsRef(ports: IConnectionsPorts): void {
  modulePortsRef = ports;
}

/**
 * Clear ports reference (called on unregister)
 */
export function clearPortsRef(): void {
  modulePortsRef = null;
}

/**
 * Get Twitter Live port
 */
export function getTwitterLivePort(): ITwitterLivePort {
  return modulePortsRef?.twitterLive || nullTwitterLivePort;
}

/**
 * Get Alert port
 */
export function getAlertPort(): IAlertPort {
  return modulePortsRef?.alert || nullAlertPort;
}

/**
 * Get Notification port
 */
export function getNotificationPort(): INotificationPort {
  return modulePortsRef?.notification || nullNotificationPort;
}

/**
 * Get Taxonomy port
 */
export function getTaxonomyPort(): ITaxonomyPort {
  return modulePortsRef?.taxonomy || nullTaxonomyPort;
}

/**
 * Get Confidence port
 */
export function getConfidencePort(): IConfidencePort {
  return modulePortsRef?.confidence || nullConfidencePort;
}

/**
 * Check if ports are initialized
 */
export function arePortsInitialized(): boolean {
  return modulePortsRef !== null;
}

// ============================================
// LEGACY COMPATIBILITY LAYER
// Allows gradual migration from direct imports
// ============================================

/**
 * Check data availability (replacement for twitter-live import)
 */
export async function checkDataAvailability(): Promise<{
  available: boolean;
  lastUpdate: Date | null;
  status: 'READY' | 'STALE' | 'UNAVAILABLE';
}> {
  return getTwitterLivePort().checkDataAvailability();
}

/**
 * Get quick diff summary (replacement for twitter-live import)
 */
export async function getQuickDiffSummary(): Promise<{
  newTweets: number;
  newAccounts: number;
  period: string;
}> {
  return getTwitterLivePort().getQuickDiffSummary();
}

/**
 * Send alert (replacement for alerts import)
 */
export async function emitAlertCandidate(candidate: {
  actorId?: string;
  symbol?: string;
  type: string;
  score: number;
  data: any;
}): Promise<void> {
  return getAlertPort().emitAlertCandidate(candidate);
}

/**
 * Send telegram message (replacement for notifications import)
 */
export async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  const port = modulePortsRef?.telegram;
  if (port) {
    return port.sendMessage(chatId, message);
  }
  console.warn('[Connections] Telegram port not available');
  return false;
}
