/**
 * Backer Influence Types - E5 Phase
 * 
 * Types for Backer Influence Network visualization.
 * READ-ONLY aggregation, no new formulas (FREEZE v2 compliant).
 */

// ============================================================
// INFLUENCE GRAPH
// ============================================================

export type InfluenceNodeType = 'BACKER' | 'PROJECT' | 'ACCOUNT';

export type InfluenceEdgeType = 
  | 'INVESTS_IN'    // Backer → Project
  | 'CO_INVESTS'    // Backer ↔ Backer
  | 'ADVOCATES';    // Account → Project

export interface InfluenceNode {
  id: string;
  type: InfluenceNodeType;
  name: string;
  slug?: string;
  authority?: number;
  
  // Visual hints
  size?: 'lg' | 'md' | 'sm';
  isCenter?: boolean;
}

export interface InfluenceEdge {
  source: string;
  target: string;
  type: InfluenceEdgeType;
  weight: number;  // From existing Network v2 / Co-Investment data
  label?: string;
}

export interface BackerInfluenceGraph {
  backer: {
    id: string;
    slug: string;
    name: string;
    seedAuthority: number;
  };
  nodes: InfluenceNode[];
  edges: InfluenceEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    projectCount: number;
    coInvestorCount: number;
    accountCount: number;
  };
}

// ============================================================
// INFLUENCE SUMMARY
// ============================================================

export interface BackerInfluenceSummary {
  backerId: string;
  backerName: string;
  
  // Counts (aggregated from existing data)
  anchorProjectCount: number;
  earlyProjectCount: number;
  coInvestorCount: number;
  keyAccountCount: number;
  networkReach: number;
  
  // Lists for UI
  anchorProjects: Array<{ id: string; name: string; slug: string }>;
  strongCoInvestors: Array<{ id: string; name: string; slug: string }>;
  topAccounts: Array<{ id: string; handle: string; role: string }>;
  
  // Segments this backer influences
  segments: string[];
}

// ============================================================
// PROJECT IMPACT TABLE
// ============================================================

export type BackerRole = 'ANCHOR' | 'LEAD' | 'CO_INVEST' | 'FOLLOW_ON' | 'UNKNOWN';

export interface ProjectImpactRow {
  projectId: string;
  projectName: string;
  projectSlug: string;
  
  stage: string;
  authority: number;
  
  role: BackerRole;
  why: string;  // Short explanation from existing data
  
  categories: string[];
  isAnchor: boolean;
}

export interface BackerProjectImpact {
  backerId: string;
  backerName: string;
  
  projects: ProjectImpactRow[];
  totalProjects: number;
  anchorCount: number;
}

// ============================================================
// API FILTERS
// ============================================================

export interface InfluenceGraphFilters {
  depth?: 1 | 2;
  includeProjects?: boolean;
  includeAccounts?: boolean;
  includeCoInvestors?: boolean;
}

console.log('[BackerInfluence] Types loaded (E5 Phase)');
