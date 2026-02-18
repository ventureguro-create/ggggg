/**
 * Telegram Intel API
 * Frontend API client for Telegram Intelligence module
 */
import { api } from './client';

const API_BASE = '/api/admin/telegram-intel';

// Health check
export async function getTelegramIntelHealth() {
  const response = await api.get(`${API_BASE}/health`);
  return response.data;
}

// Ingestion
export async function ingestChannel(username) {
  const response = await api.post(`${API_BASE}/ingestion/channel`, { username });
  return response.data;
}

export async function runIngestionBatch(limit = 10) {
  const response = await api.post(`${API_BASE}/ingestion/run`, { limit });
  return response.data;
}

// Channel State
export async function getChannelState(username) {
  const response = await api.get(`${API_BASE}/state/${username}`);
  return response.data;
}

// Metrics
export async function getChannelMetrics(username) {
  const response = await api.get(`${API_BASE}/metrics/${username}`);
  return response.data;
}

// Fraud
export async function getChannelFraud(username) {
  const response = await api.get(`${API_BASE}/fraud/${username}`);
  return response.data;
}

// Pipeline
export async function runPipelineChannel(username) {
  const response = await api.post(`${API_BASE}/pipeline/channel`, { username });
  return response.data;
}

export async function runPipelineFull() {
  const response = await api.post(`${API_BASE}/pipeline/run`);
  return response.data;
}

// Alpha Engine
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
