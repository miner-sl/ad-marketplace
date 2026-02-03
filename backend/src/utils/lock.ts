import Redlock from 'redlock';
import getRedisClient from './redis';
import logger from './logger';

export type LockOperation = 
  | 'confirm_payment'
  | 'release_funds'
  | 'publish_post'
  | 'auto_release'
  | 'accept_deal'
  | 'cancel_deal';

export interface LockOptions {
  ttl?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
}

/**
 * Distributed lock service using Redlock algorithm
 * Redlock provides distributed locking across multiple Redis instances
 * 
 * Lock key format: deal:{dealId}:operation:{operationType}
 * Lock value: Unique lock ID (for safe release)
 * TTL: Auto-release after expiration (prevents deadlocks)
 * 
 * Features:
 * - Works with single or multiple Redis instances
 * - Automatic retry with exponential backoff
 * - Lock extension support
 * - Deadlock prevention via TTL
 */
export class DistributedLock {
  private redlock: Redlock;
  private readonly defaultTTL = 30000;
  private readonly defaultRetryDelay = 100;
  private readonly defaultMaxRetries = 0

  constructor() {
    const redis = getRedisClient();
    
    this.redlock = new Redlock(
      [redis],
      {
        driftFactor: 0.01,

        // The max number of times Redlock will attempt to lock a resource before erroring
        retryCount: 0, // Default: fail-fast (no retries)

        // The time in ms between attempts
        retryDelay: this.defaultRetryDelay,

        // The max time in ms randomly added to retries
        // This improves performance under high contention
        retryJitter: 50,

        // The minimum remaining time on a lock before an extension is automatically
        // performed with the `using` API
        automaticExtensionThreshold: 500, // 500ms = 0.5s
      }
    );

    this.redlock.on('error', (error) => {
      logger.error('Redlock error', {
        error: error.message,
        stack: error.stack,
      });
    });
  }

  /**
   * Acquire a distributed lock
   * @param dealId Deal ID
   * @param operation Operation type
   * @param options Lock options
   * @returns Lock result with lockId if acquired
   */
  async acquire(
    dealId: number,
    operation: LockOperation,
    options: LockOptions = {}
  ): Promise<LockResult> {
    const lockKey = `deal:${dealId}:operation:${operation}`;
    const ttl = options.ttl || this.defaultTTL;
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const retryDelay = options.retryDelay || this.defaultRetryDelay;

    // Create temporary Redlock instance with custom retry settings if needed
    // Redlock v5 acquire() doesn't take retry options, so we create a new instance
    let redlockInstance = this.redlock;
    
    if (maxRetries > 0) {
      const redis = getRedisClient();
      redlockInstance = new Redlock(
        [redis],
        {
          driftFactor: 0.01,
          retryCount: maxRetries,
          retryDelay: retryDelay,
          retryJitter: 50,
          automaticExtensionThreshold: 500,
        }
      );
    }

    try {
      // Acquire lock using Redlock
      // acquire(resources: string[], duration: number): Promise<Lock>
      const lock = await redlockInstance.acquire([lockKey], ttl);

      logger.debug(`Lock acquired`, {
        lockKey,
        lockId: lock.value,
        dealId,
        operation,
        ttl,
      });

      return { 
        acquired: true, 
        lockId: lock.value // Redlock provides unique lock value
      };
    } catch (error: any) {
      // Redlock throws error if lock cannot be acquired
      if (error.name === 'LockError' || 
          error.message?.includes('unable to acquire') ||
          error.message?.includes('already locked')) {
        logger.debug(`Failed to acquire lock`, {
          lockKey,
          dealId,
          operation,
          error: error.message,
        });
        return { acquired: false };
      }

      // For other errors (Redis connection issues), log and fail open
      logger.error(`Error acquiring lock`, {
        lockKey,
        dealId,
        operation,
        error: error.message,
      });

      // If Redis is unavailable, fail open (allow operation to proceed)
      // Database-level locks will still provide protection
      if (error.message?.includes('ECONNREFUSED') || 
          error.message?.includes('Connection is closed') ||
          error.message?.includes('Connection lost')) {
        logger.warn(`Redis unavailable, proceeding without distributed lock`, {
          lockKey,
          dealId,
          operation,
        });
        return { acquired: true, lockId: 'redis-unavailable' };
      }

      throw error;
    }
  }

