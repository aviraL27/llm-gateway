import { LLMRequest } from '@llm-gateway/types';
import { LLMProvider } from './base';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];

  estimateCost(promptTokens: number, completionTokens: number, model: string): number {
    // Cost per 1000 tokens
    let promptRate = 0.005;      // Default $5.00 / 1M tokens
    let completionRate = 0.015;  // Default $15.00 / 1M tokens

    const modelName = model.toLowerCase();
    if (modelName.includes('gpt-4o-mini')) {
      promptRate = 0.00015;      // $0.15 / 1M tokens
      completionRate = 0.0006;   // $0.60 / 1M tokens
    } else if (modelName.includes('gpt-4o')) {
      promptRate = 0.005;        // $5.00 / 1M tokens
      completionRate = 0.015;    // $15.00 / 1M tokens
    } else if (modelName.includes('gpt-3.5')) {
      promptRate = 0.0015;       // $1.50 / 1M tokens
      completionRate = 0.002;        // $2.00 / 1M tokens
    }

    const promptCost = (promptTokens / 1000) * promptRate;
    const completionCost = (completionTokens / 1000) * completionRate;

    return promptCost + completionCost;
  }

  async createStreamingRequest(payload: LLMRequest, apiKey: string): Promise<Response> {
    const baseUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    // Inject stream_options so OpenAI includes final token usage in the stream
    const modifiedBody = {
      ...payload,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(modifiedBody),
    });

    return response;
  }
}
