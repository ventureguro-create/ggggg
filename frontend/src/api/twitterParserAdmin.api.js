/**
 * Twitter Parser Admin API
 * API client for managing Twitter accounts and egress slots
 */

import { api } from './client';

const BASE_URL = '/api/admin/twitter-parser';

// ==================== ACCOUNTS ====================

export async function getTwitterAccounts(status) {
  const params = status ? `?status=${status}` : '';
  const response = await api.get(`${BASE_URL}/accounts${params}`);
  return response.data;
}

export async function getTwitterAccount(id) {
  const response = await api.get(`${BASE_URL}/accounts/${id}`);
  return response.data;
}

export async function createTwitterAccount(data) {
  const response = await api.post(`${BASE_URL}/accounts`, data);
  return response.data;
}

export async function updateTwitterAccount(id, data) {
  // Use PUT for MULTI architecture
  const response = await api.put(`${BASE_URL}/accounts/${id}`, data);
  return response.data;
}

export async function setAccountStatus(id, status) {
  const response = await api.patch(`${BASE_URL}/accounts/${id}/status`, { status });
  return response.data;
}

export async function enableTwitterAccount(id) {
  return setAccountStatus(id, 'ACTIVE');
}

export async function disableTwitterAccount(id) {
  return setAccountStatus(id, 'DISABLED');
}

export async function deleteTwitterAccount(id) {
  const response = await api.delete(`${BASE_URL}/accounts/${id}`);
  return response.data;
}

// ==================== EGRESS SLOTS ====================

// V4 Egress Slots API - uses twitter_egress_slots collection
const EGRESS_BASE = '/api/admin/twitter-egress';

export async function getEgressSlots(filter) {
  const params = new URLSearchParams();
  if (filter?.enabled !== undefined) params.set('enabled', filter.enabled);
  if (filter?.type) params.set('type', filter.type);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`${EGRESS_BASE}/slots${query}`);
  return response.data;
}

export async function getEgressSlot(id) {
  const response = await api.get(`${EGRESS_BASE}/slots/${id}`);
  return response.data;
}

export async function createEgressSlot(data) {
  const response = await api.post(`${EGRESS_BASE}/slots`, data);
  return response.data;
}

export async function updateEgressSlot(id, data) {
  // Use PATCH for V4 Egress Slots
  const response = await api.patch(`${EGRESS_BASE}/slots/${id}`, data);
  return response.data;
}

export async function setSlotStatus(id, status) {
  // V4 uses enable/disable endpoints
  if (status === 'ACTIVE') {
    const response = await api.post(`${EGRESS_BASE}/slots/${id}/enable`);
    return response.data;
  } else {
    const response = await api.post(`${EGRESS_BASE}/slots/${id}/disable`);
    return response.data;
  }
}

export async function enableEgressSlot(id) {
  const response = await api.post(`${EGRESS_BASE}/slots/${id}/enable`);
  return response.data;
}

export async function disableEgressSlot(id) {
  const response = await api.post(`${EGRESS_BASE}/slots/${id}/disable`);
  return response.data;
}

export async function bindSlotAccount(slotId, accountId) {
  const response = await api.post(`${EGRESS_BASE}/slots/${slotId}/bind-account`, { accountId });
  return response.data;
}

export async function unbindSlotAccount(slotId) {
  const response = await api.post(`${EGRESS_BASE}/slots/${slotId}/unbind-account`);
  return response.data;
}

export async function deleteEgressSlot(id) {
  const response = await api.delete(`${EGRESS_BASE}/slots/${id}`);
  return response.data;
}

export async function resetSlotWindow(id) {
  const response = await api.post(`${EGRESS_BASE}/slots/${id}/reset-window`);
  return response.data;
}

export async function testSlotConnectivity(id) {
  // Use runtime health check for connectivity test
  const response = await api.post(`/api/v4/twitter/runtime/health-check/${id}`);
  return response.data;
}

export async function getAvailableSlots() {
  // Get slots that are enabled and healthy
  const result = await getEgressSlots({ enabled: true });
  return result;
}

export async function recoverCooldowns() {
  // Use monitor endpoint to get stats (cooldowns are automatic in V4)
  const response = await api.get(`${EGRESS_BASE}/monitor`);
  return response.data;
}

// ==================== SESSIONS (MULTI Architecture) ====================

export async function getSessions() {
  const response = await api.get(`${BASE_URL}/sessions`);
  return response.data;
}

export async function getSession(sessionId) {
  const response = await api.get(`${BASE_URL}/sessions/${sessionId}`);
  return response.data;
}

export async function getWebhookInfo() {
  const response = await api.get(`${BASE_URL}/sessions/webhook/info`);
  return response.data;
}

export async function regenerateApiKey() {
  const response = await api.post(`${BASE_URL}/sessions/webhook/regenerate`);
  return response.data;
}

export async function ingestSession(data) {
  const response = await api.post(`${BASE_URL}/sessions/webhook`, data);
  return response.data;
}

export async function testSession(sessionId) {
  const response = await api.post(`${BASE_URL}/sessions/${sessionId}/test`);
  return response.data;
}

export async function bindSessionToAccount(sessionId, accountId) {
  const response = await api.post(`${BASE_URL}/sessions/${sessionId}/bind`, { accountId });
  return response.data;
}

export async function setSessionStatus(sessionId, status) {
  const response = await api.patch(`${BASE_URL}/sessions/${sessionId}/status`, { status });
  return response.data;
}

export async function deleteSession(sessionId) {
  const response = await api.delete(`${BASE_URL}/sessions/${sessionId}`);
  return response.data;
}

// ==================== MONITOR ====================

export async function getParserMonitor() {
  const response = await api.get(`${BASE_URL}/monitor`);
  return response.data;
}

// ==================== RUNTIME HEALTH CHECK ====================

export async function testSlotConnection(slotId) {
  const response = await api.post(`/api/v4/twitter/runtime/health-check/${slotId}`);
  return response.data;
}

// ==================== P3 FREEZE VALIDATION ====================

export async function runFreezeValidation(profile = 'SMOKE') {
  const response = await api.post(`${BASE_URL}/freeze/run`, { profile });
  return response.data;
}

export async function getFreezeStatus() {
  const response = await api.get(`${BASE_URL}/freeze/status`);
  return response.data;
}

export async function getFreezeLast() {
  const response = await api.get(`${BASE_URL}/freeze/latest`);
  return response.data;
}

export async function abortFreezeValidation() {
  const response = await api.post(`${BASE_URL}/freeze/abort`);
  return response.data;
}

export async function getMetricsSnapshot() {
  const response = await api.get(`${BASE_URL}/metrics/snapshot`);
  return response.data;
}

export async function resetMetrics() {
  const response = await api.post(`${BASE_URL}/metrics/reset`);
  return response.data;
}
