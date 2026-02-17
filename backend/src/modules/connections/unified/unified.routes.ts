import { FastifyInstance, FastifyRequest } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { getUnifiedAccounts, seedUnifiedAccounts, COLLECTION } from './unified.service.js';
import { FACETS, FacetKey } from './unified.facets.js';
import { PRESET_TO_GROUP, PresetKey } from '../taxonomy/taxonomy.presets.js';
import { getAccountsByGroup } from '../taxonomy/taxonomy.engine.js';

export async function registerUnifiedRoutes(app: FastifyInstance) {
  // Seed data on startup
  const db = getMongoDb();
  const seeded = await seedUnifiedAccounts(db);
  console.log(`[Unified] Seeded ${seeded} accounts`);

  // GET /api/connections/unified?facet=SMART or ?preset=EARLY
  app.get('/api/connections/unified', async (req: any) => {
    const { facet, preset, q, limit = '50' } = req.query as {
      facet?: string;
      preset?: PresetKey;
      q?: string;
      limit?: string;
    };
    
    // If preset is provided, try taxonomy first
    if (preset && PRESET_TO_GROUP[preset]) {
      const group = PRESET_TO_GROUP[preset];
      const members = await getAccountsByGroup(group, { 
        limit: parseInt(limit), 
        minWeight: 0.2 
      });
      
      // If taxonomy has members, use them
      if (members.length > 0) {
        // Enrich with unified account data
        const accountIds = members.map(m => m.accountId);
        const accounts = await db.collection('connections_unified_accounts')
          .find({ $or: [{ id: { $in: accountIds } }, { handle: { $in: accountIds } }] })
          .toArray();
        
        const accountMap = new Map(accounts.map(a => [a.id || a.handle, a]));
        
        let items = members.map(m => ({
          ...accountMap.get(m.accountId),
          accountId: m.accountId,
          score: m.weight,
          groups: [{ group: m.group, weight: m.weight }],
        }));
        
        // Filter by search query
        if (q) {
          const query = q.toLowerCase();
          items = items.filter(item => 
            (item.accountId || '').toLowerCase().includes(query) ||
            (item.username || '').toLowerCase().includes(query) ||
            (item.name || '').toLowerCase().includes(query) ||
            (item.handle || '').toLowerCase().includes(query)
          );
        }
        
        return {
          ok: true,
          preset,
          group,
          count: items.length,
          data: items,
        };
      }
      
      // Taxonomy empty - fall through to facet query with preset as facet
    }
    
    // Fallback to facet-based query (also used when taxonomy is empty)
    const selectedFacet = String(facet || 'SMART');
    const limitNum = parseInt(limit);
    const data = await getUnifiedAccounts(db, selectedFacet, limitNum);
    const facetDef = FACETS[selectedFacet as FacetKey];
    
    return {
      ok: true,
      facet: selectedFacet,
      title: facetDef?.title || selectedFacet,
      count: data.length,
      data
    };
  });

  // GET /api/connections/unified/facets - list all facets
  app.get('/api/connections/unified/facets', async () => {
    const facetList = Object.entries(FACETS).map(([key, val]) => ({
      key,
      title: val.title,
      sortBy: val.sort.by
    }));
    
    return { ok: true, facets: facetList };
  });

  // POST /api/connections/unified/import-twitter - import from parsed tweets
  app.post('/api/connections/unified/import-twitter', async () => {
    const { importTwitterAccountsFromTweets, getImportStats } = await import('./twitter-importer.service.js');
    
    const result = await importTwitterAccountsFromTweets(db);
    const stats = await getImportStats(db);
    
    return {
      ok: true,
      imported: result.imported,
      updated: result.updated,
      stats
    };
  });

  // POST /api/connections/unified/refresh-engagement/:handle - fetch real engagement for account
  app.post('/api/connections/unified/refresh-engagement/:handle', async (request: FastifyRequest<{ Params: { handle: string } }>) => {
    const { handle } = request.params;
    const username = handle.replace('@', '');
    
    try {
      // Get account
      const account = await db.collection(COLLECTION).findOne({ 
        $or: [
          { handle: `@${username}` },
          { handle: username },
          { 'twitter.username': username }
        ]
      });
      
      if (!account) {
        return { ok: false, error: 'Account not found' };
      }
      
      // Use LocalParserRuntime to get user tweets (not search!)
      const { createLocalParserRuntime } = await import('../../twitter/runtime/adapters/local-parser.runtime.js');
      const runtime = createLocalParserRuntime(
        process.env.PARSER_URL || 'http://localhost:5001',
        'SYSTEM'
      );
      
      // Fetch tweets using UserTweets endpoint (real engagement data)
      const tweetsResult = await runtime.fetchAccountTweets(username, 20);
      
      if (!tweetsResult.ok || !tweetsResult.data?.length) {
        return { ok: false, error: tweetsResult.error || 'No tweets found' };
      }
      
      // Calculate engagement from tweets
      let totalLikes = 0;
      let totalReposts = 0;
      let totalReplies = 0;
      let totalViews = 0;
      const tweets = tweetsResult.data;
      
      for (const tweet of tweets) {
        totalLikes += tweet.likes || 0;
        totalReposts += tweet.reposts || 0;
        totalReplies += tweet.replies || 0;
        totalViews += tweet.views || 0;
      }
      
      const tweetCount = tweets.length;
      const avgEngagement = tweetCount > 0 ? (totalLikes + totalReposts * 2 + totalReplies * 3) / tweetCount : 0;
      const followers = account.followers || 1;
      const engagementRate = avgEngagement / followers;
      const engagement = Math.min(engagementRate * 10, 1);
      
      // Update account
      await db.collection(COLLECTION).updateOne(
        { _id: account._id },
        {
          $set: {
            engagement,
            engagementRate: engagementRate * 100,
            totalEngagement: totalLikes + totalReposts + totalReplies,
            avgEngagementPerTweet: avgEngagement,
            tweetCount: (account.tweetCount || 0) + tweetCount,
            totalLikes: (account.totalLikes || 0) + totalLikes,
            totalReposts: (account.totalReposts || 0) + totalReposts,
            totalReplies: (account.totalReplies || 0) + totalReplies,
            totalViews: (account.totalViews || 0) + totalViews,
            engagementUpdatedAt: new Date(),
          }
        }
      );
      
      return {
        ok: true,
        username,
        tweetsAnalyzed: tweetCount,
        engagement: {
          likes: totalLikes,
          reposts: totalReposts,
          replies: totalReplies,
          views: totalViews,
          rate: (engagementRate * 100).toFixed(2) + '%',
          score: engagement.toFixed(3),
        }
      };
    } catch (error: any) {
      console.error('[Unified] Refresh engagement error:', error.message);
      return { ok: false, error: error.message };
    }
  });

  // POST /api/connections/unified/parse-following/:handle - parse following list for an account
  app.post('/api/connections/unified/parse-following/:handle', async (request: FastifyRequest<{ Params: { handle: string } }>) => {
    const { handle } = request.params;
    const username = handle.replace('@', '');
    
    try {
      // Get account
      const account = await db.collection(COLLECTION).findOne({ 
        $or: [
          { handle: `@${username}` },
          { handle: username },
          { 'twitter.username': username }
        ]
      });
      
      if (!account) {
        return { ok: false, error: 'Account not found' };
      }
      
      // Use LocalParserRuntime to get following list
      const { createLocalParserRuntime } = await import('../../twitter/runtime/adapters/local-parser.runtime.js');
      const runtime = createLocalParserRuntime(
        process.env.PARSER_URL || 'http://localhost:5001',
        'SYSTEM'
      );
      
      // Fetch following list
      const followingResult = await runtime.fetchAccountFollowing(username, 50);
      
      if (!followingResult.ok || !followingResult.data?.following?.length) {
        return { ok: false, error: followingResult.error || 'No following data found' };
      }
      
      const following = followingResult.data.following;
      const now = new Date();
      
      // Save follow edges to twitter_follows collection
      const followEdges = following.map((f: any) => ({
        fromAuthorId: account.id || `tw:${username}`,
        toAuthorId: `tw:${f.id}`,
        toUsername: f.username,
        toName: f.name,
        toFollowers: f.followers,
        toVerified: f.verified,
        followedAt: now,
        parsedAt: now,
        source: 'backend_parser',
      }));
      
      // Insert with upsert
      const followsCollection = db.collection('twitter_follows');
      for (const edge of followEdges) {
        await followsCollection.updateOne(
          { fromAuthorId: edge.fromAuthorId, toAuthorId: edge.toAuthorId },
          { $set: edge },
          { upsert: true }
        );
      }
      
      // Update account with followingParsedAt timestamp
      await db.collection(COLLECTION).updateOne(
        { _id: account._id },
        { $set: { followingParsedAt: now, followingCount: following.length } }
      );
      
      return {
        ok: true,
        username,
        followingCount: following.length,
        savedEdges: followEdges.length,
        following: following.slice(0, 10),
      };
    } catch (error: any) {
      console.error('[Unified] Parse following error:', error.message);
      return { ok: false, error: error.message };
    }
  });

  // POST /api/connections/unified/parse-following-batch - parse following for top accounts
  app.post('/api/connections/unified/parse-following-batch', async (request: FastifyRequest<{ Body: { limit?: number } }>) => {
    const { limit = 5 } = (request.body || {}) as { limit?: number };
    
    try {
      // Get top accounts by followers
      const topAccounts = await db.collection(COLLECTION)
        .find({ kind: 'TWITTER', followers: { $gt: 10000 } })
        .sort({ followers: -1 })
        .limit(limit)
        .toArray();
      
      if (topAccounts.length === 0) {
        return { ok: false, error: 'No accounts found to process' };
      }
      
      const { createLocalParserRuntime } = await import('../../twitter/runtime/adapters/local-parser.runtime.js');
      const runtime = createLocalParserRuntime(
        process.env.PARSER_URL || 'http://localhost:5001',
        'SYSTEM'
      );
      
      const results: any[] = [];
      const followsCollection = db.collection('twitter_follows');
      const now = new Date();
      
      for (const account of topAccounts) {
        const username = account.handle?.replace('@', '') || account.title;
        if (!username) continue;
        
        try {
          console.log(`[Unified] Parsing following for @${username}`);
          const followingResult = await runtime.fetchAccountFollowing(username, 30);
          
          if (!followingResult.ok || !followingResult.data?.following?.length) {
            results.push({ username, ok: false, error: followingResult.error || 'No data' });
            continue;
          }
          
          const following = followingResult.data.following;
          
          // Get all existing accounts to match by username
          const existingAccounts = await db.collection(COLLECTION).find({}).toArray();
          const accountByUsername = new Map<string, any>();
          for (const acc of existingAccounts) {
            const handle = acc.handle?.replace('@', '').toLowerCase() || '';
            if (handle) accountByUsername.set(handle, acc);
          }
          
          // Save follow edges - try to match toAuthorId with existing accounts
          for (const f of following) {
            const targetUsername = f.username?.toLowerCase() || '';
            const matchedAccount = accountByUsername.get(targetUsername);
            
            // Use matched account ID if found, otherwise use twitter ID
            const toAuthorId = matchedAccount?.id || `tw:${f.id}`;
            
            await followsCollection.updateOne(
              { fromAuthorId: account.id, toAuthorId },
              { 
                $set: {
                  fromAuthorId: account.id,
                  toAuthorId,
                  toUsername: f.username,
                  toName: f.name,
                  toFollowers: f.followers,
                  toVerified: f.verified,
                  followedAt: now,
                  parsedAt: now,
                  source: 'batch_parser',
                  matchedInDB: !!matchedAccount,
                }
              },
              { upsert: true }
            );
          }
          
          // Update account
          await db.collection(COLLECTION).updateOne(
            { _id: account._id },
            { $set: { followingParsedAt: now, followingCount: following.length } }
          );
          
          results.push({ username, ok: true, followingCount: following.length });
          
          // Small delay between requests
          await new Promise(r => setTimeout(r, 2000));
        } catch (err: any) {
          results.push({ username, ok: false, error: err.message });
        }
      }
      
      const totalEdges = await followsCollection.countDocuments();
      
      return {
        ok: true,
        processed: results.length,
        totalEdgesInDB: totalEdges,
        results,
      };
    } catch (error: any) {
      console.error('[Unified] Batch parse following error:', error.message);
      return { ok: false, error: error.message };
    }
  });

  // GET /api/connections/unified/follow-stats - get follow graph statistics
  app.get('/api/connections/unified/follow-stats', async () => {
    const followsCollection = db.collection('twitter_follows');
    const totalEdges = await followsCollection.countDocuments();
    const uniqueSources = await followsCollection.distinct('fromAuthorId');
    const uniqueTargets = await followsCollection.distinct('toAuthorId');
    
    return {
      ok: true,
      stats: {
        totalEdges,
        uniqueSources: uniqueSources.length,
        uniqueTargets: uniqueTargets.length,
      }
    };
  });

  // GET /api/connections/unified/stats - get import statistics
  app.get('/api/connections/unified/stats', async () => {
    const { getImportStats } = await import('./twitter-importer.service.js');
    const stats = await getImportStats(db);
    
    return { ok: true, stats };
  });

  // POST /api/connections/unified/refresh - trigger manual influencer refresh
  app.post('/api/connections/unified/refresh', async () => {
    const { refreshInfluencers, getInfluencerRefreshStatus } = await import('../../../jobs/influencer_refresh.job.js');
    const result = await refreshInfluencers();
    const status = getInfluencerRefreshStatus();
    
    return { 
      ok: true, 
      ...result,
      status
    };
  });

  // POST /api/connections/unified/refresh-vc - trigger VC/Funds specific refresh
  app.post('/api/connections/unified/refresh-vc', async () => {
    const { refreshVCInfluencers, getInfluencerRefreshStatus } = await import('../../../jobs/influencer_refresh.job.js');
    const result = await refreshVCInfluencers();
    const status = getInfluencerRefreshStatus();
    
    return { 
      ok: true, 
      category: 'VC',
      ...result,
      status
    };
  });

  // GET /api/connections/unified/refresh-status - get auto-refresh job status
  app.get('/api/connections/unified/refresh-status', async () => {
    const { getInfluencerRefreshStatus } = await import('../../../jobs/influencer_refresh.job.js');
    const status = getInfluencerRefreshStatus();
    
    return { ok: true, status };
  });

  // GET /api/connections/accounts - list all accounts (for ConnectionsPage)
  // Must be BEFORE /:authorId route
  app.get('/api/connections/accounts', async (req: any) => {
    const { limit = '100', offset = '0', search } = req.query;
    
    const query: any = {};
    if (search) {
      query.$or = [
        { handle: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }
    
    console.log('[Accounts] Query:', JSON.stringify(query), 'Collection:', COLLECTION);
    
    const items = await db.collection(COLLECTION)
      .find(query)
      .sort({ influence: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .toArray();
    
    console.log('[Accounts] Found items:', items.length);
    
    const total = await db.collection(COLLECTION).countDocuments(query);
    
    // Transform to expected format
    const transformedItems = items.map(acc => ({
      id: acc.id || String(acc._id),
      username: acc.handle?.replace('@', '') || acc.title,
      name: acc.title,
      avatar: acc.avatar,
      followers: acc.followers || 0,
      following: acc.following || 0,
      influence_score: Math.round((acc.influence || 0.5) * 1000),
      risk_level: acc.confidence > 0.7 ? 'low' : acc.confidence > 0.4 ? 'medium' : 'high',
      activity_30d: acc.tweetCount || Math.floor(Math.random() * 50),
      categories: acc.categories || [],
      verified: acc.verified || false,
    }));
    
    return {
      ok: true,
      data: {
        items: transformedItems,
        total,
      }
    };
  });

  // GET /api/connections/accounts/:id - get single account by ID (for Pro Analytics)
  app.get('/api/connections/accounts/:authorId', async (request: FastifyRequest<{ Params: { authorId: string } }>) => {
    const { authorId } = request.params;
    
    // Try to find in unified accounts
    const account = await db.collection(COLLECTION).findOne({
      $or: [
        { id: authorId },
        { handle: authorId.startsWith('@') ? authorId : `@${authorId}` },
        { handle: authorId }
      ]
    });
    
    if (!account) {
      return { ok: false, error: 'Account not found' };
    }
    
    // Get top followers from connections_follow_graph collection
    let topFollowers: any[] = [];
    try {
      // Query followers who follow this account (edges where toAuthorId = account.id)
      const followEdges = await db.collection('connections_follow_graph')
        .find({ 
          $or: [
            { toAuthorId: account.id },
            { toUsername: account.handle?.replace('@', '') }
          ]
        })
        .sort({ followerWeight: -1 })
        .limit(20)
        .toArray();
      
      if (followEdges.length > 0) {
        // Get follower accounts
        const followerIds = followEdges.map(e => e.fromAuthorId);
        const followerAccounts = await db.collection(COLLECTION)
          .find({ id: { $in: followerIds } })
          .toArray();
        
        const followerMap = new Map(followerAccounts.map(a => [a.id, a]));
        
        topFollowers = followEdges.slice(0, 10).map(edge => {
          const follower = followerMap.get(edge.fromAuthorId);
          return {
            handle: follower?.handle || edge.fromUsername || 'Unknown',
            name: follower?.title || edge.fromName || '',
            avatar: follower?.avatar,
            followers: follower?.followers || edge.fromFollowers || 0,
            verified: follower?.verified || false,
            weight: edge.followerWeight || 0.5,
          };
        }).filter(f => f.followers > 0);
      }
      
      // Fallback: check twitter_follows collection
      if (topFollowers.length === 0) {
        const twitterFollows = await db.collection('twitter_follows')
          .find({ 
            toUsername: account.handle?.replace('@', '')
          })
          .sort({ toFollowers: -1 })
          .limit(10)
          .toArray();
        
        topFollowers = twitterFollows.map(edge => ({
          handle: `@${edge.fromUsername || edge.fromAuthorId}`,
          name: edge.fromName || '',
          followers: edge.fromFollowers || 0,
          verified: edge.fromVerified || false,
        })).filter(f => f.followers > 0);
      }
    } catch (err) {
      console.log('[Unified] TopFollowers query error:', err);
    }
    
    // Transform to Pro Analytics format
    const profileData = {
      author_id: account.id,
      username: account.handle?.replace('@', '') || account.title,
      name: account.title,
      avatar: account.avatar,
      followers: account.followers || 0,
      following: account.following || 0,
      profile: account.followers >= 500000 ? 'whale' : account.followers >= 50000 ? 'influencer' : 'retail',
      verified: account.verified || false,
      scores: {
        influence_score: Math.round((account.influence || 0.5) * 1000),
        x_score: account.twitterScore || Math.round((account.engagement || 0.5) * 600),
        signal_noise: account.engagement ? (account.engagement * 10) : 5,
        risk_level: account.confidence > 0.7 ? 'low' : account.confidence > 0.4 ? 'medium' : 'high',
      },
      activity: {
        posts_count: account.tweetCount || 0,
        window_days: 30,
        avg_likes: account.avgLikes || 0,
        total_likes: account.totalLikes || 0,
        total_reposts: account.totalReposts || 0,
        total_views: account.totalViews || 0,
      },
      trend: {
        velocity_norm: account.engagement ? (account.engagement - 0.5) * 2 : 0,
        acceleration_norm: 0.1,
      },
      categories: account.categories || [],
      source: account.source,
      lastSeen: account.lastSeen,
      topFollowers: topFollowers,
    };
    
    return { ok: true, data: profileData };
  });

  console.log('[Unified] Routes registered at /api/connections/unified/*');
}
