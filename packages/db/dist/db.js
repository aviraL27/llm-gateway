"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5435/llm_gateway';
exports.pool = new pg_1.Pool({
    connectionString,
});
const query = (text, params) => {
    return exports.pool.query(text, params);
};
exports.query = query;
//# sourceMappingURL=db.js.map