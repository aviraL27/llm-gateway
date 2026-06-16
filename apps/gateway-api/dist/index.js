"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ioredis_1 = __importDefault(require("ioredis"));
const socket_io_1 = require("socket.io");
const keys_1 = __importDefault(require("./routes/keys"));
const proxy_1 = __importDefault(require("./routes/proxy"));
const auth_1 = require("./middlewares/auth");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const spendGuard_1 = require("./middlewares/spendGuard");
const db_1 = require("@llm-gateway/db");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Create HTTP server and Socket.IO instance
const server = http_1.default.createServer(app);
// Configure CORS origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || process.env.NODE_ENV === 'development') {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
    },
});
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
}));
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
// --- Socket.IO authentication & room joining ---
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
io.on('connection', (socket) => {
    const token = socket.handshake.auth.token;
    if (!token || !SUPABASE_JWT_SECRET) {
        socket.disconnect(true);
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, SUPABASE_JWT_SECRET);
        // Avoid using client-writable user_metadata to prevent BOLA escalation
        const teamId = decoded.app_metadata?.team_id || decoded.sub;
        if (!teamId) {
            socket.disconnect(true);
            return;
        }
        socket.join(`team:${teamId}`);
        console.log(`Socket ${socket.id} joined room team:${teamId}`);
    }
    catch (err) {
        console.error('Socket auth failed:', err);
        socket.disconnect(true);
    }
});
// --- Redis pub/sub subscriber (separate connection for subscribing) ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
const redisSub = new ioredis_1.default(REDIS_URL, { maxRetriesPerRequest: null });
redisSub.psubscribe('team:*').then(() => {
    console.log('Redis subscriber listening on team:* channels');
});
redisSub.on('pmessage', (_pattern, channel, message) => {
    const teamId = channel.replace('team:', '');
    try {
        io.to(`team:${teamId}`).emit('request-log', JSON.parse(message));
    }
    catch (err) {
        console.error('Failed to parse/emit pmessage:', err);
    }
});
const startServer = async () => {
    if (process.env.RUN_MIGRATIONS === 'true') {
        try {
            await (0, db_1.runMigrations)();
        }
        catch (err) {
            console.error('Failed to run database migrations on startup:', err);
            process.exit(1);
        }
    }
    server.listen(port, () => {
        console.log(`Gateway API listening at http://localhost:${port}`);
    });
};
startServer();
//# sourceMappingURL=index.js.map