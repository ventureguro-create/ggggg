/**
 * IPS Main Service
 * 
 * PHASE G: Orchestrates event capture → outcome → IPS calculation
 */

import { Db } from 'mongodb';
import { IPSEvent, IPSEventRecord, MarketSnapshot, IPSReality } from './models/ips.types';
import { WindowKey, TIME_WINDOWS } from './constants/ips.constants';
import { captureEvent } from './services/event-capture.service';
import { getMarketSnapshot } from './services/market-snapshot.service';
import { classifyOutcome } from './services/outcome-classification.service';
import { calculateFullIPS } from './services/ips-score.service';
import { IPSPersistService } from './services/ips-persist.service';

export class IPSService {
  private db: Db;
  private persistService: IPSPersistService;
  
  constructor(db: Db) {
    this.db = db;
    this.persistService = new IPSPersistService(db);
  }
  
  /**
   * Process a tweet and calculate IPS for all time windows
   */
  async processTweet(tweet: any, reality?: IPSReality): Promise<IPSEventRecord[] | null> {
    // 1. Capture event
    const event = captureEvent(tweet);
    if (!event || !event.asset) return null;
    
    const results: IPSEventRecord[] = [];
    
    // 2. For each time window, get snapshot and calculate IPS
    for (const window of TIME_WINDOWS) {
      try {
        // Get market snapshot for this window
        const snapshot = await getMarketSnapshot(
          event.asset,
          event.timestamp,
          event.timestamp + window.ms
        );
        
        // Classify outcome
        const outcome = classifyOutcome(snapshot);
        
        // Get historical data for this actor (simplified)
        const historicalCount = await this.getHistoricalEventCount(event.actorId);
        const historicalAccuracy = await this.getHistoricalAccuracy(event.actorId);
        
        // Calculate IPS
        const { ips, verdict, factors, authorityModifier } = calculateFullIPS(
          event.eventType,
          outcome,
          snapshot,
          event.timestamp,
          window.ms,
          historicalCount,
          reality,
          { events: historicalCount, accuracy: historicalAccuracy },
          { before: 0, after: 0 } // Simplified - could be enhanced
        );
        
        // Create record
        const record: IPSEventRecord = {
          eventId: event.id,
          actorId: event.actorId,
          asset: event.asset,
          timestamp: event.timestamp,
          window: window.key,
          outcome,
          ips,
          verdict,
          factors,
          snapshot,
          reality,
          meta: {
            eventType: event.eventType,
            reach: event.reach,
            projectId: event.projectId
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // Persist
        await this.persistService.persistEvent(record);
        results.push(record);
        
      } catch (error) {
        console.error(`[IPS] Error processing window ${window.key}:`, error);
      }
    }
    
    // Update actor aggregates
    if (results.length > 0) {
      await this.persistService.updateActorStats(event.actorId);
    }
    
    return results;
  }
  
  /**
   * Get historical event count for actor
   */
  private async getHistoricalEventCount(actorId: string): Promise<number> {
    const col = this.db.collection('ips_events');
    return col.countDocuments({ actorId });
  }
  
  /**
   * Get historical accuracy for actor (simplified)
   */
  private async getHistoricalAccuracy(actorId: string): Promise<number> {
    const stats = await this.persistService.getActorStats(actorId);
    return stats?.avgIPS || 0.5;
  }
  
  /**
   * Batch process multiple tweets
   */
  async processTweets(tweets: any[], realityMap?: Map<string, IPSReality>): Promise<void> {
    for (const tweet of tweets) {
      const reality = realityMap?.get(tweet.id);
      await this.processTweet(tweet, reality);
    }
  }
  
  /**
   * Get actor IPS data
   */
  async getActorIPS(actorId: string) {
    return this.persistService.getActorStats(actorId);
  }
  
  /**
   * Get asset IPS data
   */
  async getAssetIPS(asset: string) {
    return this.persistService.getAssetStats(asset);
  }
}
