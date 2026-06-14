import jwt from 'jsonwebtoken';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';
import { exec } from 'child_process';
import path from 'path';
import http from 'http';

const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'e6e6e6e6-f7f7-8a8a-9b9b-0c0c0c0c0c0c';
const TEST_TEAM_ID = 'e6e6e6e6-f7f7-8a8a-9b9b-0c0c0c0c0c0c';
const PORT = 3000;
const MOCK_OPENAI_PORT = 3001;
const MOCK_ANTHROPIC_PORT = 3002;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockOpenAIServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    let bodyText = '';
    req.on('data', (chunk) => {
      bodyText += chunk;
    });

    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText);
        if (body.model === 'gpt-4o-fail') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: "Mock OpenAI Server Error", type: "api_error" } }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        
        const content = body.model === 'gpt-4o' 
          ? "Hello from OpenAI gpt-4o!" 
          : body.model === 'gpt-4o-mini' 
            ? "Hello from OpenAI gpt-4o-mini!" 
            : "Hello from OpenAI gpt-3.5-turbo!";

        res.write(`data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`);
        res.write('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  });
  server.listen(port);
  return server;
}

function createMockAnthropicServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    let bodyText = '';
    req.on('data', (chunk) => {
      bodyText += chunk;
    });

    req.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      
      const chunks = [
        'data: {"type": "message_start", "message": {"id": "msg_anthropic_123", "type": "message", "role": "assistant", "content": [], "model": "claude-3-5-sonnet-20241022", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 10, "output_tokens": 0}}}\n\n',
        'data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}\n\n',
        'data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello from Anthropic fallback!"}}\n\n',
        'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}, "usage": {"output_tokens": 5}}\n\n',
        'data: {"type": "message_stop"}\n\n'
      ];

      for (const chunk of chunks) {
        res.write(chunk);
      }
      res.end();
    });
  });
  server.listen(port);
  return server;
}

