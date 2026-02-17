/**
 * Discovery Service
 * 
 * Логика обнаружения новых каналов через forwards и mentions
 */
import { TgChannelModel, TgCandidateModel, TgDiscoveryEdgeModel, TgPostModel } from '../models/index.js';

export interface DiscoverFromPostParams {
  post: {
    channelId: string;
    channelUsername: string;
    text?: string;
    forwardFrom?: string;
    mentionedChannels?: string[];
  };
}

export interface SeedChannelParams {
  username: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
}

class DiscoveryService {
  /**
   * Add seed channel (manual entry point)
   */
  async seedChannel(params: SeedChannelParams): Promise<{ ok: boolean; channelId?: string; error?: string }> {
    try {
      const existing = await TgChannelModel.findOne({ username: params.username.toLowerCase() });
      if (existing) {
        return { ok: false, error: 'Channel already exists' };
      }

      const channel = await TgChannelModel.create({
        channelId: `seed_${params.username.toLowerCase()}`,
        username: params.username.toLowerCase(),
        title: params.title,
        description: params.description,
        discoveryMethod: 'seed',
        status: 'active',
        tags: params.tags || [],
        category: params.category,
      });

      return { ok: true, channelId: channel.channelId };
    } catch (error) {
      console.error('[Discovery] Seed channel error:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Process post for discovery (extract forwards/mentions)
   */
  async discoverFromPost(params: DiscoverFromPostParams): Promise<{ 
    candidates: number; 
    edges: number;
  }> {
    const { post } = params;
    let candidatesAdded = 0;
    let edgesCreated = 0;

    // 1. Process forward
    if (post.forwardFrom) {
      const result = await this.addCandidate({
        username: post.forwardFrom,
        discoveredFrom: post.channelUsername,
        discoveryMethod: 'forward',
      });
      if (result.isNew) candidatesAdded++;

      // Create edge
      await this.upsertEdge({
        sourceChannelId: post.channelId,
        targetUsername: post.forwardFrom,
        type: 'forward',
      });
      edgesCreated++;
    }

    // 2. Process mentions
    if (post.mentionedChannels) {
      for (const mentioned of post.mentionedChannels) {
        const result = await this.addCandidate({
          username: mentioned,
          discoveredFrom: post.channelUsername,
          discoveryMethod: 'mention',
        });
        if (result.isNew) candidatesAdded++;

        // Create edge
        await this.upsertEdge({
          sourceChannelId: post.channelId,
          targetUsername: mentioned,
          type: 'mention',
        });
        edgesCreated++;
      }
    }

    return { candidates: candidatesAdded, edges: edgesCreated };
  }

  /**
   * Add candidate channel to queue
   */
  private async addCandidate(params: {
    username: string;
    discoveredFrom: string;
    discoveryMethod: 'forward' | 'mention';
  }): Promise<{ isNew: boolean }> {
    const username = params.username.toLowerCase().replace('@', '');
    
    // Check if already a known channel
    const existingChannel = await TgChannelModel.findOne({ username });
    if (existingChannel) {
      return { isNew: false };
    }

    // Upsert candidate
    const result = await TgCandidateModel.findOneAndUpdate(
      { username },
      {
        $setOnInsert: {
          username,
          discoveredFrom: params.discoveredFrom,
          discoveryMethod: params.discoveryMethod,
          status: 'pending',
        },
        $inc: { mentionCount: 1, priority: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return { isNew: result.mentionCount === 1 };
  }

  /**
   * Upsert discovery edge
   */
  private async upsertEdge(params: {
    sourceChannelId: string;
    targetUsername: string;
    type: 'forward' | 'mention';
  }): Promise<void> {
    // Find target channel ID
    const targetChannel = await TgChannelModel.findOne({ 
      username: params.targetUsername.toLowerCase().replace('@', '')
    });
    
    if (!targetChannel) {
      // Target not yet in system, skip edge for now
      return;
    }

    await TgDiscoveryEdgeModel.findOneAndUpdate(
      {
        sourceChannelId: params.sourceChannelId,
        targetChannelId: targetChannel.channelId,
        type: params.type,
      },
      {
        $inc: { count: 1 },
        $set: { lastSeen: new Date() },
        $setOnInsert: { firstSeen: new Date() },
      },
      { upsert: true }
    );
  }

  /**
   * Get pending candidates for processing
   */
  async getPendingCandidates(limit: number = 10): Promise<Array<{
    username: string;
    mentionCount: number;
    priority: number;
    discoveredFrom: string;
  }>> {
    const candidates = await TgCandidateModel
      .find({ status: 'pending' })
      .sort({ priority: -1, discoveredAt: 1 })
      .limit(limit)
      .lean();

    return candidates.map(c => ({
      username: c.username,
      mentionCount: c.mentionCount,
      priority: c.priority,
      discoveredFrom: c.discoveredFrom,
    }));
  }

  /**
   * Get discovery stats
   */
  async getStats(): Promise<{
    totalChannels: number;
    activeChannels: number;
    pendingCandidates: number;
    totalEdges: number;
    totalPosts: number;
  }> {
    const [
      totalChannels,
      activeChannels,
      pendingCandidates,
      totalEdges,
      totalPosts,
    ] = await Promise.all([
      TgChannelModel.countDocuments(),
      TgChannelModel.countDocuments({ status: 'active' }),
      TgCandidateModel.countDocuments({ status: 'pending' }),
      TgDiscoveryEdgeModel.countDocuments(),
      TgPostModel.countDocuments(),
    ]);

    return {
      totalChannels,
      activeChannels,
      pendingCandidates,
      totalEdges,
      totalPosts,
    };
  }
}

export const discoveryService = new DiscoveryService();
