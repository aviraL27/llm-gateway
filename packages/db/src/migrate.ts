import fs from 'fs';
import path from 'path';
import { pool } from './db';

async function migrate() {
  console.log('Starting database migrations...');
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✓ Migration ${file} completed successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${file} failed:`, err);
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('✓ All database migrations completed successfully.');
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
