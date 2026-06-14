import { LLMRequest } from '@llm-gateway/types';
import { LLMProvider } from './base';
export declare class AnthropicProvider implements LLMProvider {
    name: string;
    models: string[];
    estimateCost(promptTokens: number, completionTokens: number, model: string): number;
    createStreamingRequest(payload: LLMRequest, apiKey: string): Promise<Response>;
}
//# sourceMappingURL=anthropic.d.ts.map