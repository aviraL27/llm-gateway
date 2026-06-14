"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@llm-gateway/db");
const redis_1 = require("../redis");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// POST /api/keys - Generate a new API key
router.post('/keys', async (req, res) => {
    const { name } = req.body;
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is missing' });
    }
    const keyName = name || 'Default Key';
    try {
        // 1. Generate Raw Key: lgw_live_ + 32 random bytes as hex
        const rawKey = `lgw_live_${crypto_1.default.randomBytes(32).toString('hex')}`;
        const hash = (0, auth_1.hashApiKey)(rawKey);
        // Start a transaction to ensure atomic budget check + key creation
        const client = await db_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 2. Insert key hash into api_keys table
            const keyInsert = await client.query(`INSERT INTO api_keys (team_id, key_hash, name, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, name, created_at`, [teamId, hash, keyName]);
            const newKey = keyInsert.rows[0];
            // 3. Ensure a team_budgets row exists for the team
            // Set reset_at to 1st of next month
            await client.query(`INSERT INTO team_budgets (team_id, monthly_limit_usd, current_spend_usd, reset_at)
         VALUES ($1, 100.00, 0.00, DATE_TRUNC('month', NOW() + INTERVAL '1 month'))
         ON CONFLICT (team_id) DO NOTHING`, [teamId]);
            await client.query('COMMIT');
            // 4. Return the raw key exactly once
            return res.status(201).json({
                id: newKey.id,
                name: newKey.name,
                created_at: newKey.created_at,
                key: rawKey, // Raw key is returned ONLY once
            });
        }
        catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('Error generating API key:', error);
        return res.status(500).json({ error: 'Failed to generate API key' });
    }
});
// GET /api/keys - List all keys for the team
router.get('/keys', async (req, res) => {
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is missing' });
    }
    try {
        const result = await db_1.pool.query(`SELECT id, name, created_at, last_used_at, is_active
       FROM api_keys
       WHERE team_id = $1
       ORDER BY created_at DESC`, [teamId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing API keys:', error);
        return res.status(500).json({ error: 'Failed to list API keys' });
    }
});
// DELETE /api/keys/:id - Deactivate an API key
router.delete('/keys/:id', async (req, res) => {
    const { id } = req.params;
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is missing' });
    }
    try {
        // 1. Deactivate key in DB
        const result = await db_1.pool.query(`UPDATE api_keys
       SET is_active = false
       WHERE id = $1 AND team_id = $2
       RETURNING key_hash`, [id, teamId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }
        const hash = result.rows[0].key_hash;
        // 2. Remove key from Redis cache
        await redis_1.redis.del(`apikey:${hash}`);
        return res.json({ message: 'API key deactivated successfully' });
    }
    catch (error) {
        console.error('Error deactivating API key:', error);
        return res.status(500).json({ error: 'Failed to deactivate API key' });
    }
});
// PUT /teams/budget - Upsert budget configuration
router.put('/teams/budget', async (req, res) => {
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
        const result = await db_1.pool.query(`INSERT INTO team_budgets (team_id, monthly_limit_usd, current_spend_usd, reset_at)
       VALUES ($1, $2, 0.00, DATE_TRUNC('month', NOW() + INTERVAL '1 month'))
       ON CONFLICT (team_id)
       DO UPDATE SET monthly_limit_usd = EXCLUDED.monthly_limit_usd
       RETURNING team_id, monthly_limit_usd, current_spend_usd, reset_at`, [teamId, monthly_limit_usd]);
        // 2. Delete Redis cache keys to force a refresh on the next request
        await redis_1.redis.del(`team_spend:${teamId}`);
        await redis_1.redis.del(`team_budget_limit:${teamId}`);
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating team budget:', error);
        return res.status(500).json({ error: 'Failed to update team budget' });
    }
});
// PUT /teams/config - Update team configurations (e.g. fallback_config)
router.put('/teams/config', async (req, res) => {
    const { fallback_config } = req.body;
    const teamId = req.team_id;
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID is missing' });
    }
    if (fallback_config === undefined || typeof fallback_config !== 'object') {
        return res.status(400).json({ error: 'Invalid fallback_config. Must be an object.' });
    }
    try {
        // 1. Update teams table
        const result = await db_1.pool.query(`UPDATE teams
       SET fallback_config = $1
       WHERE id = $2
       RETURNING id, name, fallback_config`, [JSON.stringify(fallback_config), teamId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        // 2. Delete Redis cache key to force refresh
        await redis_1.redis.del(`team_config:${teamId}`);
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating team config:', error);
        return res.status(500).json({ error: 'Failed to update team configuration' });
    }
});
exports.default = router;
//# sourceMappingURL=keys.js.map