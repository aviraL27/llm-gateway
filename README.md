# Multi-Tenant LLM Gateway Platform

An enterprise-grade, high-performance **Multi-Tenant LLM Router and Gateway** platform featuring real-time analytics, cost tracking, token-based rate limiting, spend guards, PII redaction, automatic model fallbacks, and provider failovers. 

The project includes an Express-based gateway proxy, a background database worker, and a premium, glassmorphic React dashboard ("Datadog meets Apple's Human Interface Guidelines").

---

## 🏗️ System Design & Architecture

```
                          +---------------------------------------+
                          |        React Frontend Dashboard       |
                          | (Recharts, Socket.IO Client, Theme)   |
                          +---------------------------------------+
                                              |
                                              | HTTP & WebSockets
                                              v
+------------------+      +---------------------------------------+
|   LLM Providers  | <--- |              Gateway API              | <--- Incoming Proxy Request
| (OpenAI, Gemini, |      |   - Authenticates Client API Keys     |      (Bearer API Key)
|  Anthropic, etc) |      |   - Enforces Rate Limits & Spend Caps |
+------------------+      |   - Redacts PII (Presidio-inspired)   |
        |                 |   - Handles Fallbacks & Failovers     |
        |                 +---------------------------------------+
        |                                 |         |
        | Log Metadata                    | Publish | Enqueue
        v                                 v         v
+------------------+               +-----------+  +-------------------+
|  TimescaleDB /   |               |   Redis   |  |   Redis Queue     |
|  PostgreSQL      |               |  Pub/Sub  |  |    (BullMQ)       |
+------------------+               +-----------+  +-------------------+
        ^                                               |
        |                                               | Process
        |                +------------------+           v
        +----------------| Background Worker| <---------+
          Write Log      +------------------+
```

### 1. Request Lifecycle
When a client sends an HTTP request to the gateway at `/v1/chat/completions`:
1. **API Key Authentication**: Checks the hashed API key against the database or Redis cache.
2. **Rate Limiting**: Checks if the request exceeds sliding-window limits stored in Redis.
3. **Spend Guard**: Verifies if the team's current monthly spend is within budget bounds.
4. **PII Redaction**: If enabled, scans inputs and redacts sensitive data (emails, SSNs, credit cards, IPs, phone numbers) before forwarding to providers.
5. **Smart Routing**: Routes to the primary model or executes a fallback sequence (spend-based downgrades or provider-level failovers).
6. **Streaming & Costs**: Channels stream tokens back to the client while calculating costs and latency.
7. **Queued Telemetry**: Publishes a log job to Redis Pub/Sub (for real-time dashboard listeners) and pushes a background database logging job to the worker queue.

### 2. Background Processing
The logging queues are processed asynchronously by the background **Worker process** to keep the proxy request path low-latency. Logs are written to a **TimescaleDB hypertable** for performant analytics queries.

---

## 📁 Repository Structure

```
├── apps
│   ├── gateway-api       # Proxy server, Express routes, Socket.IO bridge, policy middleware
│   ├── worker            # Background logging worker running BullMQ queues
│   └── frontend          # React + Vite client-side dashboard with glassmorphic styling
├── packages
│   ├── db                # Database schema, migrations, connection pool
│   └── types             # Shared TypeScript interfaces
├── docker-compose.yml    # Redis (6385) and TimescaleDB (5435) local instances
└── codex.md              # Detailed developer guidelines and reference context
```

---

## ⚙️ Environment Configurations

Each package uses a `.env` file to manage secrets and connections. `.env.example` templates are provided in each directory.

### Gateway API (`apps/gateway-api/.env`)
```ini
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5435/llm_gateway
REDIS_URL=redis://localhost:6385
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
PORT=3000
```

### Worker Process (`apps/worker/.env`)
```ini
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5435/llm_gateway
REDIS_URL=redis://localhost:6385
```

### Frontend (`apps/frontend/.env`)
```ini
VITE_API_URL=http://localhost:3000
```

---

## 🚀 Local Setup Instructions

### 1. Prerequisites
Ensure you have **Node.js (v18+)**, **npm**, and **Docker** installed.

### 2. Install Workspace Dependencies
From the repository root, install all node modules across workspaces:
```bash
npm install
```

### 3. Spin up Infrastructure
Start local Redis and TimescaleDB instances using Docker Compose:
```bash
docker compose up -d
```

### 4. Run Database Migrations
Create databases and apply tables/hypertables:
```bash
npm run migrate -w packages/db
```

### 5. Launch Development Servers
Run the services concurrently:

* **Gateway API**:
  ```bash
  npm run dev -w apps/gateway-api
  ```
* **Background Worker**:
  ```bash
  npm run dev -w apps/worker
  ```
* **Vite Frontend**:
  ```bash
  npm run dev -w apps/frontend
  ```

---

## 🎨 Design System & Visual Polish

The frontend implements a glassmorphic system styled entirely with vanilla CSS variables:
* **Command Center (Dark Theme)**: Deep charcoal background `#090710` accented with rich purple-indigo mesh gradients (`rgba(139, 92, 246, 0.15)`) and micro-glow cards.
* **Crystal Workspace (Light Theme)**: Frost-white translucent panels, golden-amber mesh gradients, and light-refraction overlays.
* **Dynamic Components**: Frosted cards, inputs with focus glow rings, spring-loaded buttons, paginated cloud-style tables, and the orbiting **Gateway Orb** signature theme-node switch.
