"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const redis_1 = require("../redis");
async function rateLimiter(req, res, next) {
    const apiKeyId = req.api_key_id;
    if (!apiKeyId) {
        return res.status(500).json({ error: 'Rate limiter error: API key ID not found on request' });
    }
    const limit = 60;
    const currentMinuteTimestamp = Math.floor(Date.now() / 60000) * 60;
    const key = `ratelimit:${apiKeyId}:${currentMinuteTimestamp}`;
    try {
        // Increment the count in Redis
        const current = await redis_1.redis.incr(key);
        // Ensure TTL is set on the key (robust against concurrent race conditions where current may bypass 1)
        const ttl = await redis_1.redis.ttl(key);
        if (ttl < 0) {
            await redis_1.redis.expire(key, 60);
        }
        const remaining = Math.max(0, limit - current);
        const resetTime = currentMinuteTimestamp + 60; // Next minute epoch in seconds
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', resetTime.toString());
        if (current > limit) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Limit is 60 requests per minute.',
            });
        }
        next();
    }
    catch (error) {
        console.error('Rate limiting error:', error);
        // Fail-open or fail-close? Standard practice for gateways is to allow request if Redis fails, but log it.
        // Let's allow the request so we don't break the gateway.
        next();
    }
}
//# sourceMappingURL=rateLimiter.js.map