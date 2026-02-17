import { Db } from 'mongodb';
import { GraphNode } from './graphv2.types.js';

export async function buildNodes(
  db: Db,
  { anchors }: { anchors: boolean }
): Promise<GraphNode[]> {
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  // Get unified accounts
  const accounts = await db
    .collection('connections_unified_accounts')
    .find({})
    .limit(500)
    .toArray();

  for (const acc of accounts) {
    const id = acc.id || String(acc._id);
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({
        id,
        kind: acc.kind || 'TWITTER',
        label: acc.title || acc.handle || acc.username || 'Unknown',
        confidence: acc.confidence ?? 0.7,
        seedAuthority: acc.authority,
      });
    }
  }

  // Backers as anchors
  if (anchors) {
    const backers = await db
      .collection('connections_backers')
      .find({ frozen: { $ne: true } })
      .toArray();

    for (const b of backers) {
      const id = `backer:${b.slug}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          kind: 'BACKER',
          label: b.name || b.slug,
          confidence: 0.9,
          seedAuthority: b.authority ?? 0.8,
        });
      }
    }
  }

  // Add nodes from parsed follow edges (Twitter usernames)
  const parsedFollowEdges = await db
    .collection('parser_follow_edges')
    .find({})
    .limit(500)
    .toArray();

  for (const edge of parsedFollowEdges) {
    // Source user
    if (edge.sourceUsername) {
      const id = `tw_${edge.sourceUsername.toLowerCase()}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          kind: 'TWITTER',
          label: `@${edge.sourceUsername}`,
          confidence: 0.7,
          seedAuthority: 0.5,
        });
      }
    }
    
    // Target user
    if (edge.targetUsername) {
      const id = `tw_${edge.targetUsername.toLowerCase()}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          kind: 'TWITTER',
          label: `@${edge.targetUsername}`,
          confidence: edge.targetVerified ? 0.9 : 0.7,
          seedAuthority: edge.targetFollowers > 100000 ? 0.8 : edge.targetFollowers > 10000 ? 0.6 : 0.4,
        });
      }
    }
  }

  // Add nodes from parsed follower edges
  const parsedFollowerEdges = await db
    .collection('parser_follower_edges')
    .find({})
    .limit(500)
    .toArray();

  for (const edge of parsedFollowerEdges) {
    // Follower user
    if (edge.followerUsername) {
      const id = `tw_${edge.followerUsername.toLowerCase()}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          kind: 'TWITTER',
          label: `@${edge.followerUsername}`,
          confidence: edge.followerVerified ? 0.9 : 0.7,
          seedAuthority: edge.followerFollowers > 100000 ? 0.8 : edge.followerFollowers > 10000 ? 0.6 : 0.4,
        });
      }
    }
    
    // Target user
    if (edge.targetUsername) {
      const id = `tw_${edge.targetUsername.toLowerCase()}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          kind: 'TWITTER',
          label: `@${edge.targetUsername}`,
          confidence: 0.7,
          seedAuthority: 0.5,
        });
      }
    }
  }

  console.log(`[GraphV2 Builders] Built ${nodes.length} nodes (${parsedFollowEdges.length} follow edges, ${parsedFollowerEdges.length} follower edges)`);

  return nodes;
}
