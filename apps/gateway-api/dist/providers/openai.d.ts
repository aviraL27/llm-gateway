import { LLMRequest } from '@llm-gateway/types';
import { LLMProvider } from './base';
export declare class OpenAIProvider implements LLMProvider {
    name: string;
    models: string[];
    estimateCost(promptTokens: number, completionTokens: number, model: string): number;
    createStreamingRequest(payload: LLMRequest, apiKey: string): Promise<Response>;
}
//# sourceMappingURL=openai.d.ts.map