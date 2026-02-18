/**
 * Telegram Intelligence API - Extended
 * Full API client for Telegram Intelligence module
 */
import { api } from './client';

const API_BASE = '/api/admin/telegram-intel';
const API_PUBLIC = '/api/telegram-intel';

// Health check
export async function getTelegramIntelHealth() {
  const response = await api.get(`${API_BASE}/health`);
  return response.data;
}

// ==================== Intel Ranking ====================

export async function getIntelTop(params = {}) {
  const response = await api.get(`${API_PUBLIC}/intel/top`, { params });
  return response.data;
}

export async function getChannelIntel(username) {
  const response = await api.get(`${API_PUBLIC}/intel/${username}`);
  return response.data;
}

export async function computeChannelIntel(username) {
  const response = await api.post(`${API_BASE}/intel/compute/channel`, { username });
  return response.data;
}

export async function recomputeIntel(limit = 200) {
  const response = await api.post(`${API_BASE}/intel/recompute`, { limit });
  return response.data;
}

// ==================== Network Alpha ====================

export async function getNetworkAlphaTop(params = {}) {
  const response = await api.get(`${API_PUBLIC}/network-alpha/top`, { params });
  return response.data;
}

export async function getChannelNetworkAlpha(username) {
  const response = await api.get(`${API_PUBLIC}/network-alpha/channel/${username}`);
  return response.data;
}

export async function getTokenNetworkAlpha(token) {
  const response = await api.get(`${API_PUBLIC}/network-alpha/token/${token}`);
  return response.data;
}

export async function runNetworkAlpha(lookbackDays = 90) {
  const response = await api.post(`${API_BASE}/network-alpha/run`, { lookbackDays });
  return response.data;
}

// ==================== Temporal ====================

export async function getChannelTemporal(username, days = 90) {
  const response = await api.get(`${API_PUBLIC}/temporal/${username}`, { params: { days } });
  return response.data;
}

export async function getTopMovers(params = {}) {
  const response = await api.get(`${API_PUBLIC}/temporal/top-movers`, { params });
  return response.data;
}

export async function runTemporalSnapshot(limit = 500) {
  const response = await api.post(`${API_BASE}/temporal/snapshot/run`, { limit });
  return response.data;
}

// ==================== Explain ====================

export async function getChannelExplain(username) {
  const response = await api.get(`${API_PUBLIC}/intel/explain/${username}`);
  return response.data;
}

// ==================== Channel Token Mentions (Public) ====================

/**
 * Get channel token mentions with returns data
 * Used by Channel Detail Page - Token Mentions Table
 * @param {string} username - Channel username
 * @param {object} opts - Options { days, limit, evaluated }
 */
export async function getChannelTokenMentions(username, opts = {}) {
  const { days = 90, limit = 100, evaluated = false } = opts;
  const response = await api.get(`${API_PUBLIC}/channel/${username}/mentions`, {
    params: { days, limit, evaluated },
  });
  return response.data;
}

// ==================== Alpha v2 ====================

export async function getAlphaLeaderboard(limit = 20) {
  const response = await api.get(`${API_BASE}/alpha/v2/leaderboard`, { params: { limit } });
  return response.data;
}

export async function computeAlphaBatch(limit = 50, days = 90) {
  const response = await api.post(`${API_BASE}/alpha/v2/compute/batch`, { limit, days });
  return response.data;
}

// ==================== Credibility ====================

export async function getCredibilityLeaderboard(limit = 20) {
  const response = await api.get(`${API_BASE}/credibility/leaderboard`, { params: { limit } });
  return response.data;
}

export async function computeCredibilityBatch(limit = 50) {
  const response = await api.post(`${API_BASE}/credibility/batch`, { limit });
  return response.data;
}

// ==================== Governance ====================

export async function getActiveConfig() {
  const response = await api.get(`${API_BASE}/governance/config/active`);
  return response.data;
}

export async function setOverride(username, data) {
  const response = await api.post(`${API_BASE}/governance/override`, { username, ...data });
  return response.data;
}

// ==================== Legacy (keep for backwards compat) ====================

export async function ingestChannel(username) {
  const response = await api.post(`${API_BASE}/ingestion/channel`, { username });
  return response.data;
}

export async function runIngestionBatch(limit = 10) {
  const response = await api.post(`${API_BASE}/ingestion/run`, { limit });
  return response.data;
}

export async function getChannelState(username) {
  const response = await api.get(`${API_BASE}/state/${username}`);
  return response.data;
}

export async function getChannelMetrics(username) {
  const response = await api.get(`${API_BASE}/metrics/${username}`);
  return response.data;
}

export async function getChannelFraud(username) {
  const response = await api.get(`${API_BASE}/fraud/${username}`);
  return response.data;
}

export async function runPipelineChannel(username) {
  const response = await api.post(`${API_BASE}/pipeline/channel`, { username });
  return response.data;
}

export async function runPipelineFull() {
  const response = await api.post(`${API_BASE}/pipeline/run`);
  return response.data;
}

export async function scanChannelForTokens(username, days = 30, minConfidence = 0.35) {
  const response = await api.post(`${API_BASE}/alpha/scan/channel`, {
    username,
    days,
    minConfidence,
  });
  return response.data;
}

export async function getChannelMentions(username, days = 30, limit = 200) {
  const response = await api.get(`${API_BASE}/alpha/mentions/${username}`, {
    params: { days, limit },
  });
  return response.data;
}

export async function getAlphaStats(days = 30) {
  const response = await api.get(`${API_BASE}/alpha/stats`, {
    params: { days },
  });
  return response.data;
}

export async function scanBatchChannels(usernames, days = 30, minConfidence = 0.35) {
  const response = await api.post(`${API_BASE}/alpha/scan/batch`, {
    usernames,
    days,
    minConfidence,
  });
  return response.data;
}

export default {
  getTelegramIntelHealth,
  getIntelTop,
  getChannelIntel,
  computeChannelIntel,
  recomputeIntel,
  getNetworkAlphaTop,
  getChannelNetworkAlpha,
  getTokenNetworkAlpha,
  runNetworkAlpha,
  getChannelTemporal,
  getTopMovers,
  runTemporalSnapshot,
  getChannelExplain,
  getAlphaLeaderboard,
  computeAlphaBatch,
  getCredibilityLeaderboard,
  computeCredibilityBatch,
  getActiveConfig,
  setOverride,
  ingestChannel,
  runIngestionBatch,
  getChannelState,
  getChannelMetrics,
  getChannelFraud,
  runPipelineChannel,
  runPipelineFull,
  scanChannelForTokens,
  getChannelMentions,
  getAlphaStats,
  scanBatchChannels,
};
