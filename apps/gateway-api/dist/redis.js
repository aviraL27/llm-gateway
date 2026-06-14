"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
exports.redis = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null,
});
exports.redis.on('connect', () => {
    console.log('Connected to Redis');
});
exports.redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});
//# sourceMappingURL=redis.js.map