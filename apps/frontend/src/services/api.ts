import type {
  OverviewMetrics,
  TimeseriesBucket,
  PaginatedResponse,
  RequestLog,
  ApiKey,
  TeamSettings,
  LogFilters,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return localStorage.getItem('llm-gateway-token');
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed with status ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json();
}

// ── Analytics ────────────────────────────────────────────────────────

export function getOverview(): Promise<OverviewMetrics> {
  return authFetch<OverviewMetrics>('/api/analytics/overview');
}

export function getTimeseries(
  metric: string,
  from: string,
  to: string,
  interval?: string,
): Promise<{ buckets: TimeseriesBucket[] }> {
  const params = new URLSearchParams({ metric, from, to });
  if (interval) params.set('interval', interval);
  return authFetch<{ buckets: TimeseriesBucket[] }>(`/api/analytics/timeseries?${params}`);
}

// ── Logs ─────────────────────────────────────────────────────────────

export function getLogs(
  page: number,
  limit: number,
  filters: LogFilters,
): Promise<PaginatedResponse<RequestLog>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters.provider) params.set('provider', filters.provider);
  if (filters.model) params.set('model', filters.model);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  return authFetch<PaginatedResponse<RequestLog>>(`/api/logs?${params}`);
}

// ── API Keys ─────────────────────────────────────────────────────────

export function getKeys(): Promise<ApiKey[]> {
  return authFetch<ApiKey[]>('/api/keys');
}

export function createKey(name: string): Promise<ApiKey> {
  return authFetch<ApiKey>('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteKey(id: string): Promise<void> {
  return authFetch<void>(`/api/keys/${id}`, {
    method: 'DELETE',
  });
}

// ── Team Settings ────────────────────────────────────────────────────

export function getTeamSettings(): Promise<TeamSettings> {
  return authFetch<TeamSettings>('/api/teams/settings');
}

export function updateBudget(monthly_limit_usd: number): Promise<any> {
  return authFetch<any>('/api/teams/budget', {
    method: 'PUT',
    body: JSON.stringify({ monthly_limit_usd }),
  });
}

export function updateFallbackConfig(fallback_config: any): Promise<any> {
  return authFetch<any>('/api/teams/config', {
    method: 'PUT',
    body: JSON.stringify({ fallback_config }),
  });
}

export function updatePiiSettings(enabled: boolean): Promise<any> {
  return authFetch<any>('/api/teams/config', {
    method: 'PUT',
    body: JSON.stringify({ pii_redaction_enabled: enabled }),
  });
}
