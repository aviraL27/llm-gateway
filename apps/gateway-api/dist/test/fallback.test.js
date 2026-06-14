"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fallback_1 = require("../utils/fallback");
const redis_1 = require("../redis");
const db_1 = require("@llm-gateway/db");
vitest_1.vi.mock('../redis', () => {
    return {
        redis: {
            get: vitest_1.vi.fn(),
            setex: vitest_1.vi.fn(),
        },
    };
});
vitest_1.vi.mock('@llm-gateway/db', () => {
    return {
        pool: {
            query: vitest_1.vi.fn(),
        },
    };
});
(0, vitest_1.describe)('Model Fallback Logic Unit Tests', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('evaluateModelThresholds', () => {
        (0, vitest_1.it)('should return the requested model if config is empty or null', () => {
            const result = (0, fallback_1.evaluateModelThresholds)(null, 'gpt-4o', 10.00);
            (0, vitest_1.expect)(result).toEqual({ model: 'gpt-4o', wasDowngraded: false });
        });
        (0, vitest_1.it)('should not downgrade if spend is below the threshold', () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 50.00,
                        action: 'downgrade',
                        from: 'gpt-4o',
                        to: 'gpt-4o-mini',
                    },
                ],
            };
            const result = (0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 49.99);
            (0, vitest_1.expect)(result).toEqual({ model: 'gpt-4o', wasDowngraded: false });
        });
        (0, vitest_1.it)('should downgrade if spend is equal to or exceeds the threshold', () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 50.00,
                        action: 'downgrade',
                        from: 'gpt-4o',
                        to: 'gpt-4o-mini',
                    },
                ],
            };
            const result1 = (0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 50.00);
            (0, vitest_1.expect)(result1).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });
            const result2 = (0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 100.00);
            (0, vitest_1.expect)(result2).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });
        });
        (0, vitest_1.it)('should case-insensitively match the model name', () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 10.00,
                        action: 'downgrade',
                        from: 'GPT-4o',
                        to: 'gpt-4o-mini',
                    },
                ],
            };
            const result = (0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 15.00);
            (0, vitest_1.expect)(result).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });
        });
        (0, vitest_1.it)('should cascade multiple downgrade rules in order', () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 10.00,
                        action: 'downgrade',
                        from: 'gpt-4o',
                        to: 'gpt-4o-mini',
                    },
                    {
                        spend_usd: 20.00,
                        action: 'downgrade',
                        from: 'gpt-4o-mini',
                        to: 'gpt-3.5-turbo',
                    },
                ],
            };
            // Below first threshold
            (0, vitest_1.expect)((0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 5.00)).toEqual({
                model: 'gpt-4o',
                wasDowngraded: false,
            });
            // Exceeds first threshold, but not second
            (0, vitest_1.expect)((0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 15.00)).toEqual({
                model: 'gpt-4o-mini',
                wasDowngraded: true,
            });
            // Exceeds both thresholds (cascades all the way)
            (0, vitest_1.expect)((0, fallback_1.evaluateModelThresholds)(config, 'gpt-4o', 25.00)).toEqual({
                model: 'gpt-3.5-turbo',
                wasDowngraded: true,
            });
        });
    });
    (0, vitest_1.describe)('selectModel', () => {
        const teamId = 'team-123';
        (0, vitest_1.it)('should use cached configuration from Redis on hit', async () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 10.00,
                        action: 'downgrade',
                        from: 'gpt-4o',
                        to: 'gpt-4o-mini',
                    },
                ],
            };
            vitest_1.vi.mocked(redis_1.redis.get).mockResolvedValueOnce(JSON.stringify(config));
            const result = await (0, fallback_1.selectModel)(teamId, 'gpt-4o', 15.00);
            (0, vitest_1.expect)(redis_1.redis.get).toHaveBeenCalledWith(`team_config:${teamId}`);
            (0, vitest_1.expect)(db_1.pool.query).not.toHaveBeenCalled();
            (0, vitest_1.expect)(result).toEqual({
                provider: 'openai',
                model: 'gpt-4o-mini',
                wasDowngraded: true,
            });
        });
        (0, vitest_1.it)('should fetch from database and cache in Redis on cache miss', async () => {
            const config = {
                thresholds: [
                    {
                        spend_usd: 10.00,
                        action: 'downgrade',
                        from: 'gpt-4o',
                        to: 'gpt-4o-mini',
                    },
                ],
            };
            vitest_1.vi.mocked(redis_1.redis.get).mockResolvedValueOnce(null);
            vitest_1.vi.mocked(db_1.pool.query).mockResolvedValueOnce({
                rows: [{ fallback_config: config }],
                command: '',
                rowCount: 1,
                oid: 0,
                fields: [],
            });
            const result = await (0, fallback_1.selectModel)(teamId, 'gpt-4o', 15.00);
            (0, vitest_1.expect)(redis_1.redis.get).toHaveBeenCalledWith(`team_config:${teamId}`);
            (0, vitest_1.expect)(db_1.pool.query).toHaveBeenCalledWith('SELECT fallback_config FROM teams WHERE id = $1', [teamId]);
            (0, vitest_1.expect)(redis_1.redis.setex).toHaveBeenCalledWith(`team_config:${teamId}`, 300, JSON.stringify(config));
            (0, vitest_1.expect)(result).toEqual({
                provider: 'openai',
                model: 'gpt-4o-mini',
                wasDowngraded: true,
            });
        });
        (0, vitest_1.it)('should map claude- models to anthropic provider', async () => {
            const config = {};
            vitest_1.vi.mocked(redis_1.redis.get).mockResolvedValueOnce(JSON.stringify(config));
            const result = await (0, fallback_1.selectModel)(teamId, 'claude-3-opus', 5.00);
            (0, vitest_1.expect)(result).toEqual({
                provider: 'anthropic',
                model: 'claude-3-opus',
                wasDowngraded: false,
            });
        });
        (0, vitest_1.it)('should degrade gracefully and use requested model if Redis/DB throws an error', async () => {
            vitest_1.vi.mocked(redis_1.redis.get).mockRejectedValueOnce(new Error('Redis is down'));
            const result = await (0, fallback_1.selectModel)(teamId, 'gpt-4o', 15.00);
            (0, vitest_1.expect)(result).toEqual({
                provider: 'openai',
                model: 'gpt-4o',
                wasDowngraded: false,
            });
        });
    });
});
//# sourceMappingURL=fallback.test.js.map