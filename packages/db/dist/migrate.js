"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
async function migrate() {
    console.log('Starting database migrations...');
    const migrationsDir = path_1.default.join(__dirname, '../migrations');
    try {
        if (!fs_1.default.existsSync(migrationsDir)) {
            throw new Error(`Migrations directory not found at: ${migrationsDir}`);
        }
        const files = fs_1.default.readdirSync(migrationsDir).sort();
        for (const file of files) {
            if (!file.endsWith('.sql'))
                continue;
            console.log(`Running migration: ${file}`);
            const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf8');
            const client = await db_1.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`✓ Migration ${file} completed successfully.`);
            }
            catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Migration ${file} failed:`, err);
                throw err;
            }
            finally {
                client.release();
            }
        }
        console.log('✓ All database migrations completed successfully.');
    }
    catch (error) {
        console.error('Migration runner failed:', error);
        process.exit(1);
    }
    finally {
        await db_1.pool.end();
    }
}
migrate();
//# sourceMappingURL=migrate.js.map