/**
 * Graph State Service
 * P2.2: Share / Persist Graph State
 * 
 * Handles:
 * - Encode state → base64 URL-safe string
 * - Decode state → validate & return
 * - Version control for backward compatibility
 */

export interface GraphStateV1 {
  version: '1.0';
  
  // UI Filters
  filters?: {
    profiles?: string[];
    early_signal?: string[];
    risk_level?: string[];
    edge_strength?: string[];
    hide_isolated?: boolean;
    limit_nodes?: number;
  };
  
  // Selection
  selected_nodes?: string[];  // account_id[]
  selectedNodes?: string[];   // alias for backward compat
  
  // Compare mode
  compare?: {
    left?: string;
    right?: string;
    nodeA?: string;  // alias
    nodeB?: string;  // alias
    active?: boolean;
  } | null;
  
  // View state
  view?: 'graph' | 'table' | 'compare';
  
  // Table sorting
  sort?: {
    field?: string;
    order?: 'asc' | 'desc';
  };
  table?: {
    sortBy?: string;
    order?: 'asc' | 'desc';
  };
  
  // Focus/Highlight
  focus?: string;       // account_id to focus on load
  highlight?: string;   // alias for focus
  
  // Phase 3.4.4: Path highlight context
  path_highlight?: {
    kind?: 'shortest' | 'strongest' | 'elite';
    target_id?: string;
    locked?: boolean;
  };
}

const CURRENT_VERSION = '1.0';

/**
 * Encode graph state to URL-safe base64
 */
export function encodeGraphState(state: Partial<GraphStateV1>): string {
  const fullState: GraphStateV1 = {
    version: CURRENT_VERSION,
    ...state,
  };
  
  // Remove undefined/null values
  const cleaned = JSON.parse(JSON.stringify(fullState));
  
  // Convert to JSON, then base64
  const json = JSON.stringify(cleaned);
  const base64 = Buffer.from(json, 'utf-8').toString('base64');
  
  // Make URL-safe (replace + with -, / with _, remove =)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode URL-safe base64 to graph state
 */
export function decodeGraphState(encoded: string): GraphStateV1 | null {
  try {
    // Restore base64 padding and chars
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const state = JSON.parse(json) as GraphStateV1;
    
    // Validate version
    if (!state.version) {
      console.warn('[GraphState] Missing version, assuming v1.0');
      state.version = '1.0';
    }
    
    // Version check
    if (state.version !== CURRENT_VERSION) {
      console.warn(`[GraphState] Version mismatch: ${state.version} vs ${CURRENT_VERSION}`);
      // Could add migration logic here for future versions
    }
    
    return state;
  } catch (err) {
    console.error('[GraphState] Decode error:', err);
    return null;
  }
}

/**
 * Validate graph state structure
 */
export function validateGraphState(state: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!state || typeof state !== 'object') {
    return { valid: false, errors: ['State must be an object'] };
  }
  
  // Version check
  if (state.version && state.version !== CURRENT_VERSION) {
    errors.push(`Unknown version: ${state.version}`);
  }
  
  // Filters validation
  if (state.filters) {
    if (state.filters.profiles && !Array.isArray(state.filters.profiles)) {
      errors.push('filters.profiles must be an array');
    }
    if (state.filters.limit_nodes && (typeof state.filters.limit_nodes !== 'number' || state.filters.limit_nodes < 1)) {
      errors.push('filters.limit_nodes must be a positive number');
    }
  }
  
  // Selected nodes validation (support both field names)
  const selectedNodes = state.selectedNodes || state.selected_nodes;
  if (selectedNodes && !Array.isArray(selectedNodes)) {
    errors.push('selectedNodes/selected_nodes must be an array');
  }
  
  // Compare validation
  if (state.compare && typeof state.compare === 'object') {
    const left = state.compare.left || state.compare.nodeA;
    const right = state.compare.right || state.compare.nodeB;
    if (left && typeof left !== 'string') {
      errors.push('compare.left must be a string');
    }
    if (right && typeof right !== 'string') {
      errors.push('compare.right must be a string');
    }
  }
  
  // View validation
  if (state.view && !['graph', 'table', 'compare'].includes(state.view)) {
    errors.push('view must be "graph", "table", or "compare"');
  }
  
  // Sort validation
  if (state.sort && typeof state.sort === 'object') {
    if (state.sort.order && !['asc', 'desc'].includes(state.sort.order)) {
      errors.push('sort.order must be "asc" or "desc"');
    }
  }
  
  // Focus validation
  const focus = state.focus || state.highlight;
  if (focus && typeof focus !== 'string') {
    errors.push('focus/highlight must be a string');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Normalize state - convert aliases to canonical form
 */
export function normalizeGraphState(state: Partial<GraphStateV1>): GraphStateV1 {
  const normalized: GraphStateV1 = {
    version: CURRENT_VERSION,
  };
  
  // Filters
  if (state.filters) {
    normalized.filters = { ...state.filters };
  }
  
  // Selected nodes (normalize to selected_nodes)
  const selectedNodes = state.selected_nodes || state.selectedNodes;
  if (selectedNodes?.length) {
    normalized.selected_nodes = selectedNodes;
  }
  
  // Compare (normalize to left/right)
  if (state.compare) {
    normalized.compare = {
      left: state.compare.left || state.compare.nodeA,
      right: state.compare.right || state.compare.nodeB,
      active: state.compare.active,
    };
  }
  
  // View
  if (state.view) {
    normalized.view = state.view;
  }
  
  // Sort (normalize to sort)
  if (state.sort) {
    normalized.sort = state.sort;
  } else if (state.table) {
    normalized.sort = {
      field: state.table.sortBy,
      order: state.table.order,
    };
  }
  
  // Focus (normalize to focus)
  const focus = state.focus || state.highlight;
  if (focus) {
    normalized.focus = focus;
  }
  
  // Phase 3.4.4: Path highlight
  if (state.path_highlight) {
    normalized.path_highlight = { ...state.path_highlight };
  }
  
  return normalized;
}

/**
 * Create shareable URL for graph state
 */
export function createShareUrl(baseUrl: string, state: Partial<GraphStateV1>): string {
  const encoded = encodeGraphState(state);
  return `${baseUrl}?state=${encoded}`;
}
