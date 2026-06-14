import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5435/llm_gateway';

export const pool = new Pool({
  connectionString,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
