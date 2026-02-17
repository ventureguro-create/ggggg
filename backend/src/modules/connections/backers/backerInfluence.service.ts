/**
 * Backer Influence Service - E5 Phase
 * 
 * READ-ONLY aggregation of existing data.
 * NO new formulas, NO new weights (FREEZE v2 compliant).
 */

import * as BackerStore from './backer.store.js';
import * as ProjectStore from '../projects/project.store.js';
import type {
  BackerInfluenceGraph,
  BackerInfluenceSummary,
  BackerProjectImpact,
  InfluenceNode,
  InfluenceEdge,
  ProjectImpactRow,
  InfluenceGraphFilters,
  BackerRole,
} from './backerInfluence.types.js';

// ============================================================
// E5.1 — INFLUENCE GRAPH
// ============================================================

export async function getBackerInfluenceGraph(
  backerId: string,
  filters: InfluenceGraphFilters = {}
): Promise<BackerInfluenceGraph | null> {
  const backer = await BackerStore.getBackerById(backerId);
  if (!backer) return null;
  
  const {
    includeProjects = true,
    includeAccounts = true,
    includeCoInvestors = true,
  } = filters;
  
  const nodes: InfluenceNode[] = [];
  const edges: InfluenceEdge[] = [];
  
  // Center node: Backer
  nodes.push({
    id: backer.id,
    type: 'BACKER',
    name: backer.name,
    slug: backer.slug,
    authority: backer.seedAuthority,
    size: 'lg',
    isCenter: true,
  });
  
  // Get projects where this backer invested
  const projectLinks = await getBackerProjects(backerId);
  const coInvestorSet = new Set<string>();
  
  if (includeProjects) {
    for (const link of projectLinks) {
      // Project node
      nodes.push({
        id: link.projectId,
        type: 'PROJECT',
        name: link.projectName,
        slug: link.projectSlug,
        authority: link.authority,
        size: 'md',
      });
      
      // Backer → Project edge
      edges.push({
        source: backer.id,
        target: link.projectId,
        type: 'INVESTS_IN',
        weight: link.isAnchor ? 1.0 : 0.7,
        label: link.isAnchor ? 'Anchor' : 'Investor',
      });
      
      // Collect co-investors
      if (includeCoInvestors && link.coInvestors) {
        for (const ci of link.coInvestors) {
          if (ci.id !== backerId) {
            coInvestorSet.add(ci.id);
          }
        }
      }
      
      // Add accounts if enabled
      if (includeAccounts && link.accounts) {
        for (const acc of link.accounts) {
          // Check if node already exists
          if (!nodes.find(n => n.id === acc.actorId)) {
            nodes.push({
              id: acc.actorId,
              type: 'ACCOUNT',
              name: acc.twitterHandle || acc.actorId,
              authority: acc.authority,
              size: 'sm',
            });
          }
          
          // Account → Project edge
          edges.push({
            source: acc.actorId,
            target: link.projectId,
            type: 'ADVOCATES',
            weight: acc.trustMultiplier || 0.5,
          });
        }
      }
    }
  }
  
  // Add co-investors as nodes with CO_INVESTS edges
  if (includeCoInvestors) {
    for (const coInvestorId of coInvestorSet) {
      const coInvestor = await BackerStore.getBackerById(coInvestorId);
      if (coInvestor) {
        nodes.push({
          id: coInvestor.id,
          type: 'BACKER',
          name: coInvestor.name,
          slug: coInvestor.slug,
          authority: coInvestor.seedAuthority,
          size: 'md',
        });
        
        edges.push({
          source: backer.id,
          target: coInvestor.id,
          type: 'CO_INVESTS',
          weight: 0.6,
        });
      }
    }
  }
  
  // Stats
  const projectCount = nodes.filter(n => n.type === 'PROJECT').length;
  const coInvestorCount = nodes.filter(n => n.type === 'BACKER' && !n.isCenter).length;
  const accountCount = nodes.filter(n => n.type === 'ACCOUNT').length;
  
  return {
    backer: {
      id: backer.id,
      slug: backer.slug,
      name: backer.name,
      seedAuthority: backer.seedAuthority,
    },
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      projectCount,
      coInvestorCount,
      accountCount,
    },
  };
}

// ============================================================
// E5.2 — INFLUENCE SUMMARY
// ============================================================

