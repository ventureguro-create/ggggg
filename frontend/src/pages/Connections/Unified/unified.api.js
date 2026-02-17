/**
 * Unified API
 */

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export async function fetchUnified(preset, q = '', limit = 50) {
  const url = new URL(`${API_BASE}/api/connections/unified`);
  if (preset) url.searchParams.set('preset', preset);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load unified');
  return res.json();
}

export async function fetchTaxonomyGroups() {
  const res = await fetch(`${API_BASE}/api/connections/taxonomy/groups`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load groups');
  return res.json();
}

export async function fetchTaxonomyMemberships(accountId) {
  const res = await fetch(`${API_BASE}/api/connections/taxonomy/memberships?accountId=${encodeURIComponent(accountId)}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load memberships');
  return res.json();
}
