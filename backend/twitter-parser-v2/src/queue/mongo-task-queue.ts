import { TwitterTaskModel, type ITwitterTask, type TaskType } from './twitter-task.model.js';

export class MongoTaskQueue {
  /**
   * Enqueue a new task
   */
  async enqueue(type: TaskType, payload: Record<string, any>): Promise<ITwitterTask> {
    return TwitterTaskModel.create({
      type,
      payload,
      status: 'PENDING',
      attempts: 0,
      nextRunAt: new Date(),
    });
  }

  /**
   * 🔒 ATOMIC CLAIM
   * Atomically claims a pending task for processing
   */
  async claim(workerId: string): Promise<ITwitterTask | null> {
    return TwitterTaskModel.findOneAndUpdate(
      {
        status: 'PENDING',
        nextRunAt: { $lte: new Date() },
      },
      {
        $set: {
          status: 'RUNNING',
          lockedBy: workerId,
          lockedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      {
        sort: { createdAt: 1 },
        new: true,
      }
    );
  }

  /**
   * Mark task as successfully completed
   */
  async ack(taskId: string): Promise<ITwitterTask | null> {
    return TwitterTaskModel.findByIdAndUpdate(
      taskId,
      {
        $set: {
          status: 'DONE',
          lockedBy: null,
          lockedAt: null,
        },
      },
      { new: true }
    );
  }

  /**
   * Mark task as failed, with retry logic
   */
  async fail(task: ITwitterTask, error: Error): Promise<ITwitterTask | null> {
    const retry = task.attempts < task.maxAttempts;

    return TwitterTaskModel.findByIdAndUpdate(
      task._id,
      {
        $set: {
          status: retry ? 'PENDING' : 'FAILED',
          lastError: error.message,
          lockedBy: null,
          lockedAt: null,
          nextRunAt: retry
            ? new Date(Date.now() + 60_000 * task.attempts) // Exponential backoff
            : undefined,
        },
      },
      { new: true }
    );
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [pending, running, done, failed] = await Promise.all([
      TwitterTaskModel.countDocuments({ status: 'PENDING' }),
      TwitterTaskModel.countDocuments({ status: 'RUNNING' }),
      TwitterTaskModel.countDocuments({ status: 'DONE' }),
      TwitterTaskModel.countDocuments({ status: 'FAILED' }),
    ]);

    return {
      pending,
      running,
      done,
      failed,
      total: pending + running + done + failed,
    };
  }

  /**
   * Recover stale tasks (running for too long)
   */
  async recoverStale(staleDurationMs: number = 5 * 60_000): Promise<number> {
    const result = await TwitterTaskModel.updateMany(
      {
        status: 'RUNNING',
        lockedAt: { $lt: new Date(Date.now() - staleDurationMs) },
      },
      {
        $set: {
          status: 'PENDING',
          lockedBy: null,
          lockedAt: null,
        },
      }
    );

    return result.modifiedCount;
  }
}
