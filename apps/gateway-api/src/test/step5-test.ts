import jwt from 'jsonwebtoken';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';
import { exec } from 'child_process';
import path from 'path';
import http from 'http';
import { Queue } from 'bullmq';

const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'd4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a';
const TEST_TEAM_ID = 'c3c3c3c3-d4d4-e5e5-f6f6-7a7a7a7a7a7a';
const PORT = 3000;
const MOCK_OPENAI_PORT = 3001;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
    res.write('data: {"choices":[{"delta":{"content":" world!"}}]}\n\n');
    res.write('data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50}}\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  });
  server.listen(port);
  return server;
}

async function runTests() {
  console.log('--- STARTING STEP 5 INTEGRATION TESTS ---');

  // Generate Mock Supabase JWT
  const token = jwt.sign(
    {
      sub: TEST_USER_ID,
      app_metadata: {
        team_id: TEST_TEAM_ID,
      },
    },
    SUPABASE_JWT_SECRET
  );

  // Clean DB and Redis
  try {
    await pool.query('DELETE FROM api_keys WHERE team_id = $1', [TEST_TEAM_ID]);
    await pool.query('DELETE FROM team_budgets WHERE team_id = $1', [TEST_TEAM_ID]);
    await pool.query('DELETE FROM teams WHERE id = $1', [TEST_TEAM_ID]);
    await redis.del(`team_spend:${TEST_TEAM_ID}`, `team_budget_limit:${TEST_TEAM_ID}`);
    // Clear BullMQ queues
    await redis.del('bull:request-logs:active', 'bull:request-logs:wait', 'bull:request-logs:id');
    await redis.del('bull:request-logs-failed:active', 'bull:request-logs-failed:wait', 'bull:request-logs-failed:id');
    console.log('✓ Cleaned up database and Redis test rows');
  } catch (err) {
    console.error('Failed cleanup of DB/Redis:', err);
  }

  // Start Mock OpenAI Server
  const mockOpenAIServer = createMockServer(MOCK_OPENAI_PORT);
  console.log(`✓ Started Mock OpenAI Server on port ${MOCK_OPENAI_PORT}`);

  // Start Gateway-API Server
  console.log('Starting LLM Gateway Server...');
  const serverProcess = exec('npx ts-node src/index.ts', {
    cwd: path.resolve(__dirname, '../../'),
    env: {
      ...process.env,
      PORT: PORT.toString(),
      SUPABASE_JWT_SECRET,
      OPENAI_API_URL: `http://localhost:${MOCK_OPENAI_PORT}`,
      OPENAI_API_KEY: 'mock-openai-key',
    },
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[Gateway]: ${data.trim()}`);
  });

  // Start Worker Process
  console.log('Starting Worker Process...');
  const workerProcess = exec('npx ts-node src/index.ts', {
    cwd: path.resolve(__dirname, '../../../worker'),
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5435/llm_gateway',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6385',
    },
  });

  workerProcess.stdout?.on('data', (data) => {
    console.log(`[Worker]: ${data.trim()}`);
  });

  workerProcess.stderr?.on('data', (data) => {
    console.error(`[Worker Error]: ${data.trim()}`);
  });

  await sleep(5000);

  let apiKeyRaw = '';
  let apiKeyId = '';

  try {
    // 3. Create API Key
    const keyRes = await fetch(`http://localhost:${PORT}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Worker Test Key' }),
    });
    const keyData = (await keyRes.json()) as any;
    apiKeyRaw = keyData.key;
    apiKeyId = keyData.id;
    console.log('✓ Created API key:', apiKeyRaw);

    // 4. Set budget limit to $50.00
    await fetch(`http://localhost:${PORT}/api/teams/budget`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monthly_limit_usd: 50.00 }),
    });
    console.log('✓ Set team budget limit to $50.00');

    // 5. Call Streaming Proxy to trigger enqueuing
    console.log('\nMaking streaming request via proxy...');
    const proxyRes = await fetch(`http://localhost:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyRaw}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test worker logging' }],
        stream: true,
      }),
    });

    if (proxyRes.status !== 200) {
      throw new Error(`Failed proxy request: ${proxyRes.status}`);
    }

    const reader = proxyRes.body;
    if (!reader) throw new Error('No body in proxy response');
    const decoder = new TextDecoder();
    for await (const chunk of reader as any) {
      // Consume the stream to end
      decoder.decode(chunk);
    }
    console.log('✓ Completed proxy request. Waiting for worker to process job...');

    // Wait for worker to consume job and write to DB
    await sleep(4000);

    // 6. Verify database records
    console.log('\nVerifying database records...');
    const dbLogsRes = await pool.query('SELECT * FROM request_logs WHERE team_id = $1', [TEST_TEAM_ID]);
    console.log(`Database request_logs row count: ${dbLogsRes.rows.length}`);
    if (dbLogsRes.rows.length === 0) {
      throw new Error('No log row found in database request_logs table!');
    }
    const logRow = dbLogsRes.rows[0];
    console.log('DB Log Row:', logRow);
    if (parseInt(logRow.prompt_tokens) !== 100 || parseInt(logRow.completion_tokens) !== 50) {
      throw new Error('Token counts in DB do not match request usage!');
    }

    const dbBudgetRes = await pool.query('SELECT current_spend_usd FROM team_budgets WHERE team_id = $1', [TEST_TEAM_ID]);
    const currentSpend = parseFloat(dbBudgetRes.rows[0].current_spend_usd);
    console.log('DB Current Spend:', currentSpend);
    if (currentSpend <= 0) {
      throw new Error('Database current_spend_usd was not incremented!');
    }

    // 7. Verify Redis team_spend key
    console.log('\nVerifying Redis team_spend cache...');
    const redisSpend = await redis.get(`team_spend:${TEST_TEAM_ID}`);
    console.log('Redis Spend Value:', redisSpend);
    if (redisSpend === null || parseFloat(redisSpend) !== currentSpend) {
      throw new Error(`Redis spend value (${redisSpend}) does not match DB current spend (${currentSpend})!`);
    }
    console.log('✓ Redis spend counter updated and in sync with DB!');

    // 8. Test DLQ Routing (Force Error)
    console.log('\nTesting Job Failures & Dead Letter Queue Routing...');
    // We will enqueue a job with invalid team_id UUID to force a DB insert constraint failure
    const logQueue = new Queue('request-logs', { connection: redis });
    console.log('Enqueuing malformed job with invalid UUID...');
    await logQueue.add('log-request', {
      team_id: 'not-a-valid-uuid', // Triggers uuid syntax error in PG
      api_key_id: apiKeyId,
      provider: 'openai',
      model: 'gpt-4o',
      prompt_tokens: 10,
      completion_tokens: 5,
      cost_usd: 0.000125,
      latency_ms: 100,
      status: 'success',
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    console.log('Waiting for retries (attempts: 3 with exponential backoff)...');
    await sleep(6000);

    // Check request-logs-failed DLQ
    console.log('Checking request-logs-failed queue...');
    const failedJobIds = await redis.lrange('bull:request-logs-failed:wait', 0, -1);
    console.log('Failed Queue Job IDs:', failedJobIds);
    if (failedJobIds.length === 0) {
      throw new Error('Malformed job did not route to request-logs-failed dead letter queue!');
    }

    const failedJobData = await redis.hget(`bull:request-logs-failed:${failedJobIds[0]}`, 'data');
    if (!failedJobData) throw new Error('Failed job data not found in Redis');
    const parsedFailedJob = JSON.parse(failedJobData);
    console.log('Failed Job DLQ Data:', parsedFailedJob);
    if (parsedFailedJob.error && parsedFailedJob.error.includes('invalid input syntax for type uuid')) {
      console.log('✓ Verified: Job failed and routed to DLQ with UUID syntax error details!');
    } else {
      console.warn('Job failed but error details did not match expected type UUID syntax error.');
    }

    console.log('\n--- ALL STEP 5 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up servers...');
    mockOpenAIServer.close();
    serverProcess.kill('SIGINT');
    workerProcess.kill('SIGINT');
    await sleep(2000);

    await redis.quit();
    await pool.end();
    console.log('Done!');
  }
}

runTests();
