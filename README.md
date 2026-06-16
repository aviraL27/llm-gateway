# Multi-Tenant LLM Gateway Platform

An enterprise-grade, high-performance **Multi-Tenant LLM Router and Gateway** platform featuring real-time analytics, cost tracking, token-based rate limiting, spend guards, PII redaction, automatic model fallbacks, and provider failovers. 

The project includes an Express-based gateway proxy, a background database worker, and a premium, glassmorphic React dashboard ("Datadog meets Apple's Human Interface Guidelines").

---

## 🏗️ System Design & Architecture

The LLM Gateway is designed around a decoupled, event-driven microservices architecture to ensure the proxy hot path remains extremely low-latency.

### High-Level Architecture Flow

```mermaid
graph TD
    subgraph Client Space
      Client[API Client / SDK]
      Dashboard[React Frontend Dashboard]
    end

    subgraph LLM Gateway Infrastructure
      Proxy[Gateway API - Express Server]
      Worker[Background Worker - BullMQ]
      PII[PII Sidecar - Python Presidio]
    end

    subgraph Storage & Caching
      Postgres[(PostgreSQL + TimescaleDB)]
      Redis[(Redis Cache, Pub/Sub & Queue)]
    end

    subgraph AI Networks
      OpenAI[OpenAI API]
      Anthropic[Anthropic API]
    end

    %% Client Interactions
    Client -->|1. Bearer API Key Request| Proxy
    Dashboard -->|2. View Analytics / Manage Keys| Proxy
    Dashboard <-->|3. WebSockets Real-time Stream| Proxy

    %% Proxy Request Processing
    Proxy -->|4. Authenticate & Fetch Budget| Redis
    Redis -.->|Cache Miss| Postgres
    Proxy -->|5. Scrub PII| PII
    Proxy -->|6. Select Model & Route| OpenAI
    Proxy -->|6. Select Model & Route| Anthropic

    %% Async Logging & PubSub
    Proxy -->|7. Enqueue Log & Publish Event| Redis
    Redis -->|8. Consume Job| Worker
    Worker -->|9. Write Telemetry log| Postgres
    Worker -->|10. Increment monthly budget spend| Postgres
    Worker -->|11. Update Redis budget spend cache| Redis
    Redis -->|12. Emit live dashboard log| Proxy
```

### Request Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Proxy as Gateway Proxy
    participant Redis as Redis Cache/Queue
    participant DB as TimescaleDB
    participant PII as PII Sidecar
    participant LLM as LLM Provider

    Client->>Proxy: POST /v1/chat/completions (with API key)
    Proxy->>Redis: Check API Key, Rate Limit & Budget Status
    Alt Cache Miss
        Redis->>DB: Query API Key record & monthly limit
        DB-->>Redis: Return details
        Redis-->>Proxy: Return cached authentication policies
    End
    
    Alt PII Redaction Enabled
        Proxy->>PII: POST /analyze (message contents)
        PII-->>Proxy: Return redacted prompt string
    End

    Proxy->>Proxy: Determine target model (or trigger spend-guard downgrade)
    Proxy->>LLM: POST to Provider Endpoint (with stream: true)
    
    loop Stream Chunks
        LLM-->>Proxy: Send raw Event Stream chunk
        Proxy->>Client: Send formatted SSE chunk
    end

    Proxy->>Redis: Enqueue Log Job to BullMQ ('request-logs')
    Proxy->>Redis: Publish log event to 'team:<id>' channel
    Proxy->>Client: Close Connection [DONE]

    Note over Redis,DB: Asynchronous Worker Processing
    Redis->>DB: Worker writes telemetry to request_logs hypertable
    Redis->>DB: Worker increments monthly spend in team_budgets
    Redis->>Redis: Worker increments cache spend key