export async function getBackerInfluenceSummary(
  backerId: string
): Promise<BackerInfluenceSummary | null> {
  const backer = await BackerStore.getBackerById(backerId);
  if (!backer) return null;
  
  const projectLinks = await getBackerProjects(backerId);
  
  // Anchor projects (where backer is anchor)
  const anchorProjects = projectLinks
    .filter(p => p.isAnchor)
    .map(p => ({ id: p.projectId, name: p.projectName, slug: p.projectSlug }));
  
  // Early projects (EARLY stage)
  const earlyProjects = projectLinks
    .filter(p => p.stage === 'EARLY');
  
  // Co-investors (deduplicated)
  const coInvestorMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const p of projectLinks) {
    if (p.coInvestors) {
      for (const ci of p.coInvestors) {
        if (ci.id !== backerId) {
          coInvestorMap.set(ci.id, ci);
        }
      }
    }
  }
  const strongCoInvestors = Array.from(coInvestorMap.values()).slice(0, 5);
  
  // Key accounts (from all projects)
  const accountMap = new Map<string, { id: string; handle: string; role: string }>();
  for (const p of projectLinks) {
    if (p.accounts) {
      for (const acc of p.accounts) {
        if (!accountMap.has(acc.actorId)) {
          accountMap.set(acc.actorId, {
            id: acc.actorId,
            handle: acc.twitterHandle || acc.actorId,
            role: acc.role || 'UNKNOWN',
          });
        }
      }
    }
  }
  const topAccounts = Array.from(accountMap.values()).slice(0, 5);
  
  // Segments (from project categories)
  const segmentSet = new Set<string>();
  for (const p of projectLinks) {
    if (p.categories) {
      for (const cat of p.categories) {
        segmentSet.add(cat);
      }
    }
  }
  
  // Network reach = projects + co-investors + accounts
  const networkReach = projectLinks.length + coInvestorMap.size + accountMap.size;
  
  return {
    backerId: backer.id,
    backerName: backer.name,
    anchorProjectCount: anchorProjects.length,
    earlyProjectCount: earlyProjects.length,
    coInvestorCount: coInvestorMap.size,
    keyAccountCount: accountMap.size,
    networkReach,
    anchorProjects,
    strongCoInvestors,
    topAccounts,
    segments: Array.from(segmentSet),
  };
}

// ============================================================
// E5.3 — PROJECT IMPACT TABLE
// ============================================================

export async function getBackerProjectImpact(
  backerId: string
): Promise<BackerProjectImpact | null> {
  const backer = await BackerStore.getBackerById(backerId);
  if (!backer) return null;
  
  const projectLinks = await getBackerProjects(backerId);
  
  const projects: ProjectImpactRow[] = projectLinks.map(p => ({
    projectId: p.projectId,
    projectName: p.projectName,
    projectSlug: p.projectSlug,
    stage: p.stage || 'UNKNOWN',
    authority: p.authority || 0,
    role: determineRole(p),
    why: generateWhy(p),
    categories: p.categories || [],
    isAnchor: p.isAnchor || false,
  }));
  
  // Sort by authority descending
  projects.sort((a, b) => b.authority - a.authority);
  
  return {
    backerId: backer.id,
    backerName: backer.name,
    projects,
    totalProjects: projects.length,
    anchorCount: projects.filter(p => p.isAnchor).length,
  };
}

// ============================================================
// HELPER: Get backer's projects with full data
// ============================================================

interface BackerProjectLink {
  projectId: string;
  projectName: string;
  projectSlug: string;
  stage?: string;
  authority?: number;
  categories?: string[];
  isAnchor?: boolean;
  anchorReason?: string;
  rounds?: string[];
  coInvestors?: Array<{ id: string; name: string; slug: string }>;
  accounts?: Array<{ actorId: string; twitterHandle?: string; role?: string; authority?: number; trustMultiplier?: number }>;
}

