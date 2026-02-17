/**
 * Actor Handle Resolver (MongoDB)
 * 
 * Resolves Connections actorId -> Twitter handle.
 */

import type { Db } from 'mongodb';
import type { IActorHandleResolver } from '../ports/actorHandle.resolver.port.js';

type ActorDoc = {
  _id: string;
  twitterHandle?: string;
  handle?: string;
  profile?: { handle?: string; username?: string };
};

export class MongoActorHandleResolver implements IActorHandleResolver {
  constructor(private readonly db: Db) {}

  async resolveTwitterHandle(actorId: string): Promise<string | null> {
    // Try multiple possible collections
    const collectionNames = [
      'connections_actors',
      'connections_unified',
      'connections_author_profiles',
    ];

    for (const colName of collectionNames) {
      const collections = await this.db.listCollections({ name: colName }).toArray();
      if (collections.length === 0) continue;

      const col = this.db.collection<ActorDoc>(colName);
      const doc = await col.findOne({ _id: actorId });
      
      if (doc) {
        const handle = doc.twitterHandle || doc.handle || doc.profile?.handle || doc.profile?.username;
        if (handle) {
          return String(handle).replace(/^@/, '');
        }
      }
    }

    // Fallback: actorId might be the handle itself
    if (actorId && !actorId.includes('-')) {
      return actorId;
    }

    return null;
  }
}
