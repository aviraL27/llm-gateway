"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
class AnthropicProvider {
    name = 'anthropic';
    models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet',
        'claude-3-5-haiku',
        'claude-3-opus',
    ];
    estimateCost(promptTokens, completionTokens, model) {
        // Cost per 1000 tokens
        let promptRate = 0.003; // Default Claude 3.5 Sonnet: $3.00 / 1M tokens
        let completionRate = 0.015; // Default Claude 3.5 Sonnet: $15.00 / 1M tokens
        const modelName = model.toLowerCase();
        if (modelName.includes('haiku')) {
            promptRate = 0.0008; // $0.80 / 1M tokens
            completionRate = 0.004; // $4.00 / 1M tokens
        }
        else if (modelName.includes('opus')) {
            promptRate = 0.015; // $15.00 / 1M tokens
            completionRate = 0.075; // $75.00 / 1M tokens
        }
        else if (modelName.includes('sonnet')) {
            promptRate = 0.003; // $3.00 / 1M tokens
            completionRate = 0.015; // $15.00 / 1M tokens
        }
        const promptCost = (promptTokens / 1000) * promptRate;
        const completionCost = (completionTokens / 1000) * completionRate;
        return promptCost + completionCost;
    }
    async createStreamingRequest(payload, apiKey) {
        const baseUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com';
        const url = `${baseUrl}/v1/messages`;
        // Translate OpenAI payload structure to Anthropic messages payload
        const systemMessages = payload.messages.filter((m) => m.role === 'system');
        const nonSystemMessages = payload.messages.filter((m) => m.role !== 'system');
        // Extract system prompt string if present
        const systemPrompt = systemMessages.length > 0
            ? systemMessages.map((m) => m.content).join('\n')
            : undefined;
        // Anthropic requires max_tokens
        const maxTokens = payload.max_tokens || 1024;
        const modifiedBody = {
            model: payload.model,
            messages: nonSystemMessages.map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
            stream: true,
            max_tokens: maxTokens,
        };
        if (systemPrompt) {
            modifiedBody.system = systemPrompt;
        }
        if (payload.temperature !== undefined) {
            modifiedBody.temperature = payload.temperature;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(modifiedBody),
        });
        return response;
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic.js.map