  /**
   * Release a distributed lock
   * Note: For manual lock management, you need to store the Lock instance from acquire()
   * and call lock.release() on it. This method is kept for API compatibility but
   * withLock() is the recommended approach as it handles release automatically.
   * 
   * @param dealId Deal ID
   * @param operation Operation type
   * @param lockId Lock ID returned from acquire() (not used, kept for API compatibility)
   */
  async release(
    dealId: number,
    operation: LockOperation,
    lockId: string
  ): Promise<void> {
    // If lockId is 'redis-unavailable', skip release (lock was never acquired)
    if (lockId === 'redis-unavailable') {
      return;
    }

    const lockKey = `deal:${dealId}:operation:${operation}`;

    try {
      // Note: Redlock requires the Lock instance to release
      // Since we don't store it here, the lock will expire via TTL
      // For proper release, use withLock() which handles it automatically
      logger.debug(`Lock release requested (will expire via TTL)`, {
        lockKey,
        lockId,
        dealId,
        operation,
      });
      
      // Lock will expire automatically via TTL
    } catch (error: any) {
      logger.error(`Error releasing lock`, {
        lockKey,
        lockId,
        dealId,
        operation,
        error: error.message,
      });
      // Don't throw - lock will expire automatically via TTL
    }
  }

  /**
   * Execute a function with a distributed lock
   * Automatically acquires lock, executes function, and releases lock
   * @param dealId Deal ID
   * @param operation Operation type
   * @param fn Function to execute
   * @param options Lock options
   * @returns Result of function execution
   * @throws Error if lock cannot be acquired (fail-fast mode)
   */
  async withLock<T>(
    dealId: number,
    operation: LockOperation,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const lockKey = `deal:${dealId}:operation:${operation}`;
    const ttl = options.ttl || this.defaultTTL;
    const retryDelay = options.retryDelay || this.defaultRetryDelay;
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;

    // Create a temporary Redlock instance with custom retry settings if needed
    // For retry support, we'll need to create a new Redlock instance with custom settings
    let redlockInstance = this.redlock;
    
    if (maxRetries > 0) {
      const redis = getRedisClient();
      redlockInstance = new Redlock(
        [redis],
        {
          driftFactor: 0.01,
          retryCount: maxRetries,
          retryDelay: retryDelay,
          retryJitter: 50,
          automaticExtensionThreshold: 500,
        }
      );
    }

    try {
      // Use Redlock's using method which automatically handles lock acquisition and release
      // using(resources: string[], duration: number, settings?, fn): Promise<T>
      return await redlockInstance.using(
        [lockKey],
        ttl,
        async (signal) => {
          logger.debug(`Lock acquired for operation`, {
            lockKey,
            dealId,
            operation,
            ttl,
          });

          const result = await fn();

          if (signal.aborted) {
            logger.warn(`Lock was lost during operation execution`, {
              lockKey,
              dealId,
              operation,
            });
            throw new Error(`Lock was lost during operation execution for deal ${dealId}, operation ${operation}`);
          }

          return result;
        }
      );
    } catch (error: any) {
      // Redlock throws LockError if lock cannot be acquired
      if (error.name === 'LockError' || 
          error.message?.includes('unable to acquire') ||
          error.message?.includes('already locked')) {
        throw new Error(
          `Failed to acquire distributed lock for deal ${dealId}, operation ${operation}. ` +
          `Another process may be processing this operation.`
        );
      }

      // For Redis connection errors, fail open
      if (error.message?.includes('ECONNREFUSED') || 
          error.message?.includes('Connection is closed') ||
          error.message?.includes('Connection lost')) {
        logger.warn(`Redis unavailable, proceeding without distributed lock`, {
          lockKey,
          dealId,
          operation,
        });
        // Execute function without lock (database locks still protect)
        return await fn();
      }

      throw error;
    }
  }

  /**
   * Check if a lock exists (for monitoring/debugging)
   * @param dealId Deal ID
   * @param operation Operation type
   * @returns true if lock exists, false otherwise
   */
  async exists(dealId: number, operation: LockOperation): Promise<boolean> {
    const lockKey = `deal:${dealId}:operation:${operation}`;
    try {
      const redis = getRedisClient();
      const result = await redis.exists(lockKey);
      return result === 1;
    } catch (error: any) {
      logger.error(`Error checking lock existence`, {
        lockKey,
        dealId,
        operation,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get Redlock instance (for advanced usage)
   */
  getRedlock(): Redlock {
    return this.redlock;
  }
}

// Export singleton instance
export const distributedLock = new DistributedLock();
