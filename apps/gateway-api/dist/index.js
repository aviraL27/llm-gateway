"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const keys_1 = __importDefault(require("./routes/keys"));
const proxy_1 = __importDefault(require("./routes/proxy"));
const auth_1 = require("./middlewares/auth");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const spendGuard_1 = require("./middlewares/spendGuard");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Public healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'gateway-api' });
});
// Dashboard routes (require Supabase JWT)
app.use('/api', auth_1.validateDashboardAuth, keys_1.default);
// Programmatic Gateway routes (require API key auth)
app.use('/v1', proxy_1.default);
// Test endpoint for key validation, rate limiter, and spend guard
app.get('/v1/protected', auth_1.validateApiKey, rateLimiter_1.rateLimiter, spendGuard_1.spendGuard, (req, res) => {
    res.json({
        message: 'Access granted via API key!',
        team_id: req.team_id,
        api_key_id: req.api_key_id,
    });
});
app.listen(port, () => {
    console.log(`Gateway API listening at http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map