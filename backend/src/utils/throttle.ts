import getRedisClient from './redis';
import logger from './logger';

/**
 * Throttle function calls using Redis
 * Prevents calling the same function too frequently
 * 
 * @param key - Unique key for throttling (e.g., `validate:${userId}:${channelName}`)
 * @param ttlSeconds - Time to live in seconds (default: 5 seconds)
 * @returns true if call is allowed, false if throttled
 */
export async function throttle(
  key: string,
  ttlSeconds: number = 5
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const throttleKey = `throttle:${key}`;
    
    // Check if key exists
    const exists = await redis.exists(throttleKey);
    
    if (exists) {
      // Throttled - return false
      const ttl = await redis.ttl(throttleKey);
      logger.debug(`Request throttled for key: ${key}, TTL: ${ttl}s`);
      return false;
    }
    
    // Set key with TTL
    await redis.setex(throttleKey, ttlSeconds, '1');
    return true;
  } catch (error: any) {
    // If Redis fails, allow the request (fail open)
    logger.warn(`Throttle check failed for key: ${key}`, {
      error: error.message,
    });
    return true;
  }
}

/**
 * Throttle per user and channel name
 * @param userId - User ID
 * @param channelName - Channel name/username
 * @param ttlSeconds - Throttle duration in seconds (default: 5)
 */
export async function throttleChannelValidate(
  userId: number,
  channelName: string,
  ttlSeconds: number = 5
): Promise<boolean> {
  const key = `channel_validate:${userId}:${channelName.toLowerCase()}`;
  return throttle(key, ttlSeconds);
}
