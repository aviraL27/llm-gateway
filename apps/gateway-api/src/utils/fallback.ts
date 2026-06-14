import { pool } from '@llm-gateway/db';
import { redis } from '../redis';

export interface FallbackConfig {
  thresholds?: Array<{
    spend_usd: number;
    action: string;
    from: string;
    to: string;
  }>;
  provider_fallback?: {
    openai_error: string;
    model_map: Record<string, string>;
  };
}

export function evaluateModelThresholds(
  fallbackConfig: FallbackConfig | null,
  requestedModel: string,
  currentSpend: number
): { model: string; wasDowngraded: boolean } {
  let currentModel = requestedModel;
  let wasDowngraded = false;

  if (fallbackConfig && Array.isArray(fallbackConfig.thresholds)) {
    // Evaluate thresholds in order
    for (const rule of fallbackConfig.thresholds) {
      if (
        rule.action === 'downgrade' &&
        currentSpend >= rule.spend_usd &&
        currentModel.toLowerCase() === rule.from.toLowerCase()
      ) {
        currentModel = rule.to;
        wasDowngraded = true;
      }
    }
  }

  return { model: currentModel, wasDowngraded };
}

export async function selectModel(
  teamId: string,
  requestedModel: string,
  currentSpend: number
): Promise<{ provider: string; model: string; wasDowngraded: boolean }> {
  const cacheKey = `team_config:${teamId}`;
  let fallbackConfig: FallbackConfig | null = null;

  try {
    // 1. Try reading from Redis cache
    const cachedConfig = await redis.get(cacheKey);

    if (cachedConfig !== null) {
      fallbackConfig = JSON.parse(cachedConfig);
    } else {
      // 2. Cache miss: read from Database
      const result = await pool.query(
        'SELECT fallback_config FROM teams WHERE id = $1',
        [teamId]
      );

      if (result.rows.length > 0 && result.rows[0].fallback_config) {
        fallbackConfig = result.rows[0].fallback_config;
      }

      // Cache the result in Redis for 5 minutes (300 seconds)
      await redis.setex(cacheKey, 300, JSON.stringify(fallbackConfig || {}));
    }
  } catch (error) {
    console.error('Error fetching fallback config from cache/DB:', error);
    // Fallback config stays null (no thresholds will be applied)
  }

  // 3. Evaluate thresholds
  const { model, wasDowngraded } = evaluateModelThresholds(fallbackConfig, requestedModel, currentSpend);

  // 4. Map model to provider
  let provider = 'openai';
  if (model.toLowerCase().startsWith('claude-')) {
    provider = 'anthropic';
  }

  return {
    provider,
    model,
    wasDowngraded,
  };
}
