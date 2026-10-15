# JARVIS - Personal AI Assistant

## Prerequisites
- Node.js 18+
- Docker and Docker Compose
- TypeScript

## Setup
1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Start the infrastructure (PostgreSQL and Redis):
   ```bash
   cd infra
   docker-compose up -d
   ```
5. Apply database schema:
   ```bash
   npm run db:push
   ```
6. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

## Running the API
To start the API in development mode:
```bash
npm run dev:api
```
The server will start on port 3000 (or the port defined in `.env`).

## Verification Commands
To test the health check endpoint, run:
```bash
curl http://localhost:3000/api/v1/health
```
You should receive a `{ "status": "ok", "timestamp": "..." }` response.

## LLM Provider Configuration (M3)
Jarvis abstracts the LLM provider through `@jarvis/llm`. You can swap between providers without modifying any orchestrator logic.

Supported providers in `.env`:
- `LLM_PROVIDER="mock"`: Fast, deterministic responses for tests and offline development.
- `LLM_PROVIDER="ollama"`: Connects directly to local or network Ollama instances (e.g. `http://localhost:11434` or your LAN server).
- `LLM_PROVIDER="openai-compatible"`: Connects to LM Studio, vLLM, LocalAI, or remote OpenAI-compatible endpoints.

### Testing the LLM Provider
1. Run provider unit tests:
   ```bash
   node --test packages/llm/dist/__tests__/llm.test.js
   ```
2. Send a test prompt to your active model:
   ```bash
   node scripts/test-llm.js "Hey Jarvis, what's on my agenda?"
   ```
3. Test via API endpoints:
   - `GET /api/v1/llm/health`
   - `POST /api/v1/llm/test` with `{ "prompt": "..." }`

## Jarvis Orchestrator (M4)
The orchestrator in `@jarvis/core` manages conversational state, formats prompts with registered tool manifests, guides the LLM to output structured JSON plans, validates requested tool calls, and dispatches them safely.

### Testing the Orchestrator
1. Run orchestrator unit tests:
   ```bash
   node --test packages/core/dist/__tests__/orchestrator.test.js
   ```
2. Verify M4 acceptance criteria with the interactive script:
   ```bash
   node scripts/test-orchestrator.js "Create a task to submit DAA assignment by tomorrow"
   ```
3. Chat via the API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Create a task to submit DAA assignment by tomorrow"}'
   ```

## Tool Runtime & Security (M5)
The deterministic execution engine in `@jarvis/tools` enforces the security model:
- Schema validation via Zod before any tool execution.
- Unknown tools are rejected and cannot execute.
- All actions (successes, rejections, failures) are logged to an audit trail.
- Automatic secret redaction for passwords, API keys, and sensitive tokens.
- Global kill switch to instantly disable tool execution.
- High-risk confirmation gate.

### Testing the Tool Runtime
1. Run tool runtime unit tests:
   ```bash
   node --test packages/tools/dist/__tests__/runtime.test.js
   ```
2. Verify M5 acceptance criteria with the interactive script:
   ```bash
   node scripts/test-tool-runtime.js
   ```
3. Inspect registered tools & audit log via API:
   - `GET /api/v1/tools`
   - `GET /api/v1/executions`
   - `POST /api/v1/killswitch` with `{ "active": true }`

## Computer Control v1 (M6)
Controlled Windows desktop access without exposing arbitrary shell or administrator commands:
- `open_application(appId)`: Restricted to an approved application allowlist (VS Code, Chrome, Notepad, Terminal, Explorer, etc.).
- `open_folder(path)`: Restricted strictly to approved project directories (e.g. `FlowForge`). Directory traversal attacks (`../`) are blocked.
- `open_file(filePath)`: Restricted to approved directory scopes.
- `open_url(url)`: Enforces `http:`/`https:` protocols; blocks dangerous schemes (`file:`, `javascript:`).
- Instant global kill switch halting all desktop control actions.

### Testing Computer Control v1
1. Run computer control unit tests:
   ```bash
   node --test packages/tools/dist/__tests__/computer-control.test.js
   ```
2. Run M6 acceptance verification script:
   ```bash
   node scripts/test-computer-control.js
   ```

## Tasks & Scheduled Reminders (M7)
Persistent task CRUD and restart-resilient scheduled reminders:
- Task CRUD: `createTask`, `getTasks`, `updateTask`, `deleteTask`.
- Scheduled Reminders: delay-calculated execution engine restoring pending jobs across restarts.
- REST API:
  - `GET /api/v1/tasks` & `POST /api/v1/tasks`
  - `PATCH /api/v1/tasks/:id` & `DELETE /api/v1/tasks/:id`
  - `GET /api/v1/reminders` & `POST /api/v1/reminders`
  - `DELETE /api/v1/reminders/:id`

### Testing Tasks & Reminders
1. Run tasks unit tests:
   ```bash
   node --test packages/tasks/dist/__tests__/tasks.test.js
   ```
2. Run M7 acceptance verification script:
   ```bash
   node scripts/test-tasks-reminders.js
   ```

## Milestones
- [x] M1 - Foundation
- [x] M2 - Identity & Configuration
- [x] M3 - LLM Provider
- [x] M4 - Jarvis Orchestrator
- [x] M5 - Tool Runtime
- [x] M6 - Computer Control v1
- [x] M7 - Tasks & Reminders
- [ ] M8 - Memory

