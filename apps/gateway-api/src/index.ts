import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import keysRouter from './routes/keys';
import proxyRouter from './routes/proxy';
import { validateDashboardAuth, validateApiKey } from './middlewares/auth';
import { rateLimiter } from './middlewares/rateLimiter';
import { spendGuard } from './middlewares/spendGuard';
import { runMigrations } from '@llm-gateway/db';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);

// Configure CORS origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  },
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);
app.use(express.json());

// Public healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway-api' });
});

// Dashboard routes (require Supabase JWT)
app.use('/api', validateDashboardAuth, keysRouter);

// Programmatic Gateway routes (require API key auth)
app.use('/v1', proxyRouter);

// Test endpoint for key validation, rate limiter, and spend guard
app.get('/v1/protected', validateApiKey, rateLimiter, spendGuard, (req, res) => {
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
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
    // Avoid using client-writable user_metadata to prevent BOLA escalation
    const teamId = decoded.app_metadata?.team_id || decoded.sub;

    if (!teamId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`team:${teamId}`);
    console.log(`Socket ${socket.id} joined room team:${teamId}`);
  } catch (err) {
    console.error('Socket auth failed:', err);
    socket.disconnect(true);
  }
});

// --- Redis pub/sub subscriber (separate connection for subscribing) ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
const redisSub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

redisSub.psubscribe('team:*').then(() => {
  console.log('Redis subscriber listening on team:* channels');
});

redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
  const teamId = channel.replace('team:', '');
  try {
    io.to(`team:${teamId}`).emit('request-log', JSON.parse(message));
  } catch (err) {
    console.error('Failed to parse/emit pmessage:', err);
  }
});

const startServer = async () => {
  if (process.env.RUN_MIGRATIONS === 'true') {
    try {
      await runMigrations();
    } catch (err) {
      console.error('Failed to run database migrations on startup:', err);
      process.exit(1);
    }
  }

  server.listen(port, () => {
    console.log(`Gateway API listening at http://localhost:${port}`);
  });
};

startServer();
