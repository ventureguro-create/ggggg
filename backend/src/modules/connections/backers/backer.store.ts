/**
 * Backer Store - CRUD Operations
 * 
 * Registry for real-world crypto entities.
 * Provides seed authority independent of Twitter.
 */

import { BackerModel, BackerBindingModel, BackerAuditModel } from './backer.model.js';
import type {
  BackerEntity,
  BackerBinding,
  CreateBackerInput,
  UpdateBackerInput,
  CreateBindingInput,
  BackerListFilters,
} from './backer.types.js';

// ============================================================
// BACKER CRUD
// ============================================================

export async function createBacker(
  input: CreateBackerInput, 
  createdBy: string
): Promise<BackerEntity> {
  // Prepare taxonomy if provided
  const taxonomyData = input.taxonomy ? {
    taxonomy: {
      category: input.taxonomy.category,
      subtype: input.taxonomy.subtype,
      confidence: 1.0,
      source: 'MANUAL',
      confirmedAt: new Date(),
      confirmedBy: createdBy,
    }
  } : {};

  const doc = await BackerModel.create({
    ...input,
    ...taxonomyData,
    status: 'ACTIVE',
    frozen: false,
    createdBy,
  });
  
  // Audit
  await BackerAuditModel.create({
    backerId: doc._id.toString(),
    action: 'CREATE',
    changes: input,
    performedBy: createdBy,
  });
  
  console.log(`[BackerStore] Created backer: ${input.name} (${input.slug})`);
  return toBackerEntity(doc);
}

export async function updateBacker(
  id: string,
  input: UpdateBackerInput,
  updatedBy: string
): Promise<BackerEntity | null> {
  const existing = await BackerModel.findById(id);
  if (!existing) return null;
  
  // Check frozen
  if (existing.frozen) {
    throw new Error('BACKER_FROZEN: Cannot update frozen backer');
  }
  
  // Prepare update data
  const updateData: any = { ...input };
  
  // Handle taxonomy update
  if (input.taxonomy) {
    updateData['taxonomy.category'] = input.taxonomy.category;
    updateData['taxonomy.subtype'] = input.taxonomy.subtype;
    updateData['taxonomy.confirmedAt'] = new Date();
    updateData['taxonomy.confirmedBy'] = updatedBy;
    updateData['taxonomy.source'] = 'MANUAL';
    updateData['taxonomy.confidence'] = 1.0;
    delete updateData.taxonomy;
  }
  
  const updated = await BackerModel.findByIdAndUpdate(
    id,
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  if (!updated) return null;
  
  // Audit
  await BackerAuditModel.create({
    backerId: id,
    action: 'UPDATE',
    changes: input,
    performedBy: updatedBy,
  });
  
  console.log(`[BackerStore] Updated backer: ${id}`);
  return toBackerEntity(updated);
}

export async function getBackerById(id: string): Promise<BackerEntity | null> {
  const doc = await BackerModel.findById(id);
  return doc ? toBackerEntity(doc) : null;
}

export async function getBackerBySlug(slug: string): Promise<BackerEntity | null> {
  const doc = await BackerModel.findOne({ slug: slug.toLowerCase() });
  return doc ? toBackerEntity(doc) : null;
}

export async function listBackers(filters: BackerListFilters = {}): Promise<BackerEntity[]> {
  const query: any = {};
  
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.frozen !== undefined) query.frozen = filters.frozen;
  if (filters.minAuthority) query.seedAuthority = { $gte: filters.minAuthority };
  if (filters.categories?.length) query.categories = { $in: filters.categories };
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  // Phase 2: Taxonomy filters
  if (filters.accountCategory) {
    query['taxonomy.category'] = filters.accountCategory;
  }
  if (filters.accountSubtype) {
    query['taxonomy.subtype'] = filters.accountSubtype;
  }
  
  const docs = await BackerModel
    .find(query)
    .sort({ seedAuthority: -1 })
    .limit(filters.limit || 100)
    .skip(filters.offset || 0);
  
  return docs.map(toBackerEntity);
}

