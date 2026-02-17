/**
 * Project Store - E2 Phase
 * 
 * CRUD operations for Projects as first-class entities.
 * Computes authority from backers + accounts + reality.
 */

import { ObjectId, Db, Collection } from 'mongodb';
import type {
  ProjectEntity,
  ProjectBacker,
  ProjectAccount,
  ProjectNetwork,
  RelatedProject,
  WhyItMatters,
  CreateProjectInput,
  UpdateProjectInput,
  LinkBackerInput,
  LinkAccountInput,
  ProjectListFilters,
  ProjectStage,
  NetworkNode,
  NetworkEdge,
} from './project.types.js';
import { PROJECT_AUTHORITY_WEIGHTS, ANCHOR_BOOST } from './project.types.js';

// Collections
const PROJECTS_COLLECTION = 'connections_projects';
const PROJECT_BACKERS_COLLECTION = 'connections_project_backers';
const PROJECT_ACCOUNTS_COLLECTION = 'connections_project_accounts';

let projectsCol: Collection | null = null;
let projectBackersCol: Collection | null = null;
let projectAccountsCol: Collection | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initProjectStore(db: Db): void {
  projectsCol = db.collection(PROJECTS_COLLECTION);
  projectBackersCol = db.collection(PROJECT_BACKERS_COLLECTION);
  projectAccountsCol = db.collection(PROJECT_ACCOUNTS_COLLECTION);
  
  // Create indexes
  projectsCol.createIndex({ slug: 1 }, { unique: true }).catch(() => {});
  projectsCol.createIndex({ status: 1, authorityScore: -1 }).catch(() => {});
  projectsCol.createIndex({ categories: 1 }).catch(() => {});
  projectsCol.createIndex({ '$**': 'text' }).catch(() => {});
  
  projectBackersCol.createIndex({ projectId: 1 }).catch(() => {});
  projectBackersCol.createIndex({ backerId: 1 }).catch(() => {});
  projectBackersCol.createIndex({ projectId: 1, backerId: 1 }, { unique: true }).catch(() => {});
  
  projectAccountsCol.createIndex({ projectId: 1 }).catch(() => {});
  projectAccountsCol.createIndex({ actorId: 1 }).catch(() => {});
  projectAccountsCol.createIndex({ projectId: 1, actorId: 1 }, { unique: true }).catch(() => {});
  
  console.log('[ProjectStore] Initialized (E2 Phase)');
}

function getProjectsCol(): Collection {
  if (!projectsCol) throw new Error('ProjectStore not initialized');
  return projectsCol;
}

function getBackersCol(): Collection {
  if (!projectBackersCol) throw new Error('ProjectStore not initialized');
  return projectBackersCol;
}

function getAccountsCol(): Collection {
  if (!projectAccountsCol) throw new Error('ProjectStore not initialized');
  return projectAccountsCol;
}

// ============================================================
// PROJECT CRUD
// ============================================================

