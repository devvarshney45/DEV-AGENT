# SentinelAI V2 — Project Deep Dive & Interview Masterclass (Hinglish)

Yeh document SentinelAI V2 ka complete masterclass guide hai. Agar aap is project ko apne portfolio me daal rahe hain ya kisi full-stack / AI agent interview me explain kar rahe hain, toh yeh guide aapko conceptual clarity aur practical knowledge dono provide karegi.

---

## 1. Project Introduction (SentinelAI kya hai?)

**SentinelAI** ek **Autonomous AI Security & API Testing Agent** hai jo backend repositories ko read karta hai, endpoints discover karta hai, unka attack surface map karta hai, aur phir autonomously real HTTP requests bhej kar OWASP API Security Top 10 vulnerabilities (jaise BOLA/IDOR, SQL Injection, Broken Authentication, Mass Assignment, Rate Limit bypass) detect aur verify karta hai.

### Traditional API Testing vs SentinelAI:
- **Traditional Postman / Manual Testing**: Developer ko har ek route par manually payloads daal kar test karna padta hai.
- **Traditional Static Scanners (SonarQube)**: Sirf code text ko check karte hain, runtime par API actually kaise behave kar rahi hai nahi dekh sakte (high false positives).
- **SentinelAI Agent**: Dono ko combine karta hai. Pehle static code se routes aur auth rules samajhta hai, phir LLM agent autonomously test plan bana kar dynamic requests bhejta hai aur verified vulnerabilities report karta hai.

---

## 2. Architecture: File-by-File Breakdown

### Backend (`/backend/src/`):
1. **`index.ts`**:
   - Express server ka entry point.
   - Helmet, CORS, json parser, aur express-rate-limit configure karta hai.
   - `/api/auth`, `/api/projects`, `/api/projects/:id/scan` routes mount karta hai.
2. **`config/index.ts`**:
   - Environment variables (DATABASE_URL, REDIS_URL, GROQ_API_KEY, JWT_SECRET) ko validate aur load karta hai.
3. **`lib/prisma.ts` & `lib/redis.ts`**:
   - PostgreSQL aur Redis connections ke singletons provide karte hain taaki connection pool exhaust na ho.
4. **`services/repoAnalyzer.ts`**:
   - Repository ke JS/TS files ko parse karta hai.
   - Regex aur AST pattern matching se `app.get()`, `router.post()` jaise routes aur unke attached auth middlewares ko discover karta hai.
5. **`agent/groqClient.ts`**:
   - Groq ke ultra-fast Llama-3.3-70B model ko LangChain `ChatGroq` ke through initialize karta hai.
6. **`agent/rag.ts`**:
   - pgvector database me OWASP security guides ke embeddings store aur query karta hai.
   - Cosine similarity search se agent ko relevant attack vectors provide karta hai.
7. **`agent/tools.ts`**:
   - Agent ke 8 tools: `sendApiRequest`, `testBOLA`, `testInputValidation`, `testAuthBypass`, `runLoadTest`, `searchSecurityKnowledge`, `inspectFile`, `recordFinding`.
8. **`agent/agent.ts`**:
   - LangGraph ReAct agentic loop. LLM ko prompt aur context deta hai, tool execution manage karta hai, aur findings verify karta hai.
9. **`workers/scanWorker.ts`**:
   - BullMQ worker jo background me queue se scan jobs pick karta hai, agent run karta hai, aur SSE events publish karta hai.

### Frontend (`/frontend/src/`):
1. **`app/page.tsx`**: Main dashboard orchestrator.
2. **`components/Navbar.tsx`**: Project switcher, Scan CTA, system health status.
3. **`components/StatsCards.tsx`**: Security health score (0-100), Attack surface size, exploit counts.
4. **`components/ScanConsole.tsx`**: Real-time SSE terminal streaming agent thoughts, tool invocations, and findings.
5. **`components/FindingsList.tsx` & `FindingDetailModal.tsx`**: Filterable OWASP vulnerabilities with proof evidence and remediation diffs.
6. **`components/SecurityCharts.tsx`**: Recharts visual analytics (Severity donut & category bar charts).
7. **`components/QuickDemoBanner.tsx`**: 1-Click test against the bundled vulnerable Express app.

---

## 3. LLM vs AI Agent: Farak Kya Hai?

Yeh interview me pucha jane wala sabse common question hai:

