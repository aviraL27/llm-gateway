import dotenv from 'dotenv';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import cron from 'node-cron';
import { pool } from '@llm-gateway/db';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// Dead letter queue for failed logs
const failedQueue = new Queue('request-logs-failed', { connection });

console.log('Worker starting...');

// BullMQ Worker to process request-logs
const worker = new Worker(
  'request-logs',
  async (job) => {
    const {
      team_id,
      api_key_id,
      provider,
      model,
      model_used,
      was_fallback = false,
      prompt_tokens,
      completion_tokens,
      cost_usd,
      latency_ms,
      status,
      pii_detected = false,
    } = job.data;

    console.log(`Processing job ${job.id}: logging request for team ${team_id}...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. INSERT into request_logs hypertable (using NOW() for transaction time)
      await client.query(
        `INSERT INTO request_logs (time, team_id, api_key_id, provider, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, status, pii_detected, model_used, was_fallback)
         VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          team_id,
          api_key_id,
          provider,
          model,
          prompt_tokens,
          completion_tokens,
          cost_usd,
          latency_ms,
          status,
          pii_detected,
          model_used || model,
          was_fallback,
        ]
      );

      // 2. UPDATE team_budgets: current_spend_usd += cost_usd
      await client.query(
        `UPDATE team_budgets
         SET current_spend_usd = current_spend_usd + $1
         WHERE team_id = $2`,
        [cost_usd, team_id]
      );

      // 3. UPDATE api_keys: last_used_at = NOW() (only if > 5 min since last update)
      await client.query(
        `UPDATE api_keys
         SET last_used_at = NOW()
         WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '5 minutes')`,
        [api_key_id]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error(`DB transaction error for job ${job.id}:`, dbError);
      throw dbError; // Rethrow to trigger attempts and backoff
    } finally {
      client.release();
    }

    // 4. Redis updates (after DB transaction)
    const spendKey = `team_spend:${team_id}`;
    
    // Atomic INCRBYFLOAT
    await connection.incrbyfloat(spendKey, cost_usd);

    // Set TTL on that key to end of current month if not already set
    const ttl = await connection.ttl(spendKey);
    if (ttl < 0) {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
      const ttlSecs = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);
      await connection.expire(spendKey, ttlSecs);
    }

    // 5. Emit to Socket.io room via Redis Pub/Sub
    await connection.publish(`team:${team_id}`, JSON.stringify({
      type: 'request-log',
      data: {
        team_id,
        api_key_id,
        provider,
        model,
        prompt_tokens,
        completion_tokens,
        cost_usd,
        latency_ms,
        status,
        pii_detected,
        time: new Date().toISOString(),
      }
    }));

    console.log(`✓ Processed job ${job.id} successfully.`);
    return { status: 'processed' };
  },
  {
    connection,
    concurrency: 5,
  }
);

// Event listener for completed jobs
worker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed successfully.`);
});

// Event listener for failed jobs (Retry logic & DLQ routing)
worker.on('failed', async (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error: ${err.message}`);
  
  if (job) {
    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade >= maxAttempts) {
      console.error(`Job ${job.id} exhausted all ${maxAttempts} attempts. Routing to 'request-logs-failed' dead letter queue.`);
      try {
        await failedQueue.add('failed-job', {
          originalJobId: job.id,
          failedAt: new Date().toISOString(),
          error: err.message,
          stack: err.stack,
          data: job.data,
        });
        console.log(`✓ Successfully enqueued failed job ${job.id} to request-logs-failed queue.`);
      } catch (dlqError) {
        console.error(`Failed to route job ${job.id} to dead letter queue:`, dlqError);
      }
    } else {
      console.log(`Job ${job.id} will be retried (Attempt ${job.attemptsMade + 1} of ${maxAttempts})...`);
    }
  }
});

// Monthly Reset Job helper
export async function resetMonthlyBudgets() {
  console.log('Running monthly budget reset cron job...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update budgets in database
    await client.query(
      `UPDATE team_budgets 
       SET current_spend_usd = 0.00, 
           reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')`
    );
    
    await client.query('COMMIT');
    console.log('✓ Successfully reset monthly budgets in the database.');
  } catch (dbError) {
    await client.query('ROLLBACK');
    console.error('Failed to reset monthly budgets in database:', dbError);
  } finally {
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
  } catch (redisError) {
    console.error('Failed to clear budget caches from Redis:', redisError);
  }
}

// Schedule Monthly Reset Job: 00:00 on the 1st of every month
cron.schedule('0 0 1 * *', async () => {
  try {
    await resetMonthlyBudgets();
  } catch (error) {
    console.error('Error in monthly reset cron job:', error);
  }
});

console.log('✓ Monthly reset cron job scheduled (00:00 on the 1st of every month)');
