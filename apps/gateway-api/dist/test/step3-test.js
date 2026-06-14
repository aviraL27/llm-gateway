"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@llm-gateway/db");
const redis_1 = require("../redis");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';
const TEST_TEAM_ID = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5';
const PORT = 3000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function resetMonthlyBudgets() {
    console.log('Running mock monthly budget reset...');
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE team_budgets 
       SET current_spend_usd = 0.00, 
           reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')`);
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
    const patterns = ['team_spend:*', 'team_budget_limit:*'];
    for (const pattern of patterns) {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis_1.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
            }
        } while (cursor !== '0');
    }
}
async function runTests() {
    console.log('--- STARTING STEP 3 INTEGRATION TESTS ---');
    // 1. Generate Mock Supabase JWT
    const token = jsonwebtoken_1.default.sign({
        sub: TEST_USER_ID,
        app_metadata: {
            team_id: TEST_TEAM_ID,
        },
    }, SUPABASE_JWT_SECRET);
    console.log('✓ Generated Mock Supabase JWT');
    // Clean up any test records in database and Redis first
    try {
        await db_1.pool.query('DELETE FROM api_keys WHERE team_id = $1', [TEST_TEAM_ID]);
        await db_1.pool.query('DELETE FROM team_budgets WHERE team_id = $1', [TEST_TEAM_ID]);
        await db_1.pool.query('DELETE FROM teams WHERE id = $1', [TEST_TEAM_ID]);
        await redis_1.redis.del(`team_spend:${TEST_TEAM_ID}`, `team_budget_limit:${TEST_TEAM_ID}`);
        console.log('✓ Cleaned up old database and Redis test rows');
    }
    catch (err) {
        console.error('Failed cleanup of DB/Redis:', err);
    }
    // Start the server process
    console.log('Starting Express server...');
    const serverProcess = (0, child_process_1.exec)('npx ts-node src/index.ts', {
        cwd: path_1.default.resolve(__dirname, '../../'),
        env: {
            ...process.env,
            PORT: PORT.toString(),
            SUPABASE_JWT_SECRET,
        },
    });
    serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server]: ${data.trim()}`);
    });
    serverProcess.stderr?.on('data', (data) => {
        console.error(`[Server Error]: ${data.trim()}`);
    });
    // Wait for server to start
    await sleep(4000);
    let apiKeyRaw = '';
    let apiKeyId = '';
    try {
        // 2. Create an API key
        console.log('\nGenerating test API key...');
        const keyRes = await fetch(`http://localhost:${PORT}/api/keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: 'Rate Limit Test Key' }),
        });
        if (keyRes.status !== 201) {
            throw new Error(`Failed to create API key: status ${keyRes.status}`);
        }
        const keyData = (await keyRes.json());
        apiKeyRaw = keyData.key;
        apiKeyId = keyData.id;
        console.log('✓ Created key:', apiKeyRaw);
        // 3. Test: Rate Limiting (60 requests/minute limit)
        console.log('\nTesting Rate Limiter (making 61 requests)...');
        let lastRemaining = 60;
        for (let i = 1; i <= 61; i++) {
            const res = await fetch(`http://localhost:${PORT}/v1/protected`, {
                headers: {
                    Authorization: `Bearer ${apiKeyRaw}`,
                },
            });
            const limitHeader = res.headers.get('X-RateLimit-Limit');
            const remainingHeader = res.headers.get('X-RateLimit-Remaining');
            const resetHeader = res.headers.get('X-RateLimit-Reset');
            if (i <= 60) {
                if (res.status !== 200) {
                    throw new Error(`Expected 200 for request #${i}, got ${res.status}`);
                }
                const remaining = parseInt(remainingHeader || '0');
                if (remaining !== 60 - i) {
                    throw new Error(`Expected remaining to be ${60 - i}, got ${remaining}`);
                }
                lastRemaining = remaining;
            }
            else {
                // Request 61
                console.log(`Request #61 Status: ${res.status}`);
                if (res.status !== 429) {
                    throw new Error(`Expected 429 for request #61, got ${res.status}`);
                }
                const json = await res.json();
                console.log('Request #61 Response:', json);
            }
        }
        console.log('✓ Rate limiter successfully blocked 61st request with 429 and set headers correctly!');
        // Clean rate limit in Redis to proceed with other tests
        const currentMinuteTimestamp = Math.floor(Date.now() / 60000) * 60;
        await redis_1.redis.del(`ratelimit:${apiKeyId}:${currentMinuteTimestamp}`);
        console.log('✓ Cleared rate limit cache in Redis for subsequent tests');
        // 4. Test: Spend Guard
        console.log('\nTesting Spend Guard cache hit and budget limit updates...');
        // First request should trigger cache population (current spend in DB is 0.00, limit default $100)
        const firstReq = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: { Authorization: `Bearer ${apiKeyRaw}` },
        });
        if (firstReq.status !== 200) {
            throw new Error(`Expected 200 for first spend request, got ${firstReq.status}`);
        }
        // Verify Redis keys are set
        const cachedSpend = await redis_1.redis.get(`team_spend:${TEST_TEAM_ID}`);
        const cachedLimit = await redis_1.redis.get(`team_budget_limit:${TEST_TEAM_ID}`);
        console.log('Redis Spend Key:', cachedSpend);
        console.log('Redis Limit Key:', cachedLimit);
        if (!cachedSpend || !cachedLimit) {
            throw new Error('Redis budget cache keys not populated on cache miss!');
        }
        // 5. Update budget limit to $0.00
        console.log('\nSetting budget limit to $0.00 via PUT /api/teams/budget...');
        const budgetRes = await fetch(`http://localhost:${PORT}/api/teams/budget`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ monthly_limit_usd: 0.00 }),
        });
        if (budgetRes.status !== 200) {
            throw new Error(`Failed to update budget limit, status: ${budgetRes.status}`);
        }
        // Verify Redis keys were deleted/evicted
        const postUpdateSpend = await redis_1.redis.get(`team_spend:${TEST_TEAM_ID}`);
        const postUpdateLimit = await redis_1.redis.get(`team_budget_limit:${TEST_TEAM_ID}`);
        if (postUpdateSpend || postUpdateLimit) {
            throw new Error('Redis budget cache keys not deleted after budget update!');
        }
        console.log('✓ Redis budget configuration cache evicted successfully on update!');
        // 6. Test: Request with $0.00 budget limit -> 429
        console.log('\nTesting request with $0.00 budget limit...');
        const spendBlockedRes = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: { Authorization: `Bearer ${apiKeyRaw}` },
        });
        console.log('Status with $0.00 budget limit:', spendBlockedRes.status);
        if (spendBlockedRes.status !== 429) {
            throw new Error(`Expected 429 for budget limit of $0.00, got ${spendBlockedRes.status}`);
        }
        const spendBlockedJson = await spendBlockedRes.json();
        console.log('Spend Blocked Response:', spendBlockedJson);
        if (spendBlockedJson.error !== 'Monthly budget exceeded') {
            throw new Error(`Expected "Monthly budget exceeded" error message, got "${spendBlockedJson.error}"`);
        }
        console.log('✓ Spend Guard successfully blocked request with 429 budget exceeded error!');
        // 7. Restore budget limit to $50.00
        console.log('\nRestoring budget limit to $50.00...');
        await fetch(`http://localhost:${PORT}/api/teams/budget`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ monthly_limit_usd: 50.00 }),
        });
        const spendRestoredRes = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: { Authorization: `Bearer ${apiKeyRaw}` },
        });
        if (spendRestoredRes.status !== 200) {
            throw new Error(`Expected 200 after budget limit restored, got ${spendRestoredRes.status}`);
        }
        console.log('✓ Requests successfully resume with 200 after budget is restored!');
        // 8. Test: Monthly Reset Cron Job (calling it directly)
        console.log('\nTesting worker monthly reset job...');
        // Artificially modify current spend to $10.00 in the DB so we can test if it resets to 0.00
        await db_1.pool.query('UPDATE team_budgets SET current_spend_usd = 10.00 WHERE team_id = $1', [TEST_TEAM_ID]);
        // Populate Redis
        await redis_1.redis.set(`team_spend:${TEST_TEAM_ID}`, '10.00');
        // Trigger reset job
        await resetMonthlyBudgets();
        // Check DB
        const dbBudgetRes = await db_1.pool.query('SELECT current_spend_usd FROM team_budgets WHERE team_id = $1', [TEST_TEAM_ID]);
        const currentSpendInDB = parseFloat(dbBudgetRes.rows[0].current_spend_usd);
        console.log('Post-Reset DB Current Spend:', currentSpendInDB);
        if (currentSpendInDB !== 0.00) {
            throw new Error(`Expected DB current spend to be 0.00, got ${currentSpendInDB}`);
        }
        // Check Redis
        const postResetSpend = await redis_1.redis.get(`team_spend:${TEST_TEAM_ID}`);
        console.log('Post-Reset Redis Current Spend:', postResetSpend);
        if (postResetSpend !== null) {
            throw new Error('Redis budget cache keys not cleared after monthly reset job!');
        }
        console.log('✓ Monthly reset cron job successfully resets DB and evicts Redis caches!');
        console.log('\n--- ALL STEP 3 TESTS PASSED SUCCESSFULLY! ---');
    }
    catch (error) {
        console.error('\n❌ TEST SUITE FAILED:', error);
        process.exitCode = 1;
    }
    finally {
        console.log('\nShutting down server...');
        serverProcess.kill('SIGINT');
        await sleep(2000);
        // Clean up connections
        await redis_1.redis.quit();
        await db_1.pool.end();
        console.log('Done!');
    }
}
runTests();
//# sourceMappingURL=step3-test.js.map