async function runTests() {
  console.log('--- STARTING STEP 7 INTEGRATION TESTS ---');

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
    await pool.query('DELETE FROM request_logs WHERE team_id = $1', [TEST_TEAM_ID]);
    await pool.query('DELETE FROM api_keys WHERE team_id = $1', [TEST_TEAM_ID]);
    await pool.query('DELETE FROM team_budgets WHERE team_id = $1', [TEST_TEAM_ID]);
    await pool.query('DELETE FROM teams WHERE id = $1', [TEST_TEAM_ID]);
    await redis.del(
      `team_spend:${TEST_TEAM_ID}`,
      `team_budget_limit:${TEST_TEAM_ID}`,
      `team_config:${TEST_TEAM_ID}`
    );
    // Clear BullMQ queues
    await redis.del('bull:request-logs:active', 'bull:request-logs:wait', 'bull:request-logs:id');
    console.log('✓ Cleaned up database and Redis test rows');
  } catch (err) {
    console.error('Failed cleanup of DB/Redis:', err);
  }

  // Start Mock Servers
  const mockOpenAIServer = createMockOpenAIServer(MOCK_OPENAI_PORT);
  console.log(`✓ Started Mock OpenAI Server on port ${MOCK_OPENAI_PORT}`);

  const mockAnthropicServer = createMockAnthropicServer(MOCK_ANTHROPIC_PORT);
  console.log(`✓ Started Mock Anthropic Server on port ${MOCK_ANTHROPIC_PORT}`);

  // Start Gateway-API Server
  console.log('Starting LLM Gateway Server...');
  const serverProcess = exec('npx ts-node src/index.ts', {
    cwd: path.resolve(__dirname, '../../'),
    env: {
      ...process.env,
      PORT: PORT.toString(),
      SUPABASE_JWT_SECRET,
      OPENAI_API_URL: `http://localhost:${MOCK_OPENAI_PORT}`,
      ANTHROPIC_API_URL: `http://localhost:${MOCK_ANTHROPIC_PORT}`,
      OPENAI_API_KEY: 'mock-openai-key',
      ANTHROPIC_API_KEY: 'mock-anthropic-key',
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

  try {
    // 1. Create API Key
    const keyRes = await fetch(`http://localhost:${PORT}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Fallback Test Key' }),
    });
    const keyData = (await keyRes.json()) as any;
    apiKeyRaw = keyData.key;
    console.log('✓ Created API key:', apiKeyRaw);

    // 2. Set budget limit to $100.00
    await fetch(`http://localhost:${PORT}/api/teams/budget`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ monthly_limit_usd: 100.00 }),
    });
    console.log('✓ Set team budget limit to $100.00');

    // 3. Configure Model Fallback logic
    const fallbackConfig = {
      thresholds: [
        {
          spend_usd: 1.00,
          action: 'downgrade',
          from: 'gpt-4o',
          to: 'gpt-4o-mini',
        },
        {
          spend_usd: 5.00,
          action: 'downgrade',
          from: 'gpt-4o-mini',
          to: 'gpt-3.5-turbo',
        },
      ],
      provider_fallback: {
        openai_error: 'anthropic',
        model_map: {
          'gpt-4o': 'claude-3-5-sonnet-20241022',
          'gpt-4o-mini': 'claude-3-5-haiku',
          'gpt-4o-fail': 'claude-3-5-sonnet-20241022',
        },
      },
    };

    const configRes = await fetch(`http://localhost:${PORT}/api/teams/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fallback_config: fallbackConfig }),
    });
    if (configRes.status !== 200) {
      throw new Error(`Failed to configure fallback config: ${configRes.status}`);
    }
    console.log('✓ Configured model fallback logic config in the database and cleared cache');

    // Helper to send proxy request and receive stream content
    const sendProxyRequest = async (model: string): Promise<{ content: string; headers: Headers }> => {
      const proxyRes = await fetch(`http://localhost:${PORT}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKeyRaw}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
        }),
      });

      if (proxyRes.status !== 200) {
        throw new Error(`Failed proxy request: ${proxyRes.status}`);
      }

      const reader = proxyRes.body;
      if (!reader) throw new Error('No body in proxy response');
      const decoder = new TextDecoder();
      let text = '';
      for await (const chunk of reader as any) {
        text += decoder.decode(chunk);
      }
      return { content: text, headers: proxyRes.headers };
    };

    // --- TEST CASE 1: Base Case (No Threshold Exceeded) ---
    console.log('\n--- Test Case 1: Base Case (No Threshold Exceeded) ---');
    const res1 = await sendProxyRequest('gpt-4o');
    console.log('Response content:', res1.content);
    if (!res1.content.includes('Hello from OpenAI gpt-4o!')) {
      throw new Error('Expected response to be from OpenAI gpt-4o!');
    }
    await sleep(4000); // Wait for worker

    // Query DB request_logs
    const dbRes1 = await pool.query('SELECT * FROM request_logs WHERE team_id = $1 ORDER BY time DESC LIMIT 1', [TEST_TEAM_ID]);
    if (dbRes1.rows.length === 0) throw new Error('No logs recorded for Test Case 1');
    console.log('Recorded log:', dbRes1.rows[0]);
    if (dbRes1.rows[0].model !== 'gpt-4o' || dbRes1.rows[0].model_used !== 'gpt-4o' || dbRes1.rows[0].was_fallback !== false) {
      throw new Error('Log row attributes incorrect for Test Case 1');
    }
    console.log('✓ Test Case 1 Passed!');

    // --- TEST CASE 2: Spend Threshold Downgrade Level 1 (Downgrade to gpt-4o-mini) ---
    console.log('\n--- Test Case 2: Spend Threshold Downgrade Level 1 ($2.00 spend) ---');
    await pool.query('UPDATE team_budgets SET current_spend_usd = 2.00 WHERE team_id = $1', [TEST_TEAM_ID]);
    await redis.del(`team_spend:${TEST_TEAM_ID}`); // Evict cache

    const res2 = await sendProxyRequest('gpt-4o');
    console.log('Response content:', res2.content);
    if (!res2.content.includes('Hello from OpenAI gpt-4o-mini!')) {
      throw new Error('Expected response to be from OpenAI gpt-4o-mini (downgraded)!');
    }
    await sleep(4000); // Wait for worker

    const dbRes2 = await pool.query('SELECT * FROM request_logs WHERE team_id = $1 ORDER BY time DESC LIMIT 1', [TEST_TEAM_ID]);
    console.log('Recorded log:', dbRes2.rows[0]);
    if (dbRes2.rows[0].model !== 'gpt-4o' || dbRes2.rows[0].model_used !== 'gpt-4o-mini' || dbRes2.rows[0].was_fallback !== false) {
      throw new Error('Log row attributes incorrect for Test Case 2');
    }
    console.log('✓ Test Case 2 Passed!');

    // --- TEST CASE 3: Spend Threshold Downgrade Level 2 (Downgrade to gpt-3.5-turbo) ---
    console.log('\n--- Test Case 3: Spend Threshold Downgrade Level 2 ($6.00 spend) ---');
    await pool.query('UPDATE team_budgets SET current_spend_usd = 6.00 WHERE team_id = $1', [TEST_TEAM_ID]);
    await redis.del(`team_spend:${TEST_TEAM_ID}`); // Evict cache

    const res3 = await sendProxyRequest('gpt-4o');
    console.log('Response content:', res3.content);
    if (!res3.content.includes('Hello from OpenAI gpt-3.5-turbo!')) {
      throw new Error('Expected response to be from OpenAI gpt-3.5-turbo (downgraded)!');
    }
    await sleep(4000); // Wait for worker

    const dbRes3 = await pool.query('SELECT * FROM request_logs WHERE team_id = $1 ORDER BY time DESC LIMIT 1', [TEST_TEAM_ID]);
    console.log('Recorded log:', dbRes3.rows[0]);
    if (dbRes3.rows[0].model !== 'gpt-4o' || dbRes3.rows[0].model_used !== 'gpt-3.5-turbo' || dbRes3.rows[0].was_fallback !== false) {
      throw new Error('Log row attributes incorrect for Test Case 3');
    }
    console.log('✓ Test Case 3 Passed!');

    // --- TEST CASE 4: Provider Failover (OpenAI 500 -> Anthropic) ---
    console.log('\n--- Test Case 4: Provider Failover (OpenAI returns 500 -> Claude) ---');
    // Reset spend back to $0.00 so no spend downgrades happen
    await pool.query('UPDATE team_budgets SET current_spend_usd = 0.00 WHERE team_id = $1', [TEST_TEAM_ID]);
    await redis.del(`team_spend:${TEST_TEAM_ID}`); // Evict cache

    const res4 = await sendProxyRequest('gpt-4o-fail');
    console.log('Response content:', res4.content);
    const fallbackHeader = res4.headers.get('X-LLM-Gateway-Fallback');
    console.log('X-LLM-Gateway-Fallback header:', fallbackHeader);
    if (fallbackHeader !== 'true') {
      throw new Error('Expected X-LLM-Gateway-Fallback header to be set to true!');
    }
    if (!res4.content.includes('Hello from Anthropic fallback!')) {
      throw new Error('Expected response to be from Anthropic fallback!');
    }
    await sleep(4000); // Wait for worker

    const dbRes4 = await pool.query('SELECT * FROM request_logs WHERE team_id = $1 ORDER BY time DESC LIMIT 1', [TEST_TEAM_ID]);
    console.log('Recorded log:', dbRes4.rows[0]);
    if (dbRes4.rows[0].model !== 'gpt-4o-fail' || dbRes4.rows[0].model_used !== 'claude-3-5-sonnet-20241022' || dbRes4.rows[0].was_fallback !== true || dbRes4.rows[0].provider !== 'anthropic') {
      throw new Error('Log row attributes incorrect for Test Case 4');
    }
    console.log('✓ Test Case 4 Passed!');

    console.log('\n--- ALL STEP 7 INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up servers...');
    mockOpenAIServer.close();
    mockAnthropicServer.close();
    serverProcess.kill('SIGINT');
    workerProcess.kill('SIGINT');
    await sleep(2000);

    await redis.quit();
    await pool.end();
    console.log('Done!');
  }
}

runTests();
