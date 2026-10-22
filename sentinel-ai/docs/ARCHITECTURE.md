# SentinelAI V2 — Production Architecture & Engineering Guide

## 1. System Overview

SentinelAI is an autonomous, production-grade AI Backend Security & API Testing Agent. It combines static AST code analysis, vector semantic search (pgvector), dynamic blackbox/greybox API testing, and stateful multi-step agent orchestration (LangGraph + Groq LLMs) to discover and verify OWASP API Security Top 10 vulnerabilities.

```
+-----------------------------------------------------------------------------------+
|                                SENTINEL-AI V2                                      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       Frontend (Next.js 16 + React 19)                    |   |
|   |   - Real-time SSE Agent Execution Stream                                  |   |
|   |   - Interactive OWASP Vulnerability Explorer                              |   |
|   |   - Attack Surface Map (Routes, Auth, Middleware)                         |   |
|   |   - Recharts Visual Analytics (Severity Donut, Top Vectors)               |   |
|   +---------------------------------------------------------------------------+   |
|                                       | (HTTP REST + Server-Sent Events)          |
|                                       v                                           |
|   +---------------------------------------------------------------------------+   |
|   |                     Backend API Server (Express + TypeScript)             |   |
|   |   - Auth & RBAC (JWT, bcrypt)                                             |   |
|   |   - Project & Scan Management Routes                                      |   |
|   |   - SSE Stream Coordinator                                                |   |
|   |   - BullMQ Queue Producer (scanQueue)                                     |   |
|   +---------------------------------------------------------------------------+   |
|             |                                                  |                  |
|             v                                                  v                  |
|   +-------------------+                              +---------------------+      |
|   |   PostgreSQL 16   |                              |      Redis 7        |      |
|   |   + pgvector      |                              |  - BullMQ Queue     |      |
|   | - Projects/Users  |                              |  - SSE PubSub       |      |
|   | - AgentRuns       |                              |  - Rate Limit Cache |      |
|   | - Findings (OWASP)|                              +---------------------+      |
|   | - Security Vectors|                                        |                  |
|   +-------------------+                                        v                  |
|             ^                                        +---------------------+      |
|             |                                        |    BullMQ Worker    |      |
|             +----------------------------------------| (scanWorker.ts)     |      |
|                                                      +---------------------+      |
|                                                                |                  |
|                                                                v                  |
|   +---------------------------------------------------------------------------+   |
|   |                    Autonomous Agent Engine (LangGraph + Groq)             |   |
|   |                                                                           |   |
|   |   [Node 1: Analyze Repo & AST] -> Discovers Routes, Models, & Auth Rules  |   |
|   |          |                                                                |   |
|   |          v                                                                |   |
|   |   [Node 2: Vector RAG] ---------> Semantic search OWASP guides & rules    |   |
|   |          |                                                                |   |
|   |          v                                                                |   |
|   |   [Node 3: Planner Agent] ------> Synthesizes targeted test payloads      |   |
|   |          |                                                                |   |
|   |          v                                                                |   |
|   |   [Node 4: Dynamic Tools] ------> Executes HTTP, Auth Fuzzing, k6 Load    |   |
|   |          |                                                                |   |
|   |          v                                                                |   |
|   |   [Node 5: OWASP Verifier] -----> Validates findings & writes DB records  |   |
|   +---------------------------------------------------------------------------+   |
|                                       | (Active Fuzzing / Probes)                 |
|                                       v                                           |
|   +---------------------------------------------------------------------------+   |
|   |                       Target Service / Demo Backend                       |   |
|   |                  (e.g., demo-target Express App on Port 4000)             |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure & File Map

```
sentinel-ai/
├── backend/                        # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma           # Prisma DB models (Users, Projects, Runs, Findings, Endpoints)
│   ├── src/
│   │   ├── agent/
│   │   │   ├── agent.ts            # LangGraph ReAct Agent workflow & execution loop
│   │   │   ├── groqClient.ts       # Groq ChatGroq LLM initialization with Llama-3.3-70B
│   │   │   ├── rag.ts              # pgvector RAG system (embeddings & semantic security search)
│   │   │   └── tools.ts            # 8 Security Agent Tools (API, Fuzzing, BOLA, k6 Load, etc.)
│   │   ├── config/
│   │   │   └── index.ts            # Typed environment variables & defaults
│   │   ├── lib/
│   │   │   ├── prisma.ts           # Prisma client singleton
│   │   │   └── redis.ts            # Redis connection manager
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── authRoutes.ts       # Signup, Login, Me endpoints
│   │   │   ├── projectRoutes.ts    # Project CRUD & listing
│   │   │   └── scanRoutes.ts       # Scan launch, SSE streaming, findings, endpoints
│   │   ├── services/
│   │   │   ├── gitService.ts       # GitHub & local repo cloner
│   │   │   └── repoAnalyzer.ts     # AST regex parser discovering Express routes & auth
│   │   ├── workers/
│   │   │   └── scanWorker.ts       # BullMQ worker running background agent scans
│   │   └── index.ts                # Express app entry, security headers, CORS, rate limits
│   └── package.json
│
├── frontend/                       # Next.js 16 + React 19 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css         # Dark theme cyber aesthetic styling
│   │   │   ├── layout.tsx          # Root layout & font configurations
│   │   │   └── page.tsx            # Main dashboard orchestrator
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Top navigation, project selector, scan CTA
│   │   │   ├── StatsCards.tsx      # Security health score, endpoint count, exploits
│   │   │   ├── FindingsList.tsx    # Filterable OWASP vulnerability table
│   │   │   ├── FindingDetailModal.tsx # OWASP badges, proof evidence, code fix diffs
│   │   │   ├── ApiCatalog.tsx      # Discovered endpoint attack surface map
│   │   │   ├── SecurityCharts.tsx  # Recharts severity donut & vector bar chart
│   │   │   ├── ScanConsole.tsx     # Real-time SSE execution logs & reasoning stream
│   │   │   ├── ScanModal.tsx       # Scan launcher with preset prompts & mode selection
│   │   │   ├── ProjectModal.tsx    # Project creation modal
│   │   │   ├── AuthModal.tsx       # Sign in / registration modal
│   │   │   └── QuickDemoBanner.tsx # 1-Click demo test against vulnerable demo backend
│   │   └── lib/
│   │       └── api.ts              # Typed frontend API client & SSE consumer
│   └── package.json
│
├── demo-target/                    # Intentionally vulnerable target Express app (Port 4000)
│   ├── index.js                    # Implements BOLA/IDOR, Mass Assignment, Auth Bypasses
│   └── package.json
│
└── docs/                           # Architecture & educational guides
    ├── ARCHITECTURE.md
    └── PROJECT_DEEP_DIVE_HINGLISH.md
