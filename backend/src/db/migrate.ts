import * as fs from 'fs';
import * as path from 'path';
import db from './connection';

async function migrate() {
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema (split by semicolons for multiple statements)
    // Handle DO $$ blocks specially since they contain semicolons
    const statements: string[] = [];
    let currentStatement = '';
    let inDoBlock = false;
    let dollarTag = '';

    // Remove comments first
    const schemaWithoutComments = schema
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    // Split by semicolon but preserve DO blocks
    const parts = schemaWithoutComments.split(';');

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      // Check if this part starts a DO block
      if (part.match(/^DO\s+\$\$/) || part.match(/^DO\s+\$[a-zA-Z_]*\$/)) {
        inDoBlock = true;
        const match = part.match(/\$([a-zA-Z_]*)\$/);
        dollarTag = match ? match[1] : '';
        currentStatement = part;
        continue;
      }

      // If we're in a DO block, accumulate until we find END
      if (inDoBlock) {
        currentStatement += ';' + part;

        // Check if this part ends the DO block
        if (part.match(/^\s*END\s*$/) || part.match(new RegExp(`^\\s*END\\s*\\$${dollarTag}\\$\\s*$`))) {
          statements.push(currentStatement);
          currentStatement = '';
          inDoBlock = false;
          dollarTag = '';
        }
        continue;
      }

      // Regular statement
      if (currentStatement) {
        currentStatement += ';' + part;
      } else {
        currentStatement = part;
      }

      statements.push(currentStatement);
      currentStatement = '';
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement);
    }

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        const finalStatement = trimmed.endsWith(';') ? trimmed : trimmed + ';';
        console.log('Executing:', finalStatement.substring(0, 100) + (finalStatement.length > 100 ? '...' : ''));
        await db.query(finalStatement);
      }
    }

    console.log('✅ Database migration completed successfully');
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
  void migrate();
}
