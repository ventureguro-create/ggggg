// B3 Integration - Runtime Dispatcher
// Connects Execution Core (B2) with Runtime Layer (B3)
// Replaces direct HTTP calls with runtime abstraction

import { ParserInstance, ParserTask, ExecutionResult, ExecutionErrorCodes } from './types.js';
import {
  createTwitterRuntime,
  TwitterRuntime,
  RuntimeResponse,
  RuntimeStatus,
  runtimeRegistry,
  runtimeHealthService,
  SlotConfig,
} from '../runtime/index.js';

/**
 * Convert ParserInstance to SlotConfig for runtime factory
 */
function toSlotConfig(instance: ParserInstance): SlotConfig {
  return {
    id: instance.id,
    type: instance.kind as any,
    accountId: instance.accountId,
    baseUrl: instance.baseUrl,
    proxyUrl: instance.proxyUrl,
    worker: instance.baseUrl ? { baseUrl: instance.baseUrl } : undefined,
    proxy: instance.proxyUrl ? { url: instance.proxyUrl } : undefined,
  };
}

/**
 * Convert RuntimeResponse to ExecutionResult
 */
function toExecutionResult(
  response: RuntimeResponse<any>,
  instance: ParserInstance,
  task: ParserTask,
  duration: number
): ExecutionResult {
  if (response.ok) {
    return {
      ok: true,
      data: response.data,
      meta: {
        accountId: instance.accountId || 'unknown',
        instanceId: instance.id,
        taskId: task.id,
        duration,
      },
    };
  }

  // Map runtime status to error code
  let errorCode = ExecutionErrorCodes.REMOTE_ERROR;
  switch (response.status) {
    case 'RATE_LIMITED':
      errorCode = ExecutionErrorCodes.SLOT_RATE_LIMITED;
      break;
    case 'AUTH_REQUIRED':
      errorCode = ExecutionErrorCodes.REMOTE_ERROR;
      break;
    case 'DOWN':
      errorCode = ExecutionErrorCodes.REMOTE_ERROR;
      break;
  }

  return {
    ok: false,
    error: response.error || 'Unknown runtime error',
    errorCode,
    meta: {
      accountId: instance.accountId || 'unknown',
      instanceId: instance.id,
      taskId: task.id,
      duration,
    },
  };
}

export class RuntimeDispatcher {
  /**
   * Dispatch task using Runtime Layer
   */
  async dispatch(
    instance: ParserInstance,
    task: ParserTask
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Get or create runtime for this slot
      let runtime = runtimeRegistry.getRuntime(instance.id);
      
      if (!runtime) {
        const config = toSlotConfig(instance);
        runtime = createTwitterRuntime(config);
        runtimeRegistry.register(instance.id, runtime);
        
        // Initial health check
        const health = await runtimeHealthService.check(runtime);
        runtimeRegistry.setHealth(instance.id, health);
      }

      // Execute task based on type
      let response: RuntimeResponse<any>;

      switch (task.type) {
        case 'SEARCH':
          response = await runtime.fetchTweetsByKeyword({
            keyword: task.payload.q || task.payload.query || task.payload.keyword,
            limit: task.payload.limit || task.payload.maxResults || 20,
          });
          break;

        case 'ACCOUNT_TWEETS':
          response = await runtime.fetchAccountTweets(
            task.payload.username,
            task.payload.limit || task.payload.maxResults || 20
          );
          break;

        case 'FOLLOWING':
          // Use fetchFollowing if available in runtime interface
          if (typeof (runtime as any).fetchFollowing === 'function') {
            response = await (runtime as any).fetchFollowing(
              task.payload.username,
              task.payload.limit || 50
            );
          } else {
            // Fallback: direct HTTP call to parser service
            response = await this.fetchFollowingDirect(task.payload.username, task.payload.limit || 50);
          }
          break;

        case 'FOLLOWERS':
          // Direct HTTP call to parser service for followers
          response = await this.fetchFollowersDirect(task.payload.username, task.payload.limit || 50);
          break;

        case 'ACCOUNT_FOLLOWERS':
          // Legacy endpoint - redirect to FOLLOWERS
          response = await this.fetchFollowersDirect(task.payload.username, task.payload.limit || 50);
          break;

        default:
          response = {
            ok: false,
            status: 'ERROR',
            error: `Unknown task type: ${task.type}`,
          };
      }

      const duration = Date.now() - startTime;

      // Update health based on response
      if (!response.ok) {
        const currentHealth = runtimeRegistry.getHealth(instance.id);
        if (currentHealth) {
          currentHealth.status = response.status;
          currentHealth.lastCheckedAt = Date.now();
          currentHealth.error = response.error;
        }
      }

      return toExecutionResult(response, instance, task, duration);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      return {
        ok: false,
        error: error?.message || 'Dispatch error',
        errorCode: ExecutionErrorCodes.REMOTE_ERROR,
        meta: {
          accountId: instance.accountId || 'unknown',
          instanceId: instance.id,
          taskId: task.id,
          duration,
        },
      };
    }
  }

  /**
   * Check health of a slot's runtime
   */
  async checkHealth(instance: ParserInstance): Promise<RuntimeStatus> {
    let runtime = runtimeRegistry.getRuntime(instance.id);
    
    if (!runtime) {
      const config = toSlotConfig(instance);
      runtime = createTwitterRuntime(config);
      runtimeRegistry.register(instance.id, runtime);
    }

    const health = await runtimeHealthService.check(runtime);
    runtimeRegistry.setHealth(instance.id, health);
    
    return health.status;
  }

  /**
   * Get all runtime health statuses
   */
  getRuntimeHealthSummary() {
    return runtimeRegistry.getSummary();
  }
}

