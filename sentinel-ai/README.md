# SentinelAI V2 — Autonomous AI Backend Security & API Testing Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![Groq](https://img.shields.io/badge/Groq-LPU_Llama--3.3--70B-orange.svg)](https://groq.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic_Loop-purple.svg)](https://langchain-ai.github.io/langgraphjs/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue.svg)](https://github.com/pgvector/pgvector)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis_Queue-red.svg)](https://bullmq.io/)

SentinelAI V2 is an autonomous AI Agent built to test, fuzz, and audit backend REST APIs for **OWASP API Security Top 10** vulnerabilities. It reads your codebase, indexes endpoints with AST analysis, queries security attack vectors using **pgvector RAG**, executes dynamic blackbox/greybox HTTP fuzzing with **Groq-accelerated Llama-3.3-70B**, and produces verified vulnerability reports with real-time SSE progress streaming.

---

## Key Features

1. **Autonomous ReAct Agent Loop**:
   - Multi-step LangGraph orchestration with 8 specialized security tools (`testBOLA`, `testInputValidation`, `testAuthBypass`, `sendApiRequest`, `runLoadTest`, `searchSecurityKnowledge`, `inspectFile`, `recordFinding`).
2. **Static AST Analysis + Vector RAG**:
   - Regex/AST parsing of Express/Node.js routes and auth middlewares.
   - pgvector semantic search over OWASP API security knowledge and attack payloads.
3. **Real-time SSE Streaming & Telemetry**:
   - Live terminal log console streaming agent reasoning, tool calls, and discovered exploits without page reloads.
4. **Human-in-the-Loop Safeguards**:
   - Interactive permission gates for active load/stress testing before high-concurrency requests are sent.
5. **Modern Cyber Dashboard**:
   - Dark theme dashboard with Recharts visual analytics (Severity distribution donut & OWASP category bar chart), Attack Surface map, and remediation guides.
6. **Bundled Demo Vulnerable Target**:
   - Ships with an intentionally vulnerable Express target backend (`demo-target`) for immediate 1-click testing.

---

## Quick Start Guide

### Prerequisites
- **Node.js 18+**
- **PostgreSQL 15+** with `pgvector` extension
- **Redis 6+**
- **Groq API Key** (or mock mode)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env # Set your DATABASE_URL, REDIS_URL, GROQ_API_KEY, JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
# Backend runs on http://localhost:5000
```

### 2. Demo Target Backend (Optional for 1-Click testing)
```bash
cd demo-target
npm install
node index.js
# Vulnerable demo runs on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

---

## Project Structure

```
sentinel-ai/
├── backend/            # Express, TypeScript, LangGraph, Groq, Prisma, BullMQ
├── frontend/           # Next.js 16, React 19, Tailwind, Recharts, Lucide
├── demo-target/        # Vulnerable Express API for defensive testing
└── docs/               # Architecture & Hinglish Deep Dive documentation
    ├── ARCHITECTURE.md
    └── PROJECT_DEEP_DIVE_HINGLISH.md
```

---

## Documentation
- [System Architecture & Flow](file:///Users/store/DEV-AGENT/sentinel-ai/docs/ARCHITECTURE.md)
- [Hinglish Project Deep Dive & Interview Prep Guide](file:///Users/store/DEV-AGENT/sentinel-ai/docs/PROJECT_DEEP_DIVE_HINGLISH.md)
