import Redis from 'ioredis';
import logger from './logger';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 * Uses singleton pattern to ensure single connection pool
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      enableOfflineQueue: false, // Don't queue commands when offline
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export default getRedisClient;
