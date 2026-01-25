import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Parse DATABASE_URL or use individual components
function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  // Fallback to individual environment variables (useful for Docker)
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ad_marketplace',
    user: process.env.DB_USER || 'admarketplace',
    password: process.env.DB_PASSWORD || 'admarketplace123',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

const pool = new Pool(getPoolConfig());

// Handle connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Set timezone to UTC on each new connection
pool.on('connect', async (client: PoolClient) => {
  try {
    await client.query('SET timezone = UTC');
  } catch (error) {
    console.error('Error setting timezone to UTC:', error);
  }
});

export const db = {
  query: async (text: string, params?: any[]) => {
    // All queries will use UTC timezone (set on connection)
    const result = await pool.query(text, params);
    return result;
  },
  getClient: async (): Promise<PoolClient> => {
    const client = await pool.connect();
    // Ensure UTC timezone for this client
    await client.query('SET timezone = UTC');
    return client;
  },
  pool,
};

export default db;