export async function createProject(input: CreateProjectInput): Promise<ProjectEntity> {
  const col = getProjectsCol();
  
  const doc = {
    slug: input.slug.toLowerCase(),
    name: input.name,
    description: input.description,
    categories: input.categories,
    stage: input.stage,
    launchYear: input.launchYear,
    status: 'ACTIVE',
    authorityScore: 0,
    realityScore: null,
    confidence: 0,
    externalRefs: input.externalRefs,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const result = await col.insertOne(doc);
  
  console.log(`[ProjectStore] Created project: ${input.name} (${input.slug})`);
  
  return toProjectEntity({ ...doc, _id: result.insertedId });
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectEntity | null> {
  const col = getProjectsCol();
  
  const update = {
    ...input,
    updatedAt: new Date(),
  };
  
  const result = await col.findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
  
  return result ? toProjectEntity(result) : null;
}

export async function getProjectById(id: string): Promise<ProjectEntity | null> {
  const col = getProjectsCol();
  const doc = await col.findOne({ _id: toObjectId(id) });
  return doc ? toProjectEntity(doc) : null;
}

export async function getProjectBySlug(slug: string): Promise<ProjectEntity | null> {
  const col = getProjectsCol();
  const doc = await col.findOne({ slug: slug.toLowerCase() });
  return doc ? toProjectEntity(doc) : null;
}

export async function listProjects(filters: ProjectListFilters = {}): Promise<ProjectEntity[]> {
  const col = getProjectsCol();
  
  const query: any = { status: filters.status || 'ACTIVE' };
  
  if (filters.categories?.length) {
    query.categories = { $in: filters.categories };
  }
  if (filters.stage) {
    query.stage = filters.stage;
  }
  if (filters.minAuthority) {
    query.authorityScore = { $gte: filters.minAuthority };
  }
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  const docs = await col
    .find(query)
    .sort({ authorityScore: -1 })
    .limit(filters.limit || 50)
    .skip(filters.offset || 0)
    .toArray();
  
  return docs.map(toProjectEntity);
}

// ============================================================
// PROJECT BACKERS
// ============================================================

export async function linkBacker(input: LinkBackerInput & { backerName?: string; backerType?: string; seedAuthority?: number; coinvestWeight?: number }): Promise<void> {
  const col = getBackersCol();
  
  await col.updateOne(
    { projectId: input.projectId, backerId: input.backerId },
    {
      $set: {
        projectId: input.projectId,
        backerId: input.backerId,
        backerName: input.backerName,
        backerType: input.backerType,
        seedAuthority: input.seedAuthority,
        coinvestWeight: input.coinvestWeight,
        rounds: input.rounds || [],
        isAnchor: input.isAnchor || false,
        anchorReason: input.anchorReason,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  
  // Recompute project authority
  await recomputeProjectAuthority(input.projectId);
}

export async function unlinkBacker(projectId: string, backerId: string): Promise<void> {
  const col = getBackersCol();
  await col.deleteOne({ projectId, backerId });
  await recomputeProjectAuthority(projectId);
}

export async function getProjectBackers(projectId: string): Promise<ProjectBacker[]> {
  const col = getBackersCol();
  
  // Get linked backers
  const links = await col.find({ projectId }).toArray();
  
  if (links.length === 0) return [];
  
  // TODO: Join with backers collection to get full data
  // For now, return with placeholder data
  return links.map(link => ({
    backerId: link.backerId,
    backerName: link.backerName || 'Unknown',
    backerType: link.backerType || 'FUND',
    seedAuthority: link.seedAuthority || 50,
    coinvestWeight: link.coinvestWeight || 0.5,
    isAnchor: link.isAnchor || false,
    anchorReason: link.anchorReason,
    rounds: link.rounds || [],
  }));
}

// ============================================================
// PROJECT ACCOUNTS
// ============================================================

export async function linkAccount(input: LinkAccountInput): Promise<void> {
  const col = getAccountsCol();
  
  await col.updateOne(
    { projectId: input.projectId, actorId: input.actorId },
    {
      $set: {
        projectId: input.projectId,
        actorId: input.actorId,
        twitterHandle: input.twitterHandle,
        role: input.role,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  
  await recomputeProjectAuthority(input.projectId);
}

export async function unlinkAccount(projectId: string, actorId: string): Promise<void> {
  const col = getAccountsCol();
  await col.deleteOne({ projectId, actorId });
  await recomputeProjectAuthority(projectId);
}

export async function getProjectAccounts(projectId: string): Promise<ProjectAccount[]> {
  const col = getAccountsCol();
  
  const links = await col.find({ projectId }).toArray();
  
  // TODO: Join with actors/accounts collection for full data
  return links.map(link => ({
    actorId: link.actorId,
    twitterHandle: link.twitterHandle,
    role: link.role || 'OTHER',
    authority: link.authority || 50,
    trustMultiplier: link.trustMultiplier || 1.0,
    realityBadge: link.realityBadge || 'UNKNOWN',
  }));
}

// ============================================================
// PROJECT NETWORK (Local Subgraph)
// ============================================================

export async function getProjectNetwork(projectId: string): Promise<ProjectNetwork> {
  const project = await getProjectById(projectId);
  if (!project) return { nodes: [], edges: [] };
  
  const backers = await getProjectBackers(projectId);
  const accounts = await getProjectAccounts(projectId);
  
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  
  // Project node
  nodes.push({
    id: project.id,
    type: 'PROJECT',
    name: project.name,
    authority: project.authorityScore,
  });
  
  // Backer nodes + edges
  for (const backer of backers) {
    nodes.push({
      id: backer.backerId,
      type: 'BACKER',
      name: backer.backerName,
      authority: backer.seedAuthority,
    });
    
    edges.push({
      source: backer.backerId,
      target: project.id,
      type: 'BACKS',
      weight: backer.isAnchor ? 1.0 : 0.7,
    });
  }
  
  // Account nodes + edges
  for (const account of accounts) {
    nodes.push({
      id: account.actorId,
      type: 'ACCOUNT',
      name: account.twitterHandle || account.actorId,
      authority: account.authority,
    });
    
    edges.push({
      source: account.actorId,
      target: project.id,
      type: 'ADVOCATES',
      weight: account.trustMultiplier,
    });
  }
  
  // Co-investment edges between backers
  for (let i = 0; i < backers.length; i++) {
    for (let j = i + 1; j < backers.length; j++) {
      edges.push({
        source: backers[i].backerId,
        target: backers[j].backerId,
        type: 'CO_INVEST',
        weight: 0.5,
      });
    }
  }
  
  return { nodes, edges };
}

// ============================================================
// RELATED PROJECTS
// ============================================================

export async function getRelatedProjects(projectId: string): Promise<RelatedProject[]> {
  const col = getProjectsCol();
  const project = await getProjectById(projectId);
  if (!project) return [];
  
  const backers = await getProjectBackers(projectId);
  const accounts = await getProjectAccounts(projectId);
  
  const backerIds = backers.map(b => b.backerId);
  const actorIds = accounts.map(a => a.actorId);
  
  // Find projects with shared backers
  const backersCol = getBackersCol();
  const projectsWithSharedBackers = await backersCol.aggregate([
    { $match: { backerId: { $in: backerIds }, projectId: { $ne: projectId } } },
    { $group: { _id: '$projectId', sharedBackers: { $push: '$backerId' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).toArray();
  
  // Find projects with shared accounts
  const accountsCol = getAccountsCol();
  const projectsWithSharedAccounts = await accountsCol.aggregate([
    { $match: { actorId: { $in: actorIds }, projectId: { $ne: projectId } } },
    { $group: { _id: '$projectId', sharedAccounts: { $push: '$actorId' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]).toArray();
  
  // Find projects with same category
  const projectsWithSameCategory = await col
    .find({ 
      _id: { $ne: toObjectId(projectId) },
      categories: { $in: project.categories },
      status: 'ACTIVE',
    })
    .limit(10)
    .toArray();
  
  // Merge and score
  const relatedMap = new Map<string, RelatedProject>();
  
  for (const p of projectsWithSharedBackers) {
    const pid = p._id;
    const existing = relatedMap.get(pid) || await createRelatedProject(pid);
    existing.reasons.push('SHARED_BACKERS');
    existing.sharedBackers = p.sharedBackers;
    existing.strength += p.count * 0.4;
    relatedMap.set(pid, existing);
  }
  
  for (const p of projectsWithSharedAccounts) {
    const pid = p._id;
    const existing = relatedMap.get(pid) || await createRelatedProject(pid);
    if (!existing.reasons.includes('SHARED_ACCOUNTS')) {
      existing.reasons.push('SHARED_ACCOUNTS');
    }
    existing.sharedAccounts = p.sharedAccounts;
    existing.strength += p.count * 0.3;
    relatedMap.set(pid, existing);
  }
  
  for (const p of projectsWithSameCategory) {
    const pid = p._id.toString();
    const existing = relatedMap.get(pid) || {
      projectId: pid,
      projectName: p.name,
      projectSlug: p.slug,
      reasons: [],
      strength: 0,
    };
    if (!existing.reasons.includes('SAME_CATEGORY')) {
      existing.reasons.push('SAME_CATEGORY');
    }
    existing.strength += 0.2;
    relatedMap.set(pid, existing);
  }
  
  // Sort by strength and return
  return Array.from(relatedMap.values())
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

async function createRelatedProject(projectId: string): Promise<RelatedProject> {
  const project = await getProjectById(projectId);
  return {
    projectId,
    projectName: project?.name || 'Unknown',
    projectSlug: project?.slug || projectId,
    reasons: [],
    strength: 0,
  };
}

// ============================================================
// WHY IT MATTERS (Generator)
// ============================================================

export async function getWhyItMatters(projectId: string): Promise<WhyItMatters> {
  const backers = await getProjectBackers(projectId);
  const accounts = await getProjectAccounts(projectId);
  const project = await getProjectById(projectId);
  
  // Anchor backers
  const anchorBackers = backers
    .filter(b => b.isAnchor)
    .map(b => b.backerName);
  
  // Trusted accounts (high trust multiplier)
  const trustedAccounts = accounts
    .filter(a => a.trustMultiplier >= 1.0 && a.realityBadge !== 'RISKY')
    .map(a => a.twitterHandle || a.actorId);
  
  // Reality signal
  let realitySignal: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNKNOWN' = 'UNKNOWN';
  if (project?.realityScore !== null) {
    if (project.realityScore >= 0.7) realitySignal = 'STRONG';
    else if (project.realityScore >= 0.4) realitySignal = 'MODERATE';
    else realitySignal = 'WEAK';
  }
  
  // Generate summaries
  const backersSummary = anchorBackers.length > 0
    ? `Backed by ${anchorBackers.slice(0, 3).join(' and ')}`
    : backers.length > 0
      ? `Backed by ${backers.length} investors`
      : 'No known backers';
  
  const accountsSummary = trustedAccounts.length > 0
    ? `Supported by ${trustedAccounts.length} trusted accounts`
    : accounts.length > 0
      ? `${accounts.length} associated accounts`
      : 'No known accounts';
  
  const realitySummary = realitySignal === 'STRONG'
    ? 'Shows consistent on-chain confirmation'
    : realitySignal === 'MODERATE'
      ? 'Has partial on-chain verification'
      : realitySignal === 'WEAK'
        ? 'Limited on-chain activity'
        : 'Reality data unavailable';
  
  return {
    backersSummary,
    accountsSummary,
    realitySummary,
    anchorBackers,
    trustedAccounts,
    realitySignal,
  };
}

// ============================================================
// AUTHORITY COMPUTATION (FREEZE v2 Formula)
// ============================================================

/**
 * Recompute project authority using the FREEZE v2 formula:
 * 
 * project_authority = 
 *   0.45 * seed_authority
 * + 0.35 * network_authority  
 * + 0.20 * reality_score
 */
export async function recomputeProjectAuthority(projectId: string): Promise<number> {
  const col = getProjectsCol();
  const project = await getProjectById(projectId);
  if (!project) return 0;
  
  const backers = await getProjectBackers(projectId);
  const accounts = await getProjectAccounts(projectId);
  
  // 1. Seed Authority = max(backer.seedAuthority) * anchor_boost
  let seedAuthority = 0;
  let hasAnchor = false;
  
  for (const backer of backers) {
    if (backer.seedAuthority > seedAuthority) {
      seedAuthority = backer.seedAuthority;
    }
    if (backer.isAnchor) hasAnchor = true;
  }
  
  if (hasAnchor) {
    seedAuthority *= ANCHOR_BOOST;
  }
  
  // 2. Network Authority = avg(backer.coinvestWeight, account.authority * trustMultiplier)
  let networkSum = 0;
  let networkCount = 0;
  
  for (const backer of backers) {
    networkSum += backer.coinvestWeight * 100; // Scale to 0-100
    networkCount++;
  }
  
  for (const account of accounts) {
    networkSum += account.authority * account.trustMultiplier;
    networkCount++;
  }
  
  const networkAuthority = networkCount > 0 ? networkSum / networkCount : 0;
  
  // 3. Reality Score (from project or default)
  const realityScore = (project.realityScore ?? 0.5) * 100;
  
  // 4. Final Authority
  const authorityScore = Math.min(100, Math.round(
    PROJECT_AUTHORITY_WEIGHTS.SEED * seedAuthority +
    PROJECT_AUTHORITY_WEIGHTS.NETWORK * networkAuthority +
    PROJECT_AUTHORITY_WEIGHTS.REALITY * realityScore
  ));
  
  // Update project
  await col.updateOne(
    { _id: toObjectId(projectId) },
    { 
      $set: { 
        authorityScore,
        confidence: Math.min(1, (backers.length + accounts.length) * 0.1),
        updatedAt: new Date(),
      }
    }
  );
  
  console.log(`[ProjectStore] Recomputed authority for ${project.slug}: ${authorityScore}`);
  
  return authorityScore;
}

// ============================================================
// STAGE DERIVATION
// ============================================================

export function deriveProjectStage(launchYear?: number, fundingRounds?: string[]): ProjectStage {
  const currentYear = new Date().getFullYear();
  const yearsOld = launchYear ? currentYear - launchYear : 0;
  const roundCount = fundingRounds?.length || 0;
  
  if (yearsOld <= 1 || roundCount <= 1) return 'EARLY';
  if (yearsOld <= 3 || roundCount <= 3) return 'GROWTH';
  return 'MATURE';
}

// ============================================================
// HELPERS
// ============================================================

function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}

function toProjectEntity(doc: any): ProjectEntity {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    categories: doc.categories || [],
    stage: doc.stage || 'EARLY',
    launchYear: doc.launchYear,
    status: doc.status || 'ACTIVE',
    authorityScore: doc.authorityScore || 0,
    realityScore: doc.realityScore ?? null,
    confidence: doc.confidence || 0,
    externalRefs: doc.externalRefs,
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
  };
}

console.log('[ProjectStore] Module loaded (E2 Phase)');