// Singleton export
export const runtimeDispatcher = new RuntimeDispatcher();

/**
 * Direct HTTP call to parser for following list
 */
RuntimeDispatcher.prototype.fetchFollowingDirect = async function(
  username: string,
  limit: number = 50
): Promise<RuntimeResponse<any>> {
  const PARSER_URL = process.env.PARSER_URL || 'http://localhost:5001';
  
  try {
    // Get cookies from session service
    const { sessionService } = await import('../sessions/session.service.js');
    const session = await sessionService.selectSession('SYSTEM');
    
    if (!session) {
      return {
        ok: false,
        status: 'AUTH_REQUIRED',
        error: 'No active session available for following parsing',
      };
    }
    
    const response = await fetch(`${PARSER_URL}/following/${username}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookies: session.cookies,
        limit,
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return {
        ok: true,
        status: 'HEALTHY',
        data: data.data,
      };
    }
    
    return {
      ok: false,
      status: response.status === 429 ? 'RATE_LIMITED' : 'ERROR',
      error: data.error || 'Parser error',
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 'DOWN',
      error: error.message,
    };
  }
};

/**
 * Direct HTTP call to parser for followers list
 */
RuntimeDispatcher.prototype.fetchFollowersDirect = async function(
  username: string,
  limit: number = 50
): Promise<RuntimeResponse<any>> {
  const PARSER_URL = process.env.PARSER_URL || 'http://localhost:5001';
  
  try {
    // Get cookies from session service
    const { sessionService } = await import('../sessions/session.service.js');
    const session = await sessionService.selectSession('SYSTEM');
    
    if (!session) {
      console.log('[fetchFollowersDirect] No session available');
      return {
        ok: false,
        status: 'AUTH_REQUIRED',
        error: 'No active session available for followers parsing',
      };
    }
    
    console.log(`[fetchFollowersDirect] Fetching followers for @${username} with ${session.cookies?.length || 0} cookies`);
    
    const response = await fetch(`${PARSER_URL}/followers/${username}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookies: session.cookies,
        limit,
      }),
    });
    
    const data = await response.json();
    console.log(`[fetchFollowersDirect] Response for @${username}: ok=${data.ok}, followers=${data.data?.followers?.length || 0}`);
    
    if (data.ok) {
      return {
        ok: true,
        status: 'HEALTHY',
        data: data.data,
      };
    }
    
    return {
      ok: false,
      status: response.status === 429 ? 'RATE_LIMITED' : 'ERROR',
      error: data.error || 'Parser error',
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 'DOWN',
      error: error.message,
    };
  }
};
