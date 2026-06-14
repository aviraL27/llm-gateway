import jwt from 'jsonwebtoken';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';
import { exec } from 'child_process';
import path from 'path';
import http from 'http';

const SUPABASE_JWT_SECRET = 'test_supabase_jwt_secret';
const TEST_USER_ID = 'e5f6a7b8-8c9d-0e1f-2a3b-4c5d6e7f8a9b';
const TEST_TEAM_ID = 'd4d4d4d4-e5e5-f6f6-7a7a-8b8b8b8b8b8b';
const PORT = 3000;
const MOCK_OPENAI_PORT = 3001;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastReceivedMessages: any[] = [];

// Start Mock OpenAI Server
function createMockServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    let bodyText = '';
    req.on('data', (chunk) => {
      bodyText += chunk;
    });

    req.on('end', () => {
      try {
        const parsedBody = JSON.parse(bodyText);
        lastReceivedMessages = parsedBody.messages || [];
      } catch (e) {
        // Ignore json parse error
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      res.write('data: {"choices":[{"delta":{"content":"Redaction verified."}}]}\n\n');
      res.write('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  server.listen(port);
  return server;
}

async function runTests() {
  console.log('--- STARTING STEP 6 INTEGRATION TESTS ---');

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

  await sleep(4000);

  let apiKeyRaw = '';

  try {
    // 3. Create API Key (will auto-create team in teams table)
    const keyRes = await fetch(`http://localhost:${PORT}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'PII Test Key' }),
    });
    const keyData = (await keyRes.json()) as any;
    apiKeyRaw = keyData.key;
    console.log('✓ Created API key:', apiKeyRaw);

    // Enable PII Redaction for the team in DB
    await pool.query('UPDATE teams SET pii_redaction_enabled = true WHERE id = $1', [TEST_TEAM_ID]);
    console.log('✓ Enabled PII Redaction for the test team in the database');

    // 4. Test Case: Redaction of Valid/Invalid inputs
    const testPrompt = `
      - Valid Email: test@example.com
      - Valid SSN: 123-45-6789
      - Valid CC (Luhn Pass): 4111-1111-1111-1111
      - Invalid CC (Luhn Fail): 4000 1234 5678 9010
      - Valid IP: 192.168.1.1
      - Invalid IP: 300.400.500.600
      - Valid International Phone: +1 (555) 019-2834
      - Invalid Phone (Too Short): 12-34
    `;

    console.log('\nSending prompt containing sensitive data via proxy...');
    const proxyRes = await fetch(`http://localhost:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyRaw}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: testPrompt }],
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
      decoder.decode(chunk); // Consume stream
    }

    console.log('\nVerifying redacted message forwarded to OpenAI...');
    if (lastReceivedMessages.length === 0) {
      throw new Error('Mock OpenAI server did not receive messages!');
    }
    const forwardedContent = lastReceivedMessages[0].content;
    console.log('Forwarded Prompt Content:\n', forwardedContent);

    // Assert Redacted values
    if (!forwardedContent.includes('[EMAIL_1]')) throw new Error('Email was not redacted!');
    if (!forwardedContent.includes('[SSN_1]')) throw new Error('SSN was not redacted!');
    if (!forwardedContent.includes('[CREDIT_CARD_1]')) throw new Error('Valid Credit Card was not redacted!');
    if (!forwardedContent.includes('[IP_1]')) throw new Error('Valid IP was not redacted!');
    if (!forwardedContent.includes('[PHONE_1]')) throw new Error('Valid International Phone was not redacted!');

    // Assert Unmodified (invalid PII) values
    if (!forwardedContent.includes('4000 1234 5678 9010')) throw new Error('Invalid Credit Card (Luhn Fail) was incorrectly redacted!');
    if (!forwardedContent.includes('300.400.500.600')) throw new Error('Invalid IP (octet out of range) was incorrectly redacted!');
    if (!forwardedContent.includes('12-34')) throw new Error('Short number sequence was incorrectly redacted!');
    console.log('✓ Valid PII redacted successfully, and invalid PII was left unmodified!');

    // 5. Verify BullMQ logging queue job has pii_detected = true
    await sleep(2000);
    console.log('\nVerifying enqueued BullMQ job...');
    const jobIds = await redis.lrange('bull:request-logs:wait', 0, -1);
    if (jobIds.length === 0) {
      throw new Error('No job enqueued in request-logs queue!');
    }
    const jobData = await redis.hget(`bull:request-logs:${jobIds[0]}`, 'data');
    if (!jobData) throw new Error('Job data not found');
    const parsedJob = JSON.parse(jobData);
    console.log('Enqueued Job data:', parsedJob);
    if (parsedJob.pii_detected !== true) {
      throw new Error('Expected pii_detected: true in enqueued log job!');
    }
    console.log('✓ Verified: pii_detected is set to true in logging job payload!');

    console.log('\n--- ALL STEP 6 TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up servers...');
    mockOpenAIServer.close();
    serverProcess.kill('SIGINT');
    await sleep(2000);

    await redis.quit();
    await pool.end();
    console.log('Done!');
  }
}

runTests();