async function getBackerProjects(backerId: string): Promise<BackerProjectLink[]> {
  const results: BackerProjectLink[] = [];
  
  try {
    // Get backer info to find by slug
    const backer = await BackerStore.getBackerById(backerId);
    if (!backer) return results;
    
    // Import dynamically to avoid circular dependency
    const { default: mongoose } = await import('mongoose');
    const db = mongoose.connection.db;
    
    if (!db) return results;
    
    // Search by multiple possible backerId formats
    const possibleBackerIds = [
      backerId,
      `backer_${backer.slug}`,
      backer.slug,
    ];
    
    // Get all project-backer links for this backer
    const links = await db.collection('connections_project_backers')
      .find({ backerId: { $in: possibleBackerIds } })
      .toArray();
    
    console.log(`[BackerInfluence] Found ${links.length} project links for ${backer.slug}`);
    
    for (const link of links) {
      // Get project details - try both string and ObjectId
      let project = await db.collection('connections_projects')
        .findOne({ _id: link.projectId });
      
      if (!project && typeof link.projectId === 'string') {
        const { ObjectId } = await import('mongodb');
        try {
          project = await db.collection('connections_projects')
            .findOne({ _id: new ObjectId(link.projectId) });
        } catch (e) { /* ignore invalid ObjectId */ }
      }
      
      if (!project) {
        console.log(`[BackerInfluence] Project not found: ${link.projectId}`);
        continue;
      }
      
      // Get other backers (co-investors) for this project
      const otherBackerLinks = await db.collection('connections_project_backers')
        .find({ 
          projectId: link.projectId.toString ? link.projectId.toString() : link.projectId, 
          backerId: { $nin: possibleBackerIds } 
        })
        .limit(5)
        .toArray();
      
      const coInvestors = [];
      for (const obl of otherBackerLinks) {
        // Try to get backer info
        const otherBacker = await BackerStore.getBackerBySlug(obl.backerId?.replace('backer_', ''));
        if (otherBacker) {
          coInvestors.push({
            id: otherBacker.id,
            name: otherBacker.name,
            slug: otherBacker.slug,
          });
        } else if (obl.backerName) {
          coInvestors.push({
            id: obl.backerId,
            name: obl.backerName,
            slug: obl.backerId?.replace('backer_', ''),
          });
        }
      }
      
      // Get accounts for this project
      const accountLinks = await db.collection('connections_project_accounts')
        .find({ projectId: link.projectId.toString ? link.projectId.toString() : link.projectId })
        .limit(5)
        .toArray();
      
      results.push({
        projectId: project._id.toString(),
        projectName: project.name,
        projectSlug: project.slug,
        stage: project.stage,
        authority: project.authorityScore,
        categories: project.categories,
        isAnchor: link.isAnchor,
        anchorReason: link.anchorReason,
        rounds: link.rounds,
        coInvestors,
        accounts: accountLinks.map(al => ({
          actorId: al.actorId,
          twitterHandle: al.twitterHandle,
          role: al.role,
          authority: al.authority || 50,
          trustMultiplier: al.trustMultiplier || 1.0,
        })),
      });
    }
  } catch (err) {
    console.error('[BackerInfluence] Error getting projects:', err);
  }
  
  return results;
}

// ============================================================
// HELPER: Determine backer role in project
// ============================================================

function determineRole(link: BackerProjectLink): BackerRole {
  if (link.isAnchor && link.anchorReason === 'LEAD') return 'LEAD';
  if (link.isAnchor) return 'ANCHOR';
  if (link.rounds?.includes('SEED') || link.rounds?.includes('PRIVATE')) return 'CO_INVEST';
  if (link.rounds?.length) return 'FOLLOW_ON';
  return 'UNKNOWN';
}

// ============================================================
// HELPER: Generate "why" explanation
// ============================================================

function generateWhy(link: BackerProjectLink): string {
  if (link.isAnchor && link.anchorReason === 'LEAD') {
    return 'Lead investor';
  }
  if (link.isAnchor && link.anchorReason === 'SEED') {
    return 'Seed round lead';
  }
  if (link.isAnchor) {
    return 'Anchor backer';
  }
  if (link.rounds?.includes('SEED')) {
    return 'Seed round';
  }
  if (link.rounds?.includes('SERIES_A')) {
    return 'Series A';
  }
  if (link.rounds?.length) {
    return `Invested in ${link.rounds[0]}`;
  }
  if (link.coInvestors?.length) {
    return `Co-invested with ${link.coInvestors[0].name}`;
  }
  return 'Portfolio company';
}

console.log('[BackerInfluence] Service loaded (E5 Phase)');
