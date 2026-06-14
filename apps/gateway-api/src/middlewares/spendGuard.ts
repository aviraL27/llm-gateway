import { Request, Response, NextFunction } from 'express';
import { pool } from '@llm-gateway/db';
import { redis } from '../redis';

declare global {
  namespace Express {
    interface Request {
      team_id?: string;
      api_key_id?: string;
      user_id?: string;
    }
  }
}

function getSecondsUntilEndOfMonth(): number {
  const now = new Date();
  // 1st of next month at 00:00:00
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  return Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);
}

export async function spendGuard(req: Request, res: Response, next: NextFunction) {
  const teamId = req.team_id;

  if (!teamId) {
    return res.status(500).json({ error: 'Spend guard error: Team ID not found on request' });
  }

  const spendKey = `team_spend:${teamId}`;
  const limitKey = `team_budget_limit:${teamId}`;

  try {
    // 1. Try fetching from Redis cache
    const [cachedSpend, cachedLimit] = await Promise.all([
      redis.get(spendKey),
      redis.get(limitKey),
    ]);

    let currentSpend: number;
    let limit: number;
    let resetAt: string;

    if (cachedSpend !== null && cachedLimit !== null) {
      currentSpend = parseFloat(cachedSpend);
      const limitConfig = JSON.parse(cachedLimit);
      limit = limitConfig.monthly_limit_usd;
      resetAt = limitConfig.reset_at;
    } else {
      // 2. Cache miss: Query DB
      const result = await pool.query(
        `SELECT monthly_limit_usd, current_spend_usd, reset_at 
         FROM team_budgets 
         WHERE team_id = $1`,
        [teamId]
      );

      if (result.rows.length === 0) {
        // No budget row exists -> treat as unlimited
        return next();
      }

      const budgetRow = result.rows[0];
      currentSpend = parseFloat(budgetRow.current_spend_usd);
      limit = parseFloat(budgetRow.monthly_limit_usd);
      resetAt = budgetRow.reset_at.toISOString();

      // 3. Cache in Redis
      const ttl = getSecondsUntilEndOfMonth();
      await Promise.all([
        redis.setex(spendKey, ttl, currentSpend.toString()),
        redis.setex(
          limitKey,
          ttl,
          JSON.stringify({
            monthly_limit_usd: limit,
            reset_at: resetAt,
          })
        ),
      ]);
    }

    // 4. Compare spend against limit
    if (currentSpend >= limit) {
      return res.status(429).json({
        error: 'Monthly budget exceeded',
        limit: limit,
        current: currentSpend,
        reset_at: resetAt,
      });
    }

    next();
  } catch (error) {
    console.error('Spend guard error:', error);
    // Fail-open to avoid blocking requests if DB or Redis is down
    next();
  }
}
