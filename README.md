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

## Memory (M8)
Short-term conversation state plus durable user-approved memories:
- Isolated memory retrieval scoped per user to prevent unrelated data exposure.
- Importance ranking (`HIGH` > `MEDIUM` > `LOW`) and timestamp sorting.
- REST API:
  - `GET /api/v1/memories`
  - `POST /api/v1/memories`

## Calendar / Email (M9)
Read calendar events, draft emails safely, and enforce confirmation gating for outbound messages:
- `read_calendar`: Query and filter calendar events with date ranges and keyword searches (Risk: `LOW`).
- `draft_email`: Prepare and store email drafts in a draft repository without external transmission (Risk: `LOW`).
- `send_email`: External message transmission gated by mandatory confirmation (Risk: `HIGH`).
- Acceptance Guarantee: Jarvis never sends an external message without explicit user approval.
- REST API:
  - `GET /api/v1/calendar`
  - `POST /api/v1/email/draft`
  - `POST /api/v1/email/send` (blocked with 403 / `confirmationRequired` unless confirmed)

### Testing Calendar & Email
1. Run unit tests:
   ```bash
   node --test packages/tools/dist/__tests__/calendar-email.test.js
   ```
2. Run M9 acceptance script:
   ```bash
   node scripts/test-calendar-email.js
   ```

## File Assistant (M10)
Approved-directory search, document extraction, and summarization:
- `search_files`: Recursive search within approved directory scopes only.
- `extract_document`: Read text/code contents of files within approved scopes with size caps.
- `summarize_document`: Structured key-point summarization of documents or text extracts.
- Acceptance Guarantee: Files outside configured scopes or attempted directory traversal attacks (`../`) are strictly blocked.
- REST API:
  - `GET /api/v1/files/search`
  - `POST /api/v1/files/extract`
  - `POST /api/v1/files/summarize`

### Testing File Assistant
1. Run unit tests:
   ```bash
   node --test packages/tools/dist/__tests__/file-assistant.test.js
   ```
2. Run M10 acceptance script:
   ```bash
   node scripts/test-file-assistant.js
   ```

## Browser / Web Tools (M11)
Controlled browser actions and web search:
- `web_search`: Retrieve structured search results and documentation within policy limits (Risk: `LOW`).
- `browser_action`: Controlled browser actions (`navigate`, `extract_text`, `submit_form`, `download_file`, `execute_script`).
- Acceptance Guarantee: Navigation strictly validates URL policies (prohibiting malicious schemes like `file:`, `javascript:`, `vbscript:`); mutating/dangerous external actions (`submit_form`, `download_file`, `execute_script`) strictly remain gated behind explicit user confirmation.
- REST API:
  - `GET /api/v1/web/search`
  - `POST /api/v1/browser/action` (returns 403 `confirmationRequired: true` unless confirmed)

### Testing Browser & Web Tools
1. Run unit tests:
   ```bash
   node --test packages/tools/dist/__tests__/browser-web.test.js
   ```
2. Run M11 acceptance script:
   ```bash
   node scripts/test-browser-web.js
   ```

## Voice (M12)
Wake word, speech-to-text, text-to-speech, and hands-free command loop:
- `WakeWordDetector`: High-accuracy detection of "Hey Jarvis" and conversational variants with command extraction.
- `FastSTTProvider`: Audio input stream transcription.
- `WindowsNativeTTSProvider`: System speech synthesis providing real audible audio output on Windows workstation.
- `VoiceCommandLoop`: Complete hands-free pipeline connecting wake word detection directly to Orchestrator planning and TTS audible replies.
- Acceptance Guarantee: "Hey Jarvis" starts a command session and produces an audible response.
- REST API:
  - `POST /api/v1/voice/listen`

### Testing Voice
1. Run unit tests:
   ```bash
   node --test packages/voice/dist/__tests__/voice.test.js
   ```
2. Run M12 acceptance script:
   ```bash
   node scripts/test-voice.js
   ```

## Automation Engine (M13)
Trigger-condition-action workflows with BullMQ/Queue workers, retry resilience, and idempotency controls:
- `AutomationEngine`: Supports schedule, event, and webhook triggers with field-level condition evaluation.
- `AutomationQueueWorker`: Background job queue dispatcher for automated task workflows.
- Configurable retry policies with exponential backoff on transient errors.
- Strict idempotency key deduplication to prevent duplicate action execution.
- REST API:
  - `GET /api/v1/workflows`
  - `POST /api/v1/workflows`
  - `POST /api/v1/workflows/:id/trigger`
  - `GET /api/v1/workflows/history`

### Testing Automation Engine
1. Run unit tests:
   ```bash
   node --test packages/automation/dist/__tests__/automation.test.js
   ```
2. Run M13 acceptance script:
   ```bash
   node scripts/test-automation.js
   ```

## Proactive Jarvis (M14)
Daily briefing, deadline detection, and category-filtered proactive notifications:
- `ProactiveService`: Integrates with Tasks and Calendar to assemble comprehensive Daily Briefings.
- Automatic deadline detection scanning pending tasks due within configurable hourly thresholds.
- Acceptance Guarantee: Jarvis proactively notifies only for explicitly enabled notification categories; disabled categories are strictly suppressed.
- REST API:
  - `GET /api/v1/proactive/briefing`
  - `GET /api/v1/proactive/preferences`
  - `PATCH /api/v1/proactive/preferences`
  - `GET /api/v1/proactive/notifications`
  - `PATCH /api/v1/proactive/notifications/:id/read`

### Testing Proactive Jarvis
1. Run unit tests:
   ```bash
   node --test packages/proactive/dist/__tests__/proactive.test.js
   ```
2. Run M14 acceptance script:
   ```bash
   node scripts/test-proactive.js
   ```

## Milestones
- [x] M1 - Foundation
- [x] M2 - Identity & Configuration
- [x] M3 - LLM Provider
- [x] M4 - Jarvis Orchestrator
- [x] M5 - Tool Runtime
- [x] M6 - Computer Control v1
- [x] M7 - Tasks & Reminders
- [x] M8 - Memory
- [x] M9 - Calendar / Email
- [x] M10 - File Assistant
- [x] M11 - Browser/Web Tools
- [x] M12 - Voice
- [x] M13 - Automation Engine
- [x] M14 - Proactive Jarvis

