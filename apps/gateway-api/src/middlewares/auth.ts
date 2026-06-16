import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
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

// Hash function
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid API key format' });
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer '
  const hash = hashApiKey(apiKey);

  try {
    // 1. Check Redis cache
    const cacheKey = `apikey:${hash}`;
    const cached = await redis.get(cacheKey);

    let teamId: string;
    let apiKeyId: string;

    if (cached) {
      const parts = cached.split(':');
      teamId = parts[0];
      apiKeyId = parts[1];
    } else {
      // 2. Query DB
      const result = await pool.query(
        'SELECT id, team_id FROM api_keys WHERE key_hash = $1 AND is_active = true',
        [hash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
      }

      apiKeyId = result.rows[0].id;
      teamId = result.rows[0].team_id;

      // 3. Cache in Redis for 5 minutes (300 seconds)
      await redis.setex(cacheKey, 300, `${teamId}:${apiKeyId}`);
    }

    // Attach values to req
    req.team_id = teamId;
    req.api_key_id = apiKeyId;

    // 4. Update last_used_at async (fire-and-forget)
    pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKeyId]).catch((err) => {
      console.error('Failed to update last_used_at:', err);
    });

    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function validateDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.substring(7);
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error('SUPABASE_JWT_SECRET environment variable is missing');
    return res.status(500).json({ error: 'Internal server error: JWT secret not configured' });
  }

  try {
    const decoded = jwt.verify(token, secret) as any;
    const userId = decoded.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    req.user_id = userId;

    // Determine team_id (custom claim first, then fallback to user_id)
    // Avoid using client-writable user_metadata to prevent BOLA escalation
    const teamId = decoded.app_metadata?.team_id || userId;

    // Ensure the team exists in the teams table
    const teamResult = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      // Create team for the user
      await pool.query(
        'INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [teamId, `Team ${teamId.substring(0, 8)}`]
      );
    }

    req.team_id = teamId;
    next();
  } catch (error) {
    console.error('Error verifying Supabase JWT:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