| Feature | Simple LLM (ChatGPT / Groq Chat) | AI Agent (SentinelAI) |
|---|---|---|
| **Capability** | Sirf text generate karta hai. | Real world me **actions (Tools)** execute karta hai. |
| **Execution** | Single prompt -> Single response. | Iterative Loop: Plan -> Act -> Observe -> Reflect. |
| **API Access** | Internet ya backend access nahi hota. | Real HTTP requests (`fetch`, `curl`, `k6`) bhejta hai. |
| **State Memory** | Context window khatam hone par bhool jata hai. | Database aur Vector DB me state persist karta hai. |

---

## 4. ReAct Pattern (Reasoning + Acting)

SentinelAI **ReAct Pattern** follow karta hai:
1. **Thought (Reasoning)**: Agent sochta hai — *"Maine `/users/:id` endpoint dekha hai, mujhe check karna chahiye ki kya bina token ke user 2 ka data mil raha hai."*
2. **Action (Tool Call)**: Agent tool invoke karta hai — `testBOLA({ endpoint: '/users/2', token: null })`.
3. **Observation (Result)**: Tool response return karta hai — `HTTP 200 OK with User 2 email and password`.
4. **Evaluation (Verification)**: Agent confirm karta hai — *"IDOR vulnerability present hai kyunki without authorization sensitive user data leak hua."*
5. **Output (Record)**: Agent `recordFinding` tool call karke PostgreSQL me finding save karta hai.

---

## 5. RAG (Retrieval-Augmented Generation) & pgvector

### RAG kya hai aur SentinelAI me kyun use hua?
Jab agent kisi unusual vulnerability ko test karta hai, toh use specific attack payloads aur OWASP testing methodologies ki zaroorat hoti hai.

1. Humne OWASP Top 10 documents ko chunk karke pgvector table me store kiya.
2. Jab agent scan start karta hai, `searchSecurityKnowledge` tool query vector generate karta hai.
3. PostgreSQL pgvector `<=>` cosine distance operator se top 3 relevant security vectors retrieve karta hai.
4. Yeh documents LLM prompt me add ho jaate hain, jisse hallucinations reduce hoti hain aur test accuracy 10x improve ho jaati hai.

---

## 6. BullMQ & Server-Sent Events (SSE) Flow

### Kyun BullMQ zaroori hai?
Security testing me 30 seconds se lekar 5 minutes tak lag sakte hain. Agar hum direct HTTP request me scan chalayein, toh browser timeout ho jayega aur server block ho jayega.

Isliye:
1. User click karta hai -> Backend Turant `AgentRunId` return karta hai (HTTP 200).
2. Scan job Redis queue (`scanQueue`) me enqueue ho jati hai.
3. BullMQ `scanWorker` background me job process karta hai.
4. Har ek step par worker Redis PubSub / SSE par event emit karta hai.
5. Frontend browser `EventSource` ke through bina reload kiye live terminal me real-time output display karta hai.

---

## 7. Common Interview Questions & How to Answer

### Q1: "Aapne is project me LangGraph / LangChain kyun choose kiya?"
**Answer:**
> *"Maine LangGraph use kiya kyunki security testing ek multi-step, stateful cyclic workflow hai. Traditional sequential chains me agar koi tool fail ho jaye ya retry chahiye ho toh handle karna mushkil hota hai. LangGraph ke graph-based state machine se hum conditional edges bana sakte hain — jaise agar endpoint par auth failed hua toh next node automatically auth-bypass tool trigger karega."*

### Q2: "Groq LLM ka kya advantage hai traditional OpenAI ke upar?"
**Answer:**
> *"Security scanning me agent ko 10-20 iterations me multiple tool calls karne hote hain. Groq ke LPUs (Language Processing Units) par Llama-3.3-70B model 300-500 tokens per second ki speed deta hai, jisse multi-step agent ka response time 30 seconds se kam ho jata hai jabki traditional cloud APIs me 2-3 minutes lagte."*

### Q3: "False positives ko kaise prevent kiya aapke agent ne?"
**Answer:**
> *"Humne two-stage verification lagayi hai: Stage 1 me static AST analyzer suspected routes nikalta hai. Stage 2 me agent real dynamic HTTP probe bhejta hai. Jab tak HTTP response me vulnerability ka concrete proof (e.g. unauthorized 200 OK ya SQL syntax error payload) observe nahi hota, tab tak agent use confirmed finding mark nahi karta."*

---

## 8. Summary Checklist for Portfolio Demo

- [x] Backend running on port 5000 with Express + TypeScript + Prisma + PostgreSQL
- [x] Redis & BullMQ worker running for background scans
- [x] Demo vulnerable target running on port 4000
- [x] Next.js 16 frontend with dark cyber dashboard, live SSE stream, and Recharts analytics
- [x] Vector RAG with pgvector for OWASP knowledge retrieval
- [x] Full test coverage with zero TypeScript compilation errors
