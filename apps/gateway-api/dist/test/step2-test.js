"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@llm-gateway/db");
const redis_1 = require("../redis");
const auth_1 = require("../middlewares/auth");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const PORT = 3000;
// Helper to delay execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runTests() {
    console.log('--- STARTING STEP 2 INTEGRATION TESTS ---');
    // 1. Generate Mock Supabase JWT
    const payload = {
        sub: TEST_USER_ID,
        app_metadata: {
            team_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // Custom team_id
        },
    };
    const token = jsonwebtoken_1.default.sign(payload, SUPABASE_JWT_SECRET);
    console.log('✓ Generated Mock Supabase JWT');
    // Clean up any test records in the database and Redis first
    try {
        await db_1.pool.query('DELETE FROM api_keys WHERE team_id = $1', [payload.app_metadata.team_id]);
        await db_1.pool.query('DELETE FROM team_budgets WHERE team_id = $1', [payload.app_metadata.team_id]);
        await db_1.pool.query('DELETE FROM teams WHERE id = $1', [payload.app_metadata.team_id]);
        console.log('✓ Cleaned up old test database rows');
    }
    catch (err) {
        console.error('Failed cleanup of DB:', err);
    }
    // 2. Start gateway-api server in a separate process
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
    // Give the server a few seconds to start
    await sleep(4000);
    let firstKeyRaw = '';
    let firstKeyId = '';
    let secondKeyId = '';
    try {
        // 3. Test: POST /api/keys (Create first key)
        console.log('\nTesting POST /api/keys (Create first key)...');
        const postResponse1 = await fetch(`http://localhost:${PORT}/api/keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: 'Development Key' }),
        });
        if (postResponse1.status !== 201) {
            throw new Error(`Failed to create first key. Status: ${postResponse1.status}`);
        }
        const firstKeyData = (await postResponse1.json());
        console.log('POST /api/keys response:', firstKeyData);
        if (!firstKeyData.key || !firstKeyData.key.startsWith('lgw_live_')) {
            throw new Error('Key does not start with lgw_live_');
        }
        firstKeyRaw = firstKeyData.key;
        firstKeyId = firstKeyData.id;
        console.log('✓ First API key created successfully!');
        // 4. Test: POST /api/keys (Create second key with same JWT)
        console.log('\nTesting POST /api/keys (Create second key)...');
        const postResponse2 = await fetch(`http://localhost:${PORT}/api/keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: 'Production Key' }),
        });
        if (postResponse2.status !== 201) {
            throw new Error(`Failed to create second key. Status: ${postResponse2.status}`);
        }
        const secondKeyData = (await postResponse2.json());
        secondKeyId = secondKeyData.id;
        console.log('✓ Second API key created successfully!');
        // 5. Test: GET /api/keys (List keys)
        console.log('\nTesting GET /api/keys (List team keys)...');
        const getResponse = await fetch(`http://localhost:${PORT}/api/keys`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (getResponse.status !== 200) {
            throw new Error(`Failed to list keys. Status: ${getResponse.status}`);
        }
        const keysList = (await getResponse.json());
        console.log('GET /api/keys response:', keysList);
        if (keysList.length < 2) {
            throw new Error(`Expected at least 2 keys in list, got ${keysList.length}`);
        }
        // Verify hash is not in response
        if (keysList.some((k) => k.key_hash || k.hash)) {
            throw new Error('Security flaw: API key hashes leaked in GET /api/keys response!');
        }
        console.log('✓ GET /api/keys works correctly and does not leak hashes!');
        // 6. Test: Invalid API Key authentication -> 401
        console.log('\nTesting GET /v1/protected with invalid API key...');
        const invalidAuthResponse = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: {
                Authorization: 'Bearer lgw_live_invalidkey123',
            },
        });
        console.log('Status for invalid API key:', invalidAuthResponse.status);
        if (invalidAuthResponse.status !== 401) {
            throw new Error(`Expected 401 for invalid API key, got ${invalidAuthResponse.status}`);
        }
        console.log('✓ Invalid API key correctly rejected with 401!');
        // 7. Test: Valid API Key authentication -> 200 & Redis caching
        console.log('\nTesting GET /v1/protected with valid API key...');
        const validAuthResponse = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: {
                Authorization: `Bearer ${firstKeyRaw}`,
            },
        });
        if (validAuthResponse.status !== 200) {
            throw new Error(`Expected 200 for valid API key, got ${validAuthResponse.status}`);
        }
        const protectedData = (await validAuthResponse.json());
        console.log('GET /v1/protected response:', protectedData);
        if (protectedData.team_id !== payload.app_metadata.team_id) {
            throw new Error(`Expected team_id to be ${payload.app_metadata.team_id}, got ${protectedData.team_id}`);
        }
        console.log('✓ Valid API key correctly authenticated with 200!');
        // 8. Test: Verify Redis cache is populated
        console.log('\nVerifying Redis cache...');
        const hash = (0, auth_1.hashApiKey)(firstKeyRaw);
        const redisVal = await redis_1.redis.get(`apikey:${hash}`);
        console.log(`Redis GET apikey:${hash} value:`, redisVal);
        if (!redisVal) {
            throw new Error('API key mapping not found in Redis cache!');
        }
        const expectedRedisVal = `${payload.app_metadata.team_id}:${firstKeyId}`;
        if (redisVal !== expectedRedisVal) {
            throw new Error(`Expected Redis value to be "${expectedRedisVal}", got "${redisVal}"`);
        }
        console.log('✓ Redis cache correctly populated!');
        // 9. Test: DELETE /api/keys/:id (Deactivate key)
        console.log('\nTesting DELETE /api/keys/:id...');
        const deleteResponse = await fetch(`http://localhost:${PORT}/api/keys/${firstKeyId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (deleteResponse.status !== 200) {
            throw new Error(`Expected 200 for DELETE /api/keys/:id, got ${deleteResponse.status}`);
        }
        console.log('✓ API key deleted from DB successfully!');
        // 10. Test: Verify Redis cache key is evicted
        console.log('\nVerifying eviction from Redis...');
        const redisValPostDelete = await redis_1.redis.get(`apikey:${hash}`);
        console.log('Redis GET value post-delete:', redisValPostDelete);
        if (redisValPostDelete) {
            throw new Error('API key cache was not evicted from Redis after deactivation!');
        }
        console.log('✓ API key cache successfully evicted from Redis!');
        // 11. Test: Call protected route with deactivated key -> 401
        console.log('\nTesting GET /v1/protected with deactivated API key...');
        const deactivatedAuthResponse = await fetch(`http://localhost:${PORT}/v1/protected`, {
            headers: {
                Authorization: `Bearer ${firstKeyRaw}`,
            },
        });
        console.log('Status for deactivated API key:', deactivatedAuthResponse.status);
        if (deactivatedAuthResponse.status !== 401) {
            throw new Error(`Expected 401 for deactivated API key, got ${deactivatedAuthResponse.status}`);
        }
        console.log('✓ Deactivated API key correctly rejected with 401!');
        console.log('\n--- ALL STEP 2 TESTS PASSED SUCCESSFULLY! ---');
    }
    catch (error) {
        console.error('\n❌ TEST SUITE FAILED:', error);
        process.exitCode = 1;
    }
    finally {
        // Shutdown the server process
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
//# sourceMappingURL=step2-test.js.map