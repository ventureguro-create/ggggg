/**
 * Actor Handle Resolver Port
 * 
 * Resolves Connections actorId -> Twitter handle.
 */

export interface IActorHandleResolver {
  resolveTwitterHandle(actorId: string): Promise<string | null>;
}
