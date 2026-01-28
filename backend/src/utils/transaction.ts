import { PoolClient } from 'pg';
import db from '../db/connection';
import logger from './logger';

/**
 * Execute a function within a database transaction
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release
 * 
 * @param callback Function that receives a database client and returns a promise
 * @returns Promise with the result of the callback
 */
export async function withTx<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a function within a database transaction with retry logic
 * Useful for handling transient database errors
 * 
 * @param callback Function that receives a database client and returns a promise
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param retryDelayMs Delay between retries in milliseconds (default: 1000)
 * @returns Promise with the result of the callback
 */
export async function withTxRetry<T>(
  callback: (client: PoolClient) => Promise<T>,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withTx(callback);
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (e.g., validation errors, not found)
      if (error.message?.includes('not found') || 
          error.message?.includes('unauthorized') ||
          error.message?.includes('Cannot') ||
          error.message?.includes('already')) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const waitTime = retryDelayMs * (attempt + 1);
        logger.warn(`Transaction failed, retrying...`, {
          attempt: attempt + 1,
          maxRetries,
          waitTime,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Transaction failed after retries');
}
