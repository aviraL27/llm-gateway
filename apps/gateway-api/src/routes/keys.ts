import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';
import { hashApiKey } from '../middlewares/auth';

declare global {
  namespace Express {
    interface Request {
      team_id?: string;
      api_key_id?: string;
      user_id?: string;
    }
  }
}

const router = Router();

// POST /api/keys - Generate a new API key
router.post('/keys', async (req: Request, res: Response) => {
  const { name } = req.body;
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  const keyName = name || 'Default Key';

  try {
    // 1. Generate Raw Key: lgw_live_ + 32 random bytes as hex
    const rawKey = `lgw_live_${crypto.randomBytes(32).toString('hex')}`;
    const hash = hashApiKey(rawKey);

    // Start a transaction to ensure atomic budget check + key creation
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Insert key hash into api_keys table
      const keyInsert = await client.query(
        `INSERT INTO api_keys (team_id, key_hash, name, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, name, created_at`,
        [teamId, hash, keyName]
      );

      const newKey = keyInsert.rows[0];

      // 3. Ensure a team_budgets row exists for the team
      // Set reset_at to 1st of next month
      await client.query(
        `INSERT INTO team_budgets (team_id, monthly_limit_usd, current_spend_usd, reset_at)
         VALUES ($1, 100.00, 0.00, DATE_TRUNC('month', NOW() + INTERVAL '1 month'))
         ON CONFLICT (team_id) DO NOTHING`,
        [teamId]
      );

      await client.query('COMMIT');

      // 4. Return the raw key exactly once
      return res.status(201).json({
        id: newKey.id,
        name: newKey.name,
        created_at: newKey.created_at,
        key: rawKey, // Raw key is returned ONLY once
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating API key:', error);
    return res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// GET /api/keys - List all keys for the team
router.get('/keys', async (req: Request, res: Response) => {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, created_at, last_used_at, is_active
       FROM api_keys
       WHERE team_id = $1
       ORDER BY created_at DESC`,
      [teamId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing API keys:', error);
    return res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api/keys/:id - Deactivate an API key
router.delete('/keys/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    // 1. Deactivate key in DB
    const result = await pool.query(
      `UPDATE api_keys
       SET is_active = false
       WHERE id = $1 AND team_id = $2
       RETURNING key_hash`,
      [id, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const hash = result.rows[0].key_hash;

    // 2. Remove key from Redis cache
    await redis.del(`apikey:${hash}`);

    return res.json({ message: 'API key deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating API key:', error);
    return res.status(500).json({ error: 'Failed to deactivate API key' });
  }
});

// PUT /teams/budget - Upsert budget configuration
router.put('/teams/budget', async (req: Request, res: Response) => {
  const { monthly_limit_usd } = req.body;
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  if (typeof monthly_limit_usd !== 'number' || monthly_limit_usd < 0) {
    return res.status(400).json({ error: 'Invalid monthly_limit_usd. Must be a non-negative number.' });
  }

  try {
    // 1. Upsert team_budgets row in DB
    const result = await pool.query(
      `INSERT INTO team_budgets (team_id, monthly_limit_usd, current_spend_usd, reset_at)
       VALUES ($1, $2, 0.00, DATE_TRUNC('month', NOW() + INTERVAL '1 month'))
       ON CONFLICT (team_id)
       DO UPDATE SET monthly_limit_usd = EXCLUDED.monthly_limit_usd
       RETURNING team_id, monthly_limit_usd, current_spend_usd, reset_at`,
      [teamId, monthly_limit_usd]
    );

    // 2. Delete Redis cache keys to force a refresh on the next request
    await redis.del(`team_spend:${teamId}`);
    await redis.del(`team_budget_limit:${teamId}`);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating team budget:', error);
    return res.status(500).json({ error: 'Failed to update team budget' });
  }
});

// PUT /teams/config - Update team configurations (e.g. fallback_config, pii_redaction_enabled)
router.put('/teams/config', async (req: Request, res: Response) => {
  const { fallback_config, pii_redaction_enabled } = req.body;
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (fallback_config !== undefined) {
      if (typeof fallback_config !== 'object') {
        return res.status(400).json({ error: 'Invalid fallback_config. Must be an object.' });
      }
      fields.push(`fallback_config = $${paramIdx++}`);
      values.push(JSON.stringify(fallback_config));
    }

    if (pii_redaction_enabled !== undefined) {
      if (typeof pii_redaction_enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid pii_redaction_enabled. Must be a boolean.' });
      }
      fields.push(`pii_redaction_enabled = $${paramIdx++}`);
      values.push(pii_redaction_enabled);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No configuration fields provided to update.' });
    }

    values.push(teamId);
    const result = await pool.query(
      `UPDATE teams
       SET ${fields.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING id, name, fallback_config, pii_redaction_enabled`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // 2. Delete Redis cache key to force refresh
    await redis.del(`team_config:${teamId}`);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating team config:', error);
    return res.status(500).json({ error: 'Failed to update team configuration' });
  }
});

// GET /api/logs - Paginated request logs with filters
router.get('/logs', async (req: Request, res: Response) => {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const { provider, model, status, from, to } = req.query;

    const conditions: string[] = ['team_id = $1'];
    const values: any[] = [teamId];
    let paramIdx = 2;

    if (provider) {
      conditions.push(`provider = $${paramIdx++}`);
      values.push(provider);
    }
    if (model) {
      conditions.push(`model = $${paramIdx++}`);
      values.push(model);
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      values.push(status);
    }
    if (from) {
      conditions.push(`time >= $${paramIdx++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`time <= $${paramIdx++}`);
      values.push(to);
    }

    const whereClause = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM request_logs
         WHERE ${whereClause}
         ORDER BY time DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...values, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM request_logs WHERE ${whereClause}`,
        values
      ),
    ]);

    return res.json({
      rows: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return res.status(500).json({ error: 'Failed to fetch request logs' });
  }
});

// GET /api/analytics/overview - Aggregated metrics for the team
router.get('/analytics/overview', async (req: Request, res: Response) => {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const [metricsResult, budgetResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_requests,
           COALESCE(SUM(cost_usd), 0) AS total_spend,
           ROUND(COALESCE(AVG(latency_ms), 0)) AS avg_latency,
           CASE WHEN COUNT(*) > 0
             THEN ROUND((COUNT(*) FILTER (WHERE status = 'error')::numeric / COUNT(*)) * 100, 2)
             ELSE 0
           END AS error_rate,
           COUNT(*) FILTER (WHERE time >= $2)::int AS requests_today,
           COALESCE(SUM(cost_usd) FILTER (WHERE time >= $2), 0) AS spend_today
         FROM request_logs
         WHERE team_id = $1`,
        [teamId, todayMidnight.toISOString()]
      ),
      pool.query(
        `SELECT monthly_limit_usd, current_spend_usd
         FROM team_budgets
         WHERE team_id = $1`,
        [teamId]
      ),
    ]);

    const metrics = metricsResult.rows[0];
    const budget = budgetResult.rows[0] || { monthly_limit_usd: null, current_spend_usd: null };

    return res.json({
      total_requests: metrics.total_requests,
      total_spend: parseFloat(metrics.total_spend),
      avg_latency: parseInt(metrics.avg_latency),
      error_rate: parseFloat(metrics.error_rate),
      requests_today: metrics.requests_today,
      spend_today: parseFloat(metrics.spend_today),
      monthly_limit_usd: budget.monthly_limit_usd ? parseFloat(budget.monthly_limit_usd) : null,
      current_spend_usd: budget.current_spend_usd ? parseFloat(budget.current_spend_usd) : null,
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/timeseries - Time-bucketed data for charts
router.get('/analytics/timeseries', async (req: Request, res: Response) => {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  const { metric, interval, from, to } = req.query;

  if (!metric || !from || !to) {
    return res.status(400).json({ error: 'Missing required query params: metric, from, to' });
  }

  const allowedMetrics = ['spend', 'requests', 'errors', 'latency'];
  if (!allowedMetrics.includes(metric as string)) {
    return res.status(400).json({ error: `Invalid metric. Must be one of: ${allowedMetrics.join(', ')}` });
  }

  const bucketInterval = interval === 'hour' ? '1 hour' : '1 day';

  let aggregation: string;
  switch (metric) {
    case 'spend':
      aggregation = 'COALESCE(SUM(cost_usd), 0)';
      break;
    case 'requests':
      aggregation = 'COUNT(*)';
      break;
    case 'errors':
      aggregation = "COUNT(*) FILTER (WHERE status = 'error')";
      break;
    case 'latency':
      aggregation = 'ROUND(COALESCE(AVG(latency_ms), 0))';
      break;
    default:
      aggregation = 'COUNT(*)';
  }

  try {
    const result = await pool.query(
      `SELECT time_bucket($1::interval, time) AS bucket,
              ${aggregation}::numeric AS value
       FROM request_logs
       WHERE team_id = $2 AND time >= $3 AND time <= $4
       GROUP BY bucket
       ORDER BY bucket`,
      [bucketInterval, teamId, from, to]
    );

    return res.json({
      buckets: result.rows.map((row) => ({
        time: row.bucket,
        value: parseFloat(row.value),
      })),
    });
  } catch (error) {
    console.error('Error fetching timeseries data:', error);
    return res.status(500).json({ error: 'Failed to fetch timeseries data' });
  }
});

// GET /api/teams/settings - Read full team settings
router.get('/teams/settings', async (req: Request, res: Response) => {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is missing' });
  }

  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.pii_redaction_enabled, t.fallback_config,
              b.monthly_limit_usd, b.current_spend_usd, b.reset_at
       FROM teams t
       LEFT JOIN team_budgets b ON t.id = b.team_id
       WHERE t.id = $1`,
      [teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching team settings:', error);
    return res.status(500).json({ error: 'Failed to fetch team settings' });
  }
});

export default router;

