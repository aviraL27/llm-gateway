"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
async function runMigrations() {
    console.log('Starting database migrations...');
    const migrationsDir = path_1.default.join(__dirname, '../migrations');
    try {
        if (!fs_1.default.existsSync(migrationsDir)) {
            throw new Error(`Migrations directory not found at: ${migrationsDir}`);
        }
        const client = await db_1.pool.connect();
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
            const appliedMigrations = new Set(appliedResult.rows.map((row) => row.migration_name));
            // 3. Read migration files and sort them
            const files = fs_1.default.readdirSync(migrationsDir).sort();
            for (const file of files) {
                if (!file.endsWith('.sql'))
                    continue;
                if (appliedMigrations.has(file)) {
                    console.log(`Skipping already applied migration: ${file}`);
                    continue;
                }
                console.log(`Running migration: ${file}`);
                const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf8');
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`✓ Migration ${file} completed successfully.`);
            }
            console.log('✓ All database migrations verified/completed successfully.');
        }
        catch (err) {
            console.error(`❌ Migration runner failed:`, err);
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Migration runner failed:', error);
        throw error;
    }
}
// Run immediately if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runMigrations()
        .then(() => db_1.pool.end())
        .catch((err) => {
        console.error('Migration runner script failed:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map