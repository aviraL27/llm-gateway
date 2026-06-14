import jwt from 'jsonwebtoken';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';
import { exec } from 'child_process';
import path from 'path';
import http from 'http';

const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f';
const TEST_TEAM_ID = 'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6';
const PORT = 3000;
const MOCK_OPENAI_PORT = 3001;
const MOCK_ANTHROPIC_PORT = 3002;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to create a simple mock server
function createMockServer(port: number, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): http.Server {
  const server = http.createServer(handler);
  server.listen(port);
  return server;
}

async function runTests() {
  console.log('--- STARTING STEP 4 INTEGRATION TESTS ---');

  // 1. Generate Mock Supabase JWT
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
    // Clear BullMQ queue request-logs
    await redis.del('bull:request-logs:active', 'bull:request-logs:wait', 'bull:request-logs:id');
    console.log('✓ Cleaned up old database and Redis test rows');
  } catch (err) {
    console.error('Failed cleanup of DB/Redis:', err);
  }

  // 2. Start Mock OpenAI Server
  const mockOpenAIServer = createMockServer(MOCK_OPENAI_PORT, (req, res) => {
    console.log('[Mock OpenAI Server] Received request');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    
    // Send standard OpenAI stream events
    res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
    res.write('data: {"choices":[{"delta":{"content":" world!"}}]}\n\n');
    // Send final usage chunk (include_usage: true option)
    res.write('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  });
  console.log(`✓ Started Mock OpenAI Server on port ${MOCK_OPENAI_PORT}`);

  // 3. Start Mock Anthropic Server
  const mockAnthropicServer = createMockServer(MOCK_ANTHROPIC_PORT, (req, res) => {
    console.log('[Mock Anthropic Server] Received request');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });

    // Send Anthropic stream events
    res.write('data: {"type":"message_start","message":{"usage":{"input_tokens":12}}}\n\n');
    res.write('data: {"type":"content_block_delta","delta":{"text":"Hi "}}\n\n');
    res.write('data: {"type":"content_block_delta","delta":{"text":"there!"}}\n\n');
    res.write('data: {"type":"message_delta","usage":{"output_tokens":6}}\n\n');
    res.write('data: {"type":"message_stop"}\n\n');
    res.end();
  });
  console.log(`✓ Started Mock Anthropic Server on port ${MOCK_ANTHROPIC_PORT}`);

  // 4. Start Gateway-API Server in background
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

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[Gateway Error]: ${data.trim()}`);
  });

  await sleep(4000);

  let apiKeyRaw = '';

  try {
    // 5. Generate API Key via Dashboard API
    const keyRes = await fetch(`http://localhost:${PORT}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Streaming Test Key' }),
    });

    if (keyRes.status !== 201) {
      throw new Error(`Failed to create API key, status: ${keyRes.status}`);
    }
    const keyData = (await keyRes.json()) as any;
    apiKeyRaw = keyData.key;
    console.log('✓ Created API key:', apiKeyRaw);

    // 6. Test: OpenAI Stream Proxying
    console.log('\nTesting OpenAI Proxy (gpt-4o)...');
    const openaiRes = await fetch(`http://localhost:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyRaw}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
    });

    if (openaiRes.status !== 200) {
      throw new Error(`Failed to call OpenAI proxy. Status: ${openaiRes.status}`);
    }

    const reader1 = openaiRes.body;
    if (!reader1) throw new Error('No body in OpenAI response');

    let openaiOutput = '';
    const decoder = new TextDecoder();
    for await (const chunk of reader1 as any) {
      const text = decoder.decode(chunk);
      openaiOutput += text;
    }
    console.log('OpenAI Stream Received Raw Content:\n', openaiOutput);

    // Verify it contains "Hello" and " world!"
    if (!openaiOutput.includes('Hello') || !openaiOutput.includes('world!')) {
      throw new Error('OpenAI stream was not piped correctly!');
    }
    console.log('✓ OpenAI Stream piped correctly!');

    // Wait a brief moment for background BullMQ logging to happen
    await sleep(2000);

    // 7. Verify BullMQ Queue Job for OpenAI
    console.log('\nChecking BullMQ logs queue for OpenAI job...');
    const queueJobs = await redis.keys('bull:request-logs:*');
    console.log('Redis Queue Keys:', queueJobs);

    // We can read the list of jobs from Redis to check if one exists
    // BullMQ stores jobs in a list or hash. Let's list items from the wait or active list
    const jobIds = await redis.lrange('bull:request-logs:wait', 0, -1);
    console.log('Job IDs in queue:', jobIds);
    if (jobIds.length === 0) {
      throw new Error('No logging jobs found in request-logs queue!');
    }

    const jobData = await redis.hget(`bull:request-logs:${jobIds[0]}`, 'data');
    if (!jobData) throw new Error('Job data not found');
    const parsedJob = JSON.parse(jobData);
    console.log('Enqueued Job Data:', parsedJob);
    if (parsedJob.model !== 'gpt-4o' || parsedJob.prompt_tokens !== 10 || parsedJob.completion_tokens !== 5) {
      throw new Error('Incorrect token counts or model in enqueued job!');
    }
    // Cost calculation verification:
    // gpt-4o: $0.005/1k prompt, $0.015/1k completion
    // 10 * 0.000005 = 0.00005
    // 5 * 0.000015 = 0.000075
    // total: 0.000125
    console.log('Calculated Cost:', parsedJob.cost_usd);
    if (Math.abs(parsedJob.cost_usd - 0.000125) > 0.000001) {
      throw new Error('Incorrect cost calculation!');
    }
    console.log('✓ OpenAI cost calculation and log enqueueing verified!');

    // Clear queue for the next test
    await redis.del('bull:request-logs:wait', 'bull:request-logs:id');
    for (const key of queueJobs) {
      await redis.del(key);
    }

    // 8. Test: Anthropic Stream Proxying & Translation
    console.log('\nTesting Anthropic Proxy & Translation (claude-3-5-sonnet)...');
    const anthropicRes = await fetch(`http://localhost:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyRaw}`,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }),
    });

    if (anthropicRes.status !== 200) {
      throw new Error(`Failed to call Anthropic proxy. Status: ${anthropicRes.status}`);
    }

    const reader2 = anthropicRes.body;
    if (!reader2) throw new Error('No body in Anthropic response');

    let anthropicOutput = '';
    for await (const chunk of reader2 as any) {
      const text = decoder.decode(chunk);
      anthropicOutput += text;
    }
    console.log('Anthropic Stream Translated Raw Content:\n', anthropicOutput);

    // Verify it contains OpenAI format
    if (!anthropicOutput.includes('chatcmpl-anthropic') || !anthropicOutput.includes('chat.completion.chunk')) {
      throw new Error('Anthropic stream was not translated to OpenAI format!');
    }
    if (!anthropicOutput.includes('Hi') || !anthropicOutput.includes('there!')) {
      throw new Error('Anthropic stream content delta was lost!');
    }
    console.log('✓ Anthropic Stream translated and piped correctly!');

    await sleep(2000);

    // 9. Verify BullMQ Queue Job for Anthropic
    console.log('\nChecking BullMQ logs queue for Anthropic job...');
    const jobIdsAnthropic = await redis.lrange('bull:request-logs:wait', 0, -1);
    console.log('Job IDs in queue:', jobIdsAnthropic);
    if (jobIdsAnthropic.length === 0) {
      throw new Error('No logging jobs found in request-logs queue after Anthropic request!');
    }

    const jobDataAnthropic = await redis.hget(`bull:request-logs:${jobIdsAnthropic[0]}`, 'data');
    if (!jobDataAnthropic) throw new Error('Anthropic Job data not found');
    const parsedJobAnthropic = JSON.parse(jobDataAnthropic);
    console.log('Enqueued Anthropic Job Data:', parsedJobAnthropic);
    if (parsedJobAnthropic.model !== 'claude-3-5-sonnet' || parsedJobAnthropic.prompt_tokens !== 12 || parsedJobAnthropic.completion_tokens !== 6) {
      throw new Error('Incorrect token counts or model in enqueued Anthropic job!');
    }
    // Cost calculation verification:
    // claude-3-5-sonnet: $0.003/1k prompt, $0.015/1k completion
    // 12 * 0.000003 = 0.000036
    // 6 * 0.000015 = 0.00009
    // total: 0.000126
    console.log('Calculated Cost:', parsedJobAnthropic.cost_usd);
    if (Math.abs(parsedJobAnthropic.cost_usd - 0.000126) > 0.000001) {
      throw new Error('Incorrect Anthropic cost calculation!');
    }
    console.log('✓ Anthropic cost calculation and log enqueueing verified!');

    console.log('\n--- ALL STEP 4 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up servers...');
    mockOpenAIServer.close();
    mockAnthropicServer.close();
    serverProcess.kill('SIGINT');
    await sleep(2000);

    await redis.quit();
    await pool.end();
    console.log('Done!');
  }
}

runTests();
