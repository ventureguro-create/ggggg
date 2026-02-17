import { MongoTaskQueue } from './mongo-task-queue.js';
import { type TwitterRuntime } from './twitter.runtime.js';
import { type ITwitterTask } from './twitter-task.model.js';

export class MongoTaskWorker {
  private running = false;
  private inflight = 0;
  private readonly MAX_CONCURRENT = 3;
  private readonly WORKER_ID: string;
  private recoveryInterval?: NodeJS.Timeout;

  constructor(
    private queue: MongoTaskQueue,
    private runtime: TwitterRuntime
  ) {
    this.WORKER_ID = `worker-${process.pid}-${Date.now()}`;
  }

  /**
   * Start the worker loop
   */
  start() {
    if (this.running) {
      console.log('[MongoTaskWorker] Already running');
      return;
    }

    this.running = true;
    console.log(`[MongoTaskWorker] Starting with concurrent limit: ${this.MAX_CONCURRENT}`);
    
    this.loop();
    this.startRecovery();
  }

  /**
   * Stop the worker
   */
  stop() {
    this.running = false;
    
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = undefined;
    }

    console.log('[MongoTaskWorker] Stopped');
  }

  /**
   * Main worker loop
   */
  private async loop() {
    while (this.running) {
      try {
        // Check if we can accept more tasks
        if (this.inflight >= this.MAX_CONCURRENT) {
          await this.sleep(300);
          continue;
        }

        // Try to claim a task
        const task = await this.queue.claim(this.WORKER_ID);
        
        if (!task) {
          await this.sleep(500);
          continue;
        }

        // Process task in background
        this.inflight++;
        this.run(task).finally(() => {
          this.inflight--;
        });
      } catch (err) {
        console.error('[MongoTaskWorker] Loop error:', err);
        await this.sleep(1000);
      }
    }
  }

  /**
   * Run a single task
   */
  private async run(task: ITwitterTask) {
    try {
      console.log(`[MongoTaskWorker] Running task ${task._id} (type: ${task.type})`);

      const payload = task.payload as Record<string, any>;
      const taskId = task._id.toString();

      switch (task.type) {
        case 'SEARCH':
          await this.runtime.search({
            query: payload.query || '',
            filters: payload.filters,
            limit: payload.maxTweets || payload.limit,
            taskId,
            ...payload,
          });
          break;

        case 'ACCOUNT_TWEETS':
          await this.runtime.accountTweets({
            username: payload.username || payload.query || '',
            limit: payload.maxTweets || payload.limit,
            taskId,
            ...payload,
          });
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      await this.queue.ack(task._id.toString());
      console.log(`[MongoTaskWorker] Task ${task._id} completed`);
    } catch (err: any) {
      console.error(`[MongoTaskWorker] Task ${task._id} failed:`, err.message);
      await this.queue.fail(task, err);
    }
  }

  /**
   * Start periodic stale task recovery
   */
  private startRecovery() {
    this.recoveryInterval = setInterval(async () => {
      try {
        const recovered = await this.queue.recoverStale(5 * 60_000); // 5 minutes
        if (recovered > 0) {
          console.log(`[MongoTaskWorker] Recovered ${recovered} stale tasks`);
        }
      } catch (err) {
        console.error('[MongoTaskWorker] Recovery error:', err);
      }
    }, 60_000); // Run every minute
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      workerId: this.WORKER_ID,
      running: this.running,
      inflight: this.inflight,
      maxConcurrent: this.MAX_CONCURRENT,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
