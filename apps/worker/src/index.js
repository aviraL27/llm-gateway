"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMonthlyBudgets = resetMonthlyBudgets;
const dotenv_1 = __importDefault(require("dotenv"));
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("@llm-gateway/db");
dotenv_1.default.config();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
const connection = new ioredis_1.default(REDIS_URL, { maxRetriesPerRequest: null });
console.log('Worker starting...');
// BullMQ Worker
const worker = new bullmq_1.Worker('request-logs', async (job) => {
    console.log(`Processing job ${job.id} of type ${job.name}...`);
    // Placeholder for worker logic
    return { status: 'processed' };
}, {
    connection,
    concurrency: 5,
});
worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});
worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
});
// Monthly Reset Job helper
async function resetMonthlyBudgets() {
    console.log('Running monthly budget reset cron job...');
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Update budgets in database
        await client.query(`UPDATE team_budgets 
       SET current_spend_usd = 0.00, 
           reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')`);
        await client.query('COMMIT');
        console.log('✓ Successfully reset monthly budgets in the database.');
    }
    catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Failed to reset monthly budgets in database:', dbError);
    }
    finally {
        client.release();
    }
    try {
        // Clear Redis team spend and limit keys using SCAN
        const patterns = ['team_spend:*', 'team_budget_limit:*'];
        for (const pattern of patterns) {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await connection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    await connection.del(...keys);
                    console.log(`✓ Deleted Redis keys: ${keys.join(', ')}`);
                }
            } while (cursor !== '0');
        }
        console.log('✓ Successfully cleared monthly budget caches from Redis.');
    }
    catch (redisError) {
        console.error('Failed to clear budget caches from Redis:', redisError);
    }
}
// Schedule Monthly Reset Job: 00:00 on the 1st of every month
node_cron_1.default.schedule('0 0 1 * *', async () => {
    try {
        await resetMonthlyBudgets();
    }
    catch (error) {
        console.error('Error in monthly reset cron job:', error);
    }
});
// For testing purposes: log registration
console.log('✓ Monthly reset cron job scheduled (00:00 on the 1st of every month)');
//# sourceMappingURL=index.js.map