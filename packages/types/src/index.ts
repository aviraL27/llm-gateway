export interface Team {
  id: string;
  name: string;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  team_id: string;
  key_hash: string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
  is_active: boolean;
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LogEntry {
  time: Date;
  team_id: string;
  api_key_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: string;
  pii_detected: boolean;
}
