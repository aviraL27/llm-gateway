import fs from 'fs';
import path from 'path';
import { pool } from './db';

export async function runMigrations() {
  console.log('Starting database migrations...');
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const client = await pool.connect();
    try {
      // 1. Create schema_migrations table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_name VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 2. Fetch applied migrations
      const appliedResult = await client.query('SELECT migration_name FROM schema_migrations');
      const appliedMigrations = new Set(appliedResult.rows.map((row: any) => row.migration_name));

      // 3. Read migration files and sort them
      const files = fs.readdirSync(migrationsDir).sort();

      for (const file of files) {
        if (!file.endsWith('.sql')) continue;

        if (appliedMigrations.has(file)) {
          console.log(`Skipping already applied migration: ${file}`);
          continue;
        }

        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ Migration ${file} completed successfully.`);
      }

      console.log('✓ All database migrations verified/completed successfully.');
    } catch (err) {
      console.error(`❌ Migration runner failed:`, err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Migration runner failed:', error);
    throw error;
  }
}

// Run immediately if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration runner script failed:', err);
      process.exit(1);
    });
}

