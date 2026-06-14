-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create request_logs table
CREATE TABLE IF NOT EXISTS request_logs (
  time TIMESTAMPTZ NOT NULL,
  team_id UUID NOT NULL,
  api_key_id UUID NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  cost_usd NUMERIC NOT NULL,
  latency_ms INT NOT NULL,
  status TEXT NOT NULL,
  pii_detected BOOLEAN NOT NULL DEFAULT FALSE
);

-- Convert request_logs to hypertable
SELECT create_hypertable('request_logs', 'time', if_not_exists => TRUE);

-- Create team_budgets table
CREATE TABLE IF NOT EXISTS team_budgets (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  monthly_limit_usd NUMERIC NOT NULL DEFAULT 0.00,
  current_spend_usd NUMERIC NOT NULL DEFAULT 0.00,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying logs by team
CREATE INDEX IF NOT EXISTS idx_request_logs_team_time ON request_logs(team_id, time DESC);
