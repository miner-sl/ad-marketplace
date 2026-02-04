/**
 * Health check script for cron service
 * Checks database connectivity
 */
import db from '../db/connection';

async function healthCheck() {
  try {
    await db.query('SELECT 1');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

void healthCheck();