```

---

## 📁 Repository Structure

The project is structured as a TypeScript monorepo using npm workspaces:

```
├── apps
│   ├── gateway-api       # Express API server (HTTP Proxy, Socket.IO server)
│   ├── worker            # Background worker process handling async database log writing
│   ├── frontend          # React + Vite + TypeScript glassmorphic analytics dashboard
│   └── pii-service       # Python FastAPI sidecar running Microsoft Presidio PII scrubbing
├── packages
│   ├── db                # Database schema, connection pool, and migrations
│   └── types             # Shared TypeScript typings
├── docker-compose.yml    # Full local infrastructure composition
├── render.yaml           # One-click Render Infrastructure Blueprint
├── package.json          # Root Monorepo configuration
└── tsconfig.base.json    # Shared TypeScript compiler options
```

---

## ⚙️ Environment Configurations

For local execution, the backend services can read from a shared `.env` file at the root of the project, while local dev fallback configuration copies exist in each app.

### Shared Environment File (`.env.example`)
Create a `.env` in the root folder with the following template:

```env
# Database Connection (Used for local host development)
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5435/llm_gateway

# Automatically run database migrations on server startup
RUN_MIGRATIONS=true

# Redis Connection
REDIS_URL=redis://localhost:6385

# Supabase Auth configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Server Port
PORT=3000

# Provider Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# PII Presidio Sidecar URL
PII_SERVICE_URL=http://localhost:8008

# Frontend Configuration (Vite client-side)
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

---

## 🚀 Local Setup Instructions

### 1. Prerequisites
Ensure you have **Node.js (v18+)**, **npm (v9+)**, and **Docker & Docker Desktop** installed and running on your system.

### 2. Install Workspace Dependencies
From the repository root, install and link all node modules across the workspaces:
```bash
npm install
```

### 3. Spin up Infrastructure
Start all backend services locally in containers (PostgreSQL + TimescaleDB, Redis, PII Sidecar, Gateway-API, and Worker) using:
```bash
docker-compose up -d
```
All containers include health checks, and the NodeJS processes inside Docker will automatically use the correct network bridge addresses (`postgres`, `redis`, `pii-service`) while exposing local mapped ports for host-level development.

### 4. Database Migrations
The migrations will run automatically on the Gateway API container startup if `RUN_MIGRATIONS=true` is set. 
To run migrations manually on your host machine:
```bash
npm run migrate --workspace=packages/db
```
The migration runner checks the `schema_migrations` table and applies all incremental SQL files from `packages/db/migrations` in sorted order.

### 5. Running Host-level Development
If you prefer running NodeJS services directly on your host machine against the Docker containers:
1. Make sure Docker is running the database/redis/pii services:
   ```bash
   # Stops node services inside Docker while keeping DBs and Python PII active
   docker-compose stop gateway-api worker
   ```
2. Start development watch servers:
   - **Gateway API**: `npm run dev:gateway` (runs on `http://localhost:3000`)
   - **Background Worker**: `npm run dev:worker` (runs log logging loop)
   - **Vite Frontend**: `npm run dev:frontend` (runs dashboard on `http://localhost:5173`)

---

## ☁️ Production Deployment

The repository includes a [render.yaml](file:///d:/Coding/ai%20gateway/render.yaml) blueprint file for easy deployment to **Render**.

### Blueprint Deployment Steps:
1. Push your repository to GitHub.
2. Log in to your [Render Dashboard](https://dashboard.render.com).
3. Click **New** and select **Blueprint**.
4. Connect your repository.
5. Render will automatically read the `render.yaml` configuration and provision:
   - A TimescaleDB PostgreSQL database (`gateway-db`).
   - A Redis Cache cluster (`gateway-redis`).
   - A Python-based PII sidecar service (`pii-service`).
   - The Express Proxy Web Service (`gateway-api`).
   - The background queue Worker service (`log-worker`).
6. After provisioning, go to your services in Render and fill in the missing environment secrets (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_JWT_SECRET`) in the Env Groups or Service environment pages.
