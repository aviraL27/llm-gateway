"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bullmq_1 = require("bullmq");
const auth_1 = require("../middlewares/auth");
const rateLimiter_1 = require("../middlewares/rateLimiter");
const spendGuard_1 = require("../middlewares/spendGuard");
const piiRedactor_1 = require("../middlewares/piiRedactor");
const openai_1 = require("../providers/openai");
const anthropic_1 = require("../providers/anthropic");
const redis_1 = require("../redis");
const fallback_1 = require("../utils/fallback");
const db_1 = require("@llm-gateway/db");
const router = (0, express_1.Router)();
const logQueue = new bullmq_1.Queue('request-logs', { connection: redis_1.redis });
const openaiProvider = new openai_1.OpenAIProvider();
const anthropicProvider = new anthropic_1.AnthropicProvider();
router.post('/chat/completions', auth_1.validateApiKey, rateLimiter_1.rateLimiter, spendGuard_1.spendGuard, piiRedactor_1.piiRedactor, async (req, res) => {
    const { model, messages, stream, temperature, max_tokens } = req.body;
    if (!model) {
        return res.status(400).json({ error: 'Model parameter is required' });
    }
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages parameter is required and must be an array' });
    }
    const startTime = Date.now();
    let promptTokens = 0;
    let completionTokens = 0;
    let status = 'success';
    let isClosed = false;
    let wasFallbackTriggered = false;
    let modelUsed = model;
    let provider = openaiProvider;
    // Helper to log metrics to BullMQ queue
    const finalizeRequest = async (errorState) => {
        if (isClosed)
            return;
        isClosed = true;
        if (errorState) {
            status = errorState;
        }
        const latency = Date.now() - startTime;
        const cost = provider.estimateCost(promptTokens, completionTokens, modelUsed);
        try {
            await logQueue.add('log-request', {
                team_id: req.team_id,
                api_key_id: req.api_key_id,
                provider: provider.name,
                model, // original model requested
                model_used: modelUsed, // actual model executed
                was_fallback: wasFallbackTriggered,
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                cost_usd: cost,
                latency_ms: latency,
                status,
                pii_detected: req.pii_detected || false,
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });
        }
        catch (err) {
            console.error('Failed to enqueue request log:', err);
        }
    };
    try {
        // 1. Fetch current spend to evaluate thresholds
        let currentSpend = 0.00;
        const spendVal = await redis_1.redis.get(`team_spend:${req.team_id}`);
        if (spendVal !== null) {
            currentSpend = parseFloat(spendVal);
        }
        else {
            const budgetRes = await db_1.pool.query('SELECT current_spend_usd FROM team_budgets WHERE team_id = $1', [req.team_id]);
            if (budgetRes.rows.length > 0) {
                currentSpend = parseFloat(budgetRes.rows[0].current_spend_usd);
            }
        }
        // 2. Select model based on thresholds
        const selection = await (0, fallback_1.selectModel)(req.team_id, model, currentSpend);
        let selectedProviderName = selection.provider;
        modelUsed = selection.model;
        if (selection.wasDowngraded) {
            console.warn(`[Fallback] Model for team ${req.team_id} downgraded from ${model} to ${modelUsed} due to spend threshold (Current spend: $${currentSpend})`);
        }
        // Load full fallback_config to check for provider failover rules later
        let fallbackConfig = null;
        const cachedConfig = await redis_1.redis.get(`team_config:${req.team_id}`);
        if (cachedConfig !== null) {
            fallbackConfig = JSON.parse(cachedConfig);
        }
        else {
            const configRes = await db_1.pool.query('SELECT fallback_config FROM teams WHERE id = $1', [req.team_id]);
            if (configRes.rows.length > 0 && configRes.rows[0].fallback_config) {
                fallbackConfig = configRes.rows[0].fallback_config;
            }
        }
        // 3. Helper to instantiate provider
        const getProvider = (name) => {
            return name === 'anthropic' ? anthropicProvider : openaiProvider;
        };
        const getApiKey = (name) => {
            const envVar = name === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            return process.env[envVar] || '';
        };
        provider = getProvider(selectedProviderName);
        let providerApiKey = getApiKey(selectedProviderName);
        if (!providerApiKey) {
            return res.status(400).json({ error: `Provider not configured. API key is missing for ${selectedProviderName}.` });
        }
        // 4. Create streaming request wrapper with provider failover fallback
        let response;
        const requestPayload = {
            model: modelUsed,
            messages,
            stream: true,
            temperature,
            max_tokens,
        };
        const makeRequest = async (provName, provModel) => {
            const p = getProvider(provName);
            const key = getApiKey(provName);
            if (!key)
                throw new Error(`API Key missing for fallback provider ${provName}`);
            return await p.createStreamingRequest({ ...requestPayload, model: provModel }, key);
        };
        try {
            response = await makeRequest(selectedProviderName, modelUsed);
            // Check if primary call failed and failover config is present
            const isErrorStatus = response.status === 429 || response.status >= 500;
            const failoverConfig = fallbackConfig?.provider_fallback;
            if (isErrorStatus && failoverConfig && failoverConfig.openai_error === 'anthropic' && selectedProviderName === 'openai') {
                const fallbackModel = failoverConfig.model_map?.[modelUsed];
                if (fallbackModel) {
                    console.warn(`[Fallback] Primary provider ${selectedProviderName} returned status ${response.status}. Failing over to Anthropic (${fallbackModel})...`);
                    response = await makeRequest('anthropic', fallbackModel);
                    selectedProviderName = 'anthropic';
                    modelUsed = fallbackModel;
                    provider = anthropicProvider;
                    wasFallbackTriggered = true;
                }
            }
        }
        catch (reqErr) {
            // Catch network exceptions and try to failover
            const failoverConfig = fallbackConfig?.provider_fallback;
            if (failoverConfig && failoverConfig.openai_error === 'anthropic' && selectedProviderName === 'openai') {
                const fallbackModel = failoverConfig.model_map?.[modelUsed];
                if (fallbackModel) {
                    console.warn('[Fallback] Primary provider request threw an error. Failing over to Anthropic...');
                    response = await makeRequest('anthropic', fallbackModel);
                    selectedProviderName = 'anthropic';
                    modelUsed = fallbackModel;
                    provider = anthropicProvider;
                    wasFallbackTriggered = true;
                }
                else {
                    throw reqErr;
                }
            }
            else {
                throw reqErr;
            }
        }
        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Fallback] Provider error status ${response.status}:`, errText);
            await finalizeRequest('error');
            return res.status(response.status).send(errText);
        }
        // 5. Set streaming response headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (wasFallbackTriggered) {
            res.setHeader('X-LLM-Gateway-Fallback', 'true');
        }
        res.flushHeaders();
        // Handle client cancellation
        req.on('close', () => {
            if (!isClosed) {
                finalizeRequest('cancelled');
            }
        });
        if (!response.body) {
            throw new Error('Response body is empty');
        }
        // 6. Process Stream Chunks
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of response.body) {
            if (isClosed)
                break;
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                if (provider.name === 'openai') {
                    res.write(`${trimmed}\n\n`);
                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.substring(6);
                        if (dataStr !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.usage) {
                                    promptTokens = parsed.usage.prompt_tokens || promptTokens;
                                    completionTokens = parsed.usage.completion_tokens || completionTokens;
                                }
                            }
                            catch (e) {
                                // Ignore partial JSON parse errors
                            }
                        }
                    }
                }
                else {
                    // Anthropic translation
                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.substring(6);
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'message_start') {
                                promptTokens = parsed.message?.usage?.input_tokens || 0;
                            }
                            else if (parsed.type === 'content_block_delta') {
                                const text = parsed.delta?.text || '';
                                const openAiChunk = {
                                    id: `chatcmpl-${parsed.message_id || 'anthropic'}`,
                                    object: 'chat.completion.chunk',
                                    created: Math.floor(Date.now() / 1000),
                                    model: modelUsed,
                                    choices: [
                                        {
                                            index: 0,
                                            delta: { content: text },
                                            finish_reason: null,
                                        },
                                    ],
                                };
                                res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`);
                            }
                            else if (parsed.type === 'message_delta') {
                                completionTokens = parsed.usage?.output_tokens || 0;
                            }
                            else if (parsed.type === 'message_stop') {
                                res.write('data: [DONE]\n\n');
                            }
                        }
                        catch (e) {
                            // Ignore partial JSON parse errors
                        }
                    }
                }
            }
        }
        await finalizeRequest();
        res.end();
    }
    catch (error) {
        console.error('Proxy request exception:', error);
        await finalizeRequest('error');
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal fallback proxy error' });
        }
        else {
            res.write('data: {"error": "Stream interrupted by fallback error"}\n\n');
            res.end();
        }
    }
});
exports.default = router;
//# sourceMappingURL=proxy.js.map