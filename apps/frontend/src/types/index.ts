export interface RequestLog {
  time: string;
  team_id: string;
  api_key_id: string;
  provider: string;
  model: string;
  model_used: string | null;
  was_fallback: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: string; // comes as string from NUMERIC
  latency_ms: number;
  status: string;
  pii_detected: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  key?: string; // only on creation
}

export interface OverviewMetrics {
  total_requests: number;
  total_spend: number;
  avg_latency: number;
  error_rate: number;
  requests_today: number;
  spend_today: number;
  monthly_limit_usd: number;
  current_spend_usd: number;
}

export interface TimeseriesBucket {
  time: string;
  value: number;
}

export interface TeamSettings {
  id: string;
  name: string;
  pii_redaction_enabled: boolean;
  fallback_config: any;
  monthly_limit_usd: number | null;
  current_spend_usd: number | null;
  reset_at: string | null;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LogFilters {
  provider?: string;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
}
