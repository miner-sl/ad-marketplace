import * as fs from 'fs';
import * as path from 'path';
import db from './connection';

async function runMigrations() {
  try {
    // Try source directory first (for tsx), then dist directory (for compiled)
    let migrationsDir = path.join(__dirname, 'migrations');
    
    // If running from dist, try to find source migrations
    if (!fs.existsSync(migrationsDir) && __dirname.includes('dist')) {
      const sourceDir = path.join(__dirname, '../../src/db/migrations');
      if (fs.existsSync(sourceDir)) {
        migrationsDir = sourceDir;
      }
    }
    
    if (!fs.existsSync(migrationsDir)) {
      console.log(`No migrations directory found. Checked: ${migrationsDir}`);
      return;
    }

    // Get all migration files sorted by name
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('No migration files found');
      return;
    }

    console.log(`Found ${migrationFiles.length} migration(s)`);

    // Create migrations tracking table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Execute each migration
    for (const filename of migrationFiles) {
      // Check if migration already executed
      const checkResult = await db.query(
        'SELECT * FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration: ${filename}`);

      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Execute migration
      await db.query(migrationSQL);

      // Record migration
      await db.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename]
      );

      console.log(`✅ Completed: ${filename}`);
    }

    console.log('✅ All migrations completed successfully');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export { runMigrations };
