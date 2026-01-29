#!/usr/bin/env tsx
/**
 * Test database connection
 * Usage: npm run db:test
 */

import * as dotenv from 'dotenv';
import db from '../db/connection';

dotenv.config();

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test basic connection
    const result = await db.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Database connection successful!');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${result.rows[0].postgres_version.split(',')[0]}\n`);
    
    // Check if schema_migrations table exists
    const migrationsCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      )
    `);
    
    if (migrationsCheck.rows[0].exists) {
      const executedMigrations = await db.query('SELECT filename, executed_at FROM schema_migrations ORDER BY executed_at');
      console.log(`📋 Executed migrations (${executedMigrations.rows.length}):`);
      executedMigrations.rows.forEach((m: any) => {
        console.log(`   - ${m.filename} (${m.executed_at})`);
      });
    } else {
      console.log('📋 No migrations have been executed yet');
    }
    
    // Check if escrow_wallets table exists
    const escrowCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'escrow_wallets'
      )
    `);
    
    console.log(`\n💼 Escrow wallets table: ${escrowCheck.rows[0].exists ? '✅ Exists' : '❌ Not found'}`);
    
    if (escrowCheck.rows[0].exists) {
      const walletCount = await db.query('SELECT COUNT(*) as count FROM escrow_wallets');
      console.log(`   Wallets stored: ${walletCount.rows[0].count}`);
    }
    
    console.log('\n✅ Database connection test completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Database connection failed!');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Tip: Make sure PostgreSQL is running');
      console.error('   Try: pg_isready (for local) or docker ps (for Docker)\n');
    } else if (error.code === '28P01') {
      console.error('💡 Tip: Check database credentials in .env file\n');
    } else if (error.code === '3D000') {
      console.error('💡 Tip: Database does not exist. Create it first:\n');
      console.error('   CREATE DATABASE ad_marketplace;\n');
    }
    
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  testConnection();
}

export { testConnection };
