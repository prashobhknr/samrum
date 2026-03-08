# Technology Stack

**Project:** Doorman — Camunda Integration + Task Worker UI + AI
**Researched:** 2026-03-08
**Scope:** NEW additions only. Existing stack (Express/TypeScript, Next.js 14, PostgreSQL, pg, axios) is validated and excluded.

---

## New Stack Additions

### 1. Camunda 7 Run (Standalone JAR)

| Item | Value |
|------|-------|
| Version | 7.23.0 (latest stable community, April 2025) |
| Download | `https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/camunda-bpm-run-7.23.0.zip` |
| Runtime | Java 11+ (`java -jar`) — no Docker required |
| REST API | `http://localhost:8080/engine-rest` (default) |
| Cockpit UI | `http://localhost:8080/camunda/app/cockpit/` |

**Why 7.23 not 7.24:** 7.24 was announced as the final CE release (October 2025, EoL). As of research date 7.23.0 (April 2025) is the confirmed stable download. 7.24 download listing exists at the Camunda Download Center but EoL status means no future patches. Either works; 7.23.0 is verified functional and the right choice for stability.

**EoL note (MEDIUM confidence):** Camunda 7 CE entered EoL in October 2025. The last CE release is 7.24. The JAR still runs indefinitely — EoL only means no new community patches. This is acceptable for a single-org deployment.

**Installation:**
```bash
# Download and unzip
curl -O https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/camunda-bpm-run-7.23.0.zip
unzip camunda-bpm-run-7.23.0.zip -d camunda-bpm-run
# Start
cd camunda-bpm-run
./start.sh    # macOS/Linux
```

**Configuration file:** `configuration/default.yml` — set REST API port and auth here.

---

### 2. External Task Worker — npm Package

| Item | Value |
|------|-------|
| Package | `camunda-external-task-client-js` |
| Version | `^3.1.0` (latest, published April 2024) |
| Types | `@types/camunda-external-task-client-js ^1.3.6` (DefinitelyTyped) |
| Module format | ESM-only (matches backend `"type": "module"`) |
| Node requirement | >= 18 (backend already requires >= 18) |

**Why the client library over manual REST polling:**
The library handles fetchAndLock loop, long-polling, error/retry backoff, variable serialization, and task completion — all things you would otherwise hand-write. The backend already has 50 delegate stubs ready to wire in; the client library is the lowest-friction integration point. Manual REST polling is only justified if you need zero deps or have a highly unusual variable type — neither applies here.

**ESM compatibility:** The library is ESM-only by design, which matches `"type": "module"` in `backend/package.json`. No CJS shims needed.

**TypeScript note (LOW confidence on type completeness):** `@types/camunda-external-task-client-js` v1.3.6 is community-maintained (DefinitelyTyped). Type coverage is functional but may lag the library's JS API. Expect a few `any` casts in the worker bootstrap; delegate handlers can be fully typed.

**Installation:**
```bash
# From backend/
npm install camunda-external-task-client-js@^3.1.0
npm install -D @types/camunda-external-task-client-js@^1.3.6
```

**Usage pattern:**
```typescript
import { Client, logger } from 'camunda-external-task-client-js';
import { delegateRegistry } from './delegates/index.js';

const client = new Client({
  baseUrl: 'http://localhost:8080/engine-rest',
  use: logger,
  asyncResponseTimeout: 10000,
});

client.subscribe('doorman-service-task', async ({ task, taskService }) => {
  const delegateKey = task.getVariable('delegateExpression');
  const delegate = delegateRegistry[delegateKey];
  if (!delegate) {
    await taskService.handleBpmnError(task, 'DELEGATE_NOT_FOUND');
    return;
  }
  await delegate.execute(task, taskService);
});
```

---

### 3. Claude API — AI Form Assistant

| Item | Value |
|------|-------|
| Package | `@anthropic-ai/sdk` |
| Version | `^0.78.0` (latest as of 2026-03-08, published ~Feb 2026) |
| Model | `claude-sonnet-4-6` (current production model) |
| Usage | Backend endpoint → Claude API → form value suggestions |

