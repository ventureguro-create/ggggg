/**
 * Twitter Runtime Interface
 * Contract for executing Twitter parsing tasks
 */
export interface TwitterRuntime {
  /**
   * Execute a Twitter search
   */
  search(input: { query: string; filters?: any; limit?: number; taskId?: string; [key: string]: any }): Promise<void>;

  /**
   * Fetch tweets from a specific account
   */
  accountTweets(input: { username: string; limit?: number; taskId?: string; [key: string]: any }): Promise<void>;
}

/**
 * Mock Runtime for testing (replace with real implementation)
 */
export class MockTwitterRuntime implements TwitterRuntime {
  async search(input: { query: string; filters?: any }): Promise<void> {
    console.log(`[MockRuntime] Searching for: ${input.query}`);
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async accountTweets(input: { username: string; limit?: number }): Promise<void> {
    console.log(`[MockRuntime] Fetching tweets from: ${input.username}`);
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
