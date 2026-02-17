/**
 * Twitter Runtime - Real Implementation
 * 
 * Executes parsing tasks using TwitterClient with ScrollEngine
 */

import { twitterClient, SearchInput, UserInput } from '../browser/twitter-client.js';
import { TwitterRuntime } from './twitter.runtime.js';
import { ScrollProfile } from '../scroll/index.js';

export interface RealRuntimeConfig {
  /** Default cookies for parsing (system pool) */
  defaultCookies?: any[];
  
  /** Default profile */
  defaultProfile?: ScrollProfile;
  
  /** Callback for storing results */
  onResults?: (tweets: any[], taskId?: string) => Promise<void>;
  
  /** Callback for reporting engine summary */
  onEngineSummary?: (summary: any, taskId?: string) => Promise<void>;
}

export class RealTwitterRuntime implements TwitterRuntime {
  private config: RealRuntimeConfig;

  constructor(config: RealRuntimeConfig = {}) {
    this.config = config;
  }

  /**
   * Execute a Twitter search
   */
  async search(input: { 
    query: string; 
    filters?: any;
    cookies?: any[];
    profile?: ScrollProfile;
    limit?: number;
    taskId?: string;
  }): Promise<void> {
    const cookies = input.cookies || this.config.defaultCookies;
    
    if (!cookies || cookies.length === 0) {
      throw new Error('No cookies available for parsing');
    }

    console.log(`[RealRuntime] Search: "${input.query}", limit: ${input.limit || 50}`);

    const searchInput: SearchInput = {
      keyword: input.query,
      limit: input.limit || 50,
      cookies,
      profile: input.profile || this.config.defaultProfile || ScrollProfile.SAFE,
      taskId: input.taskId,
    };

    const result = await twitterClient.searchWithCredentials(searchInput);

    console.log(`[RealRuntime] Search complete: ${result.tweets.length} tweets`);

    // Report results
    if (this.config.onResults) {
      await this.config.onResults(result.tweets, input.taskId);
    }

    // Report engine summary
    if (this.config.onEngineSummary && result.engineSummary) {
      await this.config.onEngineSummary(result.engineSummary, input.taskId);
    }
  }

  /**
   * Fetch tweets from a specific account
   */
  async accountTweets(input: { 
    username: string; 
    limit?: number;
    cookies?: any[];
    profile?: ScrollProfile;
    taskId?: string;
  }): Promise<void> {
    const cookies = input.cookies || this.config.defaultCookies;
    
    if (!cookies || cookies.length === 0) {
      throw new Error('No cookies available for parsing');
    }

    console.log(`[RealRuntime] Account tweets: @${input.username}, limit: ${input.limit || 50}`);

    const userInput: UserInput = {
      username: input.username,
      limit: input.limit || 50,
      cookies,
      profile: input.profile || this.config.defaultProfile || ScrollProfile.SAFE,
      taskId: input.taskId,
    };

    const result = await twitterClient.getUserTweetsWithCredentials(userInput);

    console.log(`[RealRuntime] Account tweets complete: ${result.tweets.length} tweets`);

    // Report results
    if (this.config.onResults) {
      await this.config.onResults(result.tweets, input.taskId);
    }

    // Report engine summary
    if (this.config.onEngineSummary && result.engineSummary) {
      await this.config.onEngineSummary(result.engineSummary, input.taskId);
    }
  }
}