**Why @anthropic-ai/sdk over raw HTTP:** SDK handles retries, streaming, error typing, and token counting. Already the standard approach documented in Anthropic docs. `axios` exists in the backend but would require hand-rolling retry/streaming.

**Integration point:** Add a new route `POST /api/ai/form-suggest` in `backend/src/api/` (or `demo-server.mjs`). The route receives the current formKey + visible field labels + any existing values, calls Claude with a structured prompt, returns suggestions as JSON.

**Installation:**
```bash
# From backend/
npm install @anthropic-ai/sdk@^0.78.0
```

**Usage pattern:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Given this building inspection form, suggest values for the empty fields: ${JSON.stringify(formContext)}`
  }]
});
```

**Environment variable:** `ANTHROPIC_API_KEY` — add to `.env` (already loaded via `dotenv` in backend).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Camunda version | 7.23.0 CE JAR | Camunda 8 Run | C8 is a different product (Zeebe engine), different REST API, different external task protocol — all 39 BPMNs and delegate patterns are built for C7 |
| Camunda version | 7.23.0 CE JAR | Docker Camunda | Explicitly out of scope — no Docker on dev machine |
| External task | camunda-external-task-client-js | Manual axios REST polling | Library eliminates ~200 lines of polling/retry/error boilerplate |
| External task | camunda-external-task-client-js | camunda-worker-node (nikku) | Less maintained, smaller community, not official Camunda project |
| AI SDK | @anthropic-ai/sdk | @ai-sdk/anthropic (Vercel) | Vercel AI SDK adds abstraction layer not needed for backend-only calls; direct SDK is simpler |

---

## Complete New Dependencies

```bash
# Production
npm install camunda-external-task-client-js@^3.1.0
npm install @anthropic-ai/sdk@^0.78.0

# Dev
npm install -D @types/camunda-external-task-client-js@^1.3.6
```

**No other new deps needed.** Existing backend already has:
- `axios` — available if needed for Camunda REST calls beyond the worker client
- `express` — existing API server where AI route will be added
- `dotenv` — already loads `.env` for `ANTHROPIC_API_KEY`
- `pg` — database access in delegates
- `winston` — logging for worker

---

## Environment Variables to Add

```bash
# .env additions
ANTHROPIC_API_KEY=sk-ant-...
CAMUNDA_REST_URL=http://localhost:8080/engine-rest
CAMUNDA_WORKER_ID=doorman-worker-1
```

---

## Integration Points

```
backend/src/
├── worker/
│   ├── index.ts          # camunda-external-task-client-js client setup
│   └── taskRouter.ts     # routes topic → delegate registry
├── delegates/
│   └── index.ts          # existing registry (50 stubs) — no changes needed
└── api/
    └── ai.ts             # new: POST /api/ai/form-suggest → @anthropic-ai/sdk
```

The worker runs as a long-lived process alongside the Express server. Options: (a) start worker in same process as `demo-server.mjs`, (b) separate `npm run worker` script. Recommendation: separate script for clean shutdown/restart during development.

---

## Sources

- [Camunda 7.23 Download Center](https://downloads.camunda.cloud/release/camunda-bpm/run/7.23/) — HIGH confidence
- [Camunda 7.24 Download Center](https://downloads.camunda.cloud/release/camunda-bpm/run/7.24/) — HIGH confidence
- [Camunda 7 CE EoL announcement](https://forum.camunda.io/t/important-update-camunda-7-community-edition-end-of-life-announced/50921) — MEDIUM confidence (forum, not official blog)
- [camunda-external-task-client-js GitHub](https://github.com/camunda/camunda-external-task-client-js) — HIGH confidence (official Camunda repo)
- [camunda-external-task-client-js npm](https://www.npmjs.com/package/camunda-external-task-client-js) — HIGH confidence
- [@types/camunda-external-task-client-js npm](https://www.npmjs.com/package/@types/camunda-external-task-client-js) — MEDIUM confidence (DefinitelyTyped, community-maintained)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — HIGH confidence