export async function deleteBackerSoft(
  id: string, 
  deletedBy: string
): Promise<boolean> {
  const result = await BackerModel.findByIdAndUpdate(id, {
    $set: { status: 'ARCHIVED' }
  });
  
  if (result) {
    await BackerAuditModel.create({
      backerId: id,
      action: 'DELETE',
      changes: { status: 'ARCHIVED' },
      performedBy: deletedBy,
    });
  }
  
  return !!result;
}

// ============================================================
// FREEZE OPERATIONS
// ============================================================

export async function freezeBacker(
  id: string,
  frozenBy: string
): Promise<BackerEntity | null> {
  const updated = await BackerModel.findByIdAndUpdate(
    id,
    { 
      $set: { 
        frozen: true, 
        frozenAt: new Date(),
        frozenBy,
      }
    },
    { returnDocument: 'after' }
  );
  
  if (updated) {
    await BackerAuditModel.create({
      backerId: id,
      action: 'FREEZE',
      changes: { frozen: true },
      performedBy: frozenBy,
    });
    console.log(`[BackerStore] Frozen backer: ${id}`);
  }
  
  return updated ? toBackerEntity(updated) : null;
}

export async function unfreezeBacker(
  id: string,
  unfrozenBy: string
): Promise<BackerEntity | null> {
  const updated = await BackerModel.findByIdAndUpdate(
    id,
    { 
      $set: { frozen: false },
      $unset: { frozenAt: 1, frozenBy: 1 },
    },
    { returnDocument: 'after' }
  );
  
  if (updated) {
    await BackerAuditModel.create({
      backerId: id,
      action: 'UNFREEZE',
      changes: { frozen: false },
      performedBy: unfrozenBy,
    });
    console.log(`[BackerStore] Unfrozen backer: ${id}`);
  }
  
  return updated ? toBackerEntity(updated) : null;
}

export function assertBackerMutable(backer: BackerEntity): void {
  if (backer.frozen) {
    throw new Error(`BACKER_FROZEN: Backer ${backer.slug} is frozen and cannot be modified`);
  }
}

// ============================================================
// BINDING OPERATIONS
// ============================================================

export async function createBinding(
  input: CreateBindingInput,
  createdBy: string
): Promise<BackerBinding> {
  // Check backer exists and not frozen
  const backer = await getBackerById(input.backerId);
  if (!backer) {
    throw new Error('BACKER_NOT_FOUND');
  }
  
  const doc = await BackerBindingModel.create({
    ...input,
    weight: input.weight || 1.0,
    verified: false,
    createdBy,
  });
  
  await BackerAuditModel.create({
    backerId: input.backerId,
    action: 'BIND',
    changes: { targetId: input.targetId, relation: input.relation },
    performedBy: createdBy,
  });
  
  console.log(`[BackerStore] Created binding: ${input.backerId} → ${input.targetId}`);
  return toBindingEntity(doc);
}

export async function removeBinding(
  backerId: string,
  targetId: string,
  removedBy: string
): Promise<boolean> {
  const result = await BackerBindingModel.findOneAndDelete({
    backerId,
    targetId,
  });
  
  if (result) {
    await BackerAuditModel.create({
      backerId,
      action: 'UNBIND',
      changes: { targetId },
      performedBy: removedBy,
    });
    console.log(`[BackerStore] Removed binding: ${backerId} → ${targetId}`);
  }
  
  return !!result;
}

export async function getBindingsByBacker(backerId: string): Promise<BackerBinding[]> {
  const docs = await BackerBindingModel.find({ backerId });
  return docs.map(toBindingEntity);
}

export async function getBindingsByTarget(
  targetType: 'TWITTER' | 'ACTOR',
  targetId: string
): Promise<BackerBinding[]> {
  const docs = await BackerBindingModel.find({ targetType, targetId });
  return docs.map(toBindingEntity);
}

