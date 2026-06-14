"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spendGuard = spendGuard;
const db_1 = require("@llm-gateway/db");
const redis_1 = require("../redis");
function getSecondsUntilEndOfMonth() {
    const now = new Date();
    // 1st of next month at 00:00:00
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    return Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000);
}
async function spendGuard(req, res, next) {
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(500).json({ error: 'Spend guard error: Team ID not found on request' });
    }
    const spendKey = `team_spend:${teamId}`;
    const limitKey = `team_budget_limit:${teamId}`;
    try {
        // 1. Try fetching from Redis cache
        const [cachedSpend, cachedLimit] = await Promise.all([
            redis_1.redis.get(spendKey),
            redis_1.redis.get(limitKey),
        ]);
        let currentSpend;
        let limit;
        let resetAt;
        if (cachedSpend !== null && cachedLimit !== null) {
            currentSpend = parseFloat(cachedSpend);
            const limitConfig = JSON.parse(cachedLimit);
            limit = limitConfig.monthly_limit_usd;
            resetAt = limitConfig.reset_at;
        }
        else {
            // 2. Cache miss: Query DB
            const result = await db_1.pool.query(`SELECT monthly_limit_usd, current_spend_usd, reset_at 
         FROM team_budgets 
         WHERE team_id = $1`, [teamId]);
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
                redis_1.redis.setex(spendKey, ttl, currentSpend.toString()),
                redis_1.redis.setex(limitKey, ttl, JSON.stringify({
                    monthly_limit_usd: limit,
                    reset_at: resetAt,
                })),
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
    }
    catch (error) {
        console.error('Spend guard error:', error);
        // Fail-open to avoid blocking requests if DB or Redis is down
        next();
    }
}
//# sourceMappingURL=spendGuard.js.map