```

---

## 3. Agent Tool Calling & Security Tools

The AI Agent is equipped with specialized tools defined in `backend/src/agent/tools.ts`:

1. **`sendApiRequest`**: Executes HTTP methods (GET, POST, PUT, DELETE, PATCH) with custom headers, query parameters, and JSON payloads against the target server.
2. **`testBOLA`**: Probes Broken Object Level Authorization (IDOR) by attempting to access resource IDs across different user tokens or unauthenticated states.
3. **`testInputValidation`**: Injects fuzzing payloads (SQLi, NoSQLi, XSS, format strings, negative numbers, overflow strings) into query params and body fields.
4. **`testAuthBypass`**: Strips tokens, replaces JWT signatures with `none`, tampers roles in claims, and tests for broken endpoint authentication.
5. **`runLoadTest`**: Human-in-the-loop stress testing tool executing concurrent virtual user requests to measure latency spikes, error rates, and rate limiting thresholds.
6. **`searchSecurityKnowledge`**: Vector RAG search tool querying pgvector for OWASP Top 10 guidelines and known mitigation patterns.
7. **`inspectFile`**: Inspects static source files in the indexed repository to locate route handlers, middlewares, and models.
8. **`recordFinding`**: Persists verified vulnerabilities to PostgreSQL with CVSS severity, category, title, description, proof evidence, and remediation advice.

---

## 4. BullMQ & Server-Sent Events (SSE) Flow

1. **User clicks "Launch Scan"**: Frontend issues `POST /api/projects/:id/scan`.
2. **Backend creates `AgentRun`**: Status set to `running` with initial progress (5%).
3. **Job queued in BullMQ**: Pushed to Redis queue `scanQueue`.
4. **ScanWorker picks up job**:
   - Clones or analyzes target repo (`repoAnalyzer.ts`).
   - Seeds pgvector security knowledge base if empty (`rag.ts`).
   - Instantiates LangGraph agent loop with Groq `llama-3.3-70b-versatile`.
   - Publishes step-by-step reasoning, tool invocations, and findings via Redis PubSub / SSE.
5. **Frontend streams SSE events**: Updates live terminal console, progress bar, vulnerability list, and telemetry cards in real-time.
6. **Completion**: Worker updates `AgentRun` to `completed` and records aggregate metrics.
