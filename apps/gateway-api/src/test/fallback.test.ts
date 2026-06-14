import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateModelThresholds, selectModel, FallbackConfig } from '../utils/fallback';
import { redis } from '../redis';
import { pool } from '@llm-gateway/db';

vi.mock('../redis', () => {
  return {
    redis: {
      get: vi.fn(),
      setex: vi.fn(),
    },
  };
});

vi.mock('@llm-gateway/db', () => {
  return {
    pool: {
      query: vi.fn(),
    },
  };
});

describe('Model Fallback Logic Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateModelThresholds', () => {
    it('should return the requested model if config is empty or null', () => {
      const result = evaluateModelThresholds(null, 'gpt-4o', 10.00);
      expect(result).toEqual({ model: 'gpt-4o', wasDowngraded: false });
    });

    it('should not downgrade if spend is below the threshold', () => {
      const config: FallbackConfig = {
        thresholds: [
          {
            spend_usd: 50.00,
            action: 'downgrade',
            from: 'gpt-4o',
            to: 'gpt-4o-mini',
          },
        ],
      };
      const result = evaluateModelThresholds(config, 'gpt-4o', 49.99);
      expect(result).toEqual({ model: 'gpt-4o', wasDowngraded: false });
    });

    it('should downgrade if spend is equal to or exceeds the threshold', () => {
      const config: FallbackConfig = {
        thresholds: [
          {
            spend_usd: 50.00,
            action: 'downgrade',
            from: 'gpt-4o',
            to: 'gpt-4o-mini',
          },
        ],
      };
      const result1 = evaluateModelThresholds(config, 'gpt-4o', 50.00);
      expect(result1).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });

      const result2 = evaluateModelThresholds(config, 'gpt-4o', 100.00);
      expect(result2).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });
    });

    it('should case-insensitively match the model name', () => {
      const config: FallbackConfig = {
        thresholds: [
          {
            spend_usd: 10.00,
            action: 'downgrade',
            from: 'GPT-4o',
            to: 'gpt-4o-mini',
          },
        ],
      };
      const result = evaluateModelThresholds(config, 'gpt-4o', 15.00);
      expect(result).toEqual({ model: 'gpt-4o-mini', wasDowngraded: true });
    });

    it('should cascade multiple downgrade rules in order', () => {
      const config: FallbackConfig = {
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
      expect(evaluateModelThresholds(config, 'gpt-4o', 5.00)).toEqual({
        model: 'gpt-4o',
        wasDowngraded: false,
      });

      // Exceeds first threshold, but not second
      expect(evaluateModelThresholds(config, 'gpt-4o', 15.00)).toEqual({
        model: 'gpt-4o-mini',
        wasDowngraded: true,
      });

      // Exceeds both thresholds (cascades all the way)
      expect(evaluateModelThresholds(config, 'gpt-4o', 25.00)).toEqual({
        model: 'gpt-3.5-turbo',
        wasDowngraded: true,
      });
    });
  });

  describe('selectModel', () => {
    const teamId = 'team-123';

    it('should use cached configuration from Redis on hit', async () => {
      const config: FallbackConfig = {
        thresholds: [
          {
            spend_usd: 10.00,
            action: 'downgrade',
            from: 'gpt-4o',
            to: 'gpt-4o-mini',
          },
        ],
      };

      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(config));

      const result = await selectModel(teamId, 'gpt-4o', 15.00);

      expect(redis.get).toHaveBeenCalledWith(`team_config:${teamId}`);
      expect(pool.query).not.toHaveBeenCalled();
      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini',
        wasDowngraded: true,
      });
    });

    it('should fetch from database and cache in Redis on cache miss', async () => {
      const config: FallbackConfig = {
        thresholds: [
          {
            spend_usd: 10.00,
            action: 'downgrade',
            from: 'gpt-4o',
            to: 'gpt-4o-mini',
          },
        ],
      };

      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ fallback_config: config }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      const result = await selectModel(teamId, 'gpt-4o', 15.00);

      expect(redis.get).toHaveBeenCalledWith(`team_config:${teamId}`);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT fallback_config FROM teams WHERE id = $1',
        [teamId]
      );
      expect(redis.setex).toHaveBeenCalledWith(
        `team_config:${teamId}`,
        300,
        JSON.stringify(config)
      );
      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini',
        wasDowngraded: true,
      });
    });

    it('should map claude- models to anthropic provider', async () => {
      const config: FallbackConfig = {};

      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(config));

      const result = await selectModel(teamId, 'claude-3-opus', 5.00);

      expect(result).toEqual({
        provider: 'anthropic',
        model: 'claude-3-opus',
        wasDowngraded: false,
      });
    });

    it('should degrade gracefully and use requested model if Redis/DB throws an error', async () => {
      vi.mocked(redis.get).mockRejectedValueOnce(new Error('Redis is down'));

      const result = await selectModel(teamId, 'gpt-4o', 15.00);

      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
        wasDowngraded: false,
      });
    });
  });
});