export async function verifyBinding(
  backerId: string,
  targetId: string,
  verifiedBy: string
): Promise<BackerBinding | null> {
  const updated = await BackerBindingModel.findOneAndUpdate(
    { backerId, targetId },
    { $set: { verified: true, verifiedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return updated ? toBindingEntity(updated) : null;
}

// ============================================================
// STATISTICS
// ============================================================

export async function getBackerStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  frozen: number;
  avgAuthority: number;
  // Phase 2: Taxonomy stats
  byAccountCategory: Record<string, number>;
  byAccountSubtype: Record<string, number>;
  unclassified: number;
}> {
  const [total, byType, byStatus, frozen, avgResult, byCategory, bySubtype, unclassified] = await Promise.all([
    BackerModel.countDocuments(),
    BackerModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    BackerModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    BackerModel.countDocuments({ frozen: true }),
    BackerModel.aggregate([{ $group: { _id: null, avg: { $avg: '$seedAuthority' } } }]),
    BackerModel.aggregate([{ $match: { 'taxonomy.category': { $exists: true } } }, { $group: { _id: '$taxonomy.category', count: { $sum: 1 } } }]),
    BackerModel.aggregate([{ $match: { 'taxonomy.subtype': { $exists: true } } }, { $group: { _id: '$taxonomy.subtype', count: { $sum: 1 } } }]),
    BackerModel.countDocuments({ 'taxonomy.category': { $exists: false } }),
  ]);
  
  return {
    total,
    byType: Object.fromEntries(byType.map(b => [b._id, b.count])),
    byStatus: Object.fromEntries(byStatus.map(b => [b._id, b.count])),
    frozen,
    avgAuthority: avgResult[0]?.avg || 0,
    byAccountCategory: Object.fromEntries(byCategory.map(b => [b._id, b.count])),
    byAccountSubtype: Object.fromEntries(bySubtype.map(b => [b._id, b.count])),
    unclassified,
  };
}

export async function getBindingStats(): Promise<{
  total: number;
  byRelation: Record<string, number>;
  verified: number;
}> {
  const [total, byRelation, verified] = await Promise.all([
    BackerBindingModel.countDocuments(),
    BackerBindingModel.aggregate([{ $group: { _id: '$relation', count: { $sum: 1 } } }]),
    BackerBindingModel.countDocuments({ verified: true }),
  ]);
  
  return {
    total,
    byRelation: Object.fromEntries(byRelation.map(b => [b._id, b.count])),
    verified,
  };
}

// ============================================================
// HELPERS
// ============================================================

function toBackerEntity(doc: any): BackerEntity {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    type: doc.type,
    categories: doc.categories || [],
    status: doc.status,
    // Phase 2: Taxonomy
    taxonomy: doc.taxonomy ? {
      category: doc.taxonomy.category,
      subtype: doc.taxonomy.subtype,
      confidence: doc.taxonomy.confidence || 1.0,
      source: doc.taxonomy.source || 'MANUAL',
      suggestedAt: doc.taxonomy.suggestedAt,
      confirmedAt: doc.taxonomy.confirmedAt,
      confirmedBy: doc.taxonomy.confirmedBy,
    } : undefined,
    seedAuthority: doc.seedAuthority,
    confidence: doc.confidence,
    source: doc.source,
    externalRefs: doc.externalRefs,
    frozen: doc.frozen,
    frozenAt: doc.frozenAt,
    frozenBy: doc.frozenBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
  };
}

function toBindingEntity(doc: any): BackerBinding {
  return {
    id: doc._id.toString(),
    backerId: doc.backerId,
    targetType: doc.targetType,
    targetId: doc.targetId,
    targetHandle: doc.targetHandle,
    relation: doc.relation,
    weight: doc.weight,
    verified: doc.verified,
    verifiedAt: doc.verifiedAt,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
  };
}

console.log('[BackerStore] Initialized');
