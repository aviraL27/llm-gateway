import { LLMRequest } from '@llm-gateway/types';

export interface LLMProvider {
  name: string;
  models: string[];
  estimateCost(promptTokens: number, completionTokens: number, model: string): number;
  createStreamingRequest(payload: LLMRequest, apiKey: string): Promise<Response>;
}
