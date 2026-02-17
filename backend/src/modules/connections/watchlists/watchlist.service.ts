/**
 * Watchlist Service
 */

import { Db, ObjectId } from 'mongodb';

const COLLECTION = 'connections_watchlists';

export interface WatchlistItem {
  entityId: string;
  type: 'ACCOUNT' | 'BACKER' | 'PROJECT';
  preset?: string;
  addedAt: Date;
  snapshot?: {
    authority?: number;
    networkScore?: number;
    tags?: string[];
  };
}

export interface Watchlist {
  _id?: ObjectId;
  userId: string;
  name: string;
  type: 'SMART' | 'VC' | 'EARLY' | 'CUSTOM';
  items: WatchlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export async function createWatchlist(
  db: Db,
  userId: string,
  name: string,
  type: string = 'CUSTOM'
): Promise<Watchlist> {
  const watchlist: Watchlist = {
    userId,
    name,
    type: type as any,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection(COLLECTION).insertOne(watchlist);
  return { ...watchlist, _id: result.insertedId };
}

export async function getWatchlists(db: Db, userId: string): Promise<Watchlist[]> {
  return db.collection(COLLECTION)
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray() as Promise<Watchlist[]>;
}

export async function getWatchlistById(db: Db, id: string): Promise<Watchlist | null> {
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) }) as Promise<Watchlist | null>;
}

export async function addItemToWatchlist(
  db: Db,
  watchlistId: string,
  item: Omit<WatchlistItem, 'addedAt'>
): Promise<boolean> {
  // Get entity snapshot
  const entity = await db.collection('connections_unified_accounts').findOne({
    $or: [{ id: item.entityId }, { slug: item.entityId }]
  });

  const fullItem: WatchlistItem = {
    ...item,
    addedAt: new Date(),
    snapshot: entity ? {
      authority: entity.authority ?? entity.seedAuthority,
      networkScore: entity.networkScore ?? entity.influence,
      tags: entity.tags
    } : undefined
  };

  const result = await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(watchlistId) },
    { 
      $push: { items: fullItem } as any,
      $set: { updatedAt: new Date() }
    }
  );

  return result.modifiedCount > 0;
}

export async function removeItemFromWatchlist(
  db: Db,
  watchlistId: string,
  entityId: string
): Promise<boolean> {
  const result = await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(watchlistId) },
    { 
      $pull: { items: { entityId } } as any,
      $set: { updatedAt: new Date() }
    }
  );

  return result.modifiedCount > 0;
}

export async function deleteWatchlist(db: Db, watchlistId: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(watchlistId) });
  return result.deletedCount > 0;
}

/**
 * Get watchlist with current entity data and changes
 */
export async function getWatchlistWithDiff(db: Db, watchlistId: string): Promise<any> {
  const watchlist = await getWatchlistById(db, watchlistId);
  if (!watchlist) return null;

  const entityIds = watchlist.items.map(i => i.entityId);
  const currentEntities = await db.collection('connections_unified_accounts')
    .find({ $or: [{ id: { $in: entityIds } }, { slug: { $in: entityIds } }] })
    .toArray();

  const entityMap = new Map(currentEntities.map(e => [e.id || e.slug, e]));

  const itemsWithDiff = watchlist.items.map(item => {
    const current = entityMap.get(item.entityId);
    if (!current || !item.snapshot) {
      return { ...item, diff: null, current: current || null };
    }

    const authorityDiff = (current.authority ?? current.seedAuthority ?? 0) - (item.snapshot.authority ?? 0);
    const networkDiff = (current.networkScore ?? current.influence ?? 0) - (item.snapshot.networkScore ?? 0);

    return {
      ...item,
      current: {
        id: current.id,
        title: current.title,
        authority: current.authority ?? current.seedAuthority,
        networkScore: current.networkScore ?? current.influence
      },
      diff: {
        authority: Math.round(authorityDiff * 100) / 100,
        network: Math.round(networkDiff * 100) / 100,
        hasSignificantChange: Math.abs(authorityDiff) > 0.1 || Math.abs(networkDiff) > 0.1
      }
    };
  });

  return {
    ...watchlist,
    items: itemsWithDiff
  };
}
