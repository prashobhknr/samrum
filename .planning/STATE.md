# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Users work BPMN-driven tasks through a Swedish UI showing the right admin-configured form fields at each lifecycle stage — Camunda enforces the process.
**Current focus:** ALL PHASES COMPLETE

## Current Position

Phase: 4 of 4 (Process Instance Timeline)
Plan: Direct execution (no pre-written plans)
Status: Phase 4 COMPLETE — ALL MILESTONE PHASES DONE + VERIFIED
Last activity: 2026-03-09 — Form endpoints wired into demo-server.mjs, audit_log bug fixed, all 3 form endpoints E2E verified (generate/validate/submit with data persistence)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 3 + Phase 2 direct
- Average duration: ~25min
- Total execution time: ~2h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3/3 ✅ | ~1h15m | ~25min |
| 2 | direct ✅ | ~45m | N/A |
| 3 | direct ✅ | ~45m | N/A |
| 4 | direct ✅ | ~30m | N/A |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [Pre-GSD]: External Task over Java delegates — TypeScript-only, no Java
- [Pre-GSD]: Operaton Run (standalone JAR, open-source Camunda 7 fork) not Docker — no Docker on dev machine
- [Roadmap]: Phase 4 (Timeline) depends only on Phase 1, not Phase 3
- [Pre-Plan-01]: Use Operaton (not Camunda 7.23.0) — config uses operaton.bpm namespace
- [Plan-01]: PostgreSQL 14 installed natively on Windows, service `postgresql-x64-14`
- [Plan-01]: Operaton 2.0.0-M3 with CSP disabled (Chrome nonce issue)
- [Plan-02]: Individual BPMN deployment (not batch) for resilience — skip broken files gracefully
- [Plan-02]: Fixed BPMN XSD ordering issues (outgoing/incoming after eventDefinition) in 9 files
- [Plan-02]: Fixed transport.bpmn unescaped `<` in documentation text
- [Plan-02]: Fixed maintenance.bpmn multiple none start events (added messageEventDefinition)
- [Plan-02]: Set enforceHistoryTimeToLive=false + default P180D in Operaton config
- [Plan-03]: Proxy maps /api/camunda/* → http://localhost:8080/* (strips /api/camunda prefix only)
- [Phase-2]: Converted 113 delegateExpression refs to external task pattern across 35 BPMN files
- [Phase-2]: Worker is pure .mjs (REST API), avoids broken TS build chain
- [Phase-2]: 50 stub delegate handlers with typed output variables matching BPMN gateway conditions
- [Phase-2]: Worker polls every 5s, fetches up to 10 tasks, 30s lock, 3 retries with 10s retry timeout
- [Phase-2]: Gateway-critical variables: modelValid, clashCount, deviationLevel, validationPassed

- [Phase-3]: 7 backend API endpoints: GET/POST processes, GET/POST tasks, claim, unclaim, complete
- [Phase-3]: Task inbox with two tabs (Mina uppgifter / Lediga uppgifter), Swedish UI
- [Phase-3]: Task detail page loads real Operaton data, extracts doorInstanceId from variables
- [Phase-3]: formKey convention doorman:{moduleId}:{objectTypeId} wired through to DynamicForm
- [Phase-3]: Fallback "Slutför uppgift" button when no form configured for a task
- [Phase-3]: Auto-typed variables on complete (Boolean/Long/Double/String)
- [Phase-4]: 2 backend endpoints: GET /api/process-instances, GET /api/process-instances/{id}/activity-history
- [Phase-4]: Operaton process-instance endpoint doesn't support sortBy query param (removed)
- [Phase-4]: Timeline page with sidebar process selector, current activity highlight, chronological event log
- [Phase-4]: Activity types filtered to meaningful ones (startEvent, endEvent, userTask, serviceTask, callActivity)
- [AI-Feature]: Provider-agnostic AI form assistant — supports OpenAI, Claude, Gemini, Ollama via env vars (AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL)
- [AI-Feature]: Backend POST /api/ai/suggest + GET /api/ai/config endpoints in demo-server.mjs
- [AI-Feature]: Frontend "Föreslå värden" button on task page, DynamicForm accepts suggestions with ✨ AI-förslag indicator
- [AI-Feature]: Graceful degradation when no provider configured — returns empty suggestions with Swedish hint
- [Verification-Fix]: Form endpoints (generate/validate/submit) were in Express router but NOT wired into demo-server.mjs — ported all 3 with full SQL logic
- [Verification-Fix]: audit_log INSERT used `changed_at` but actual column is `timestamp` — fixed
- [Verification]: All form endpoints E2E verified: generate returns 8 fields, submit persists via upsert, validate checks against schema

### Env / Ops Notes

- DB owned by user `a123` — run migrations as `a123`, then GRANT to `doorman_user`
- Kill demo server: `pkill -f demo-server.mjs` then `node backend/demo-server.mjs`
- Column normalization regex: `[^a-zA-Z0-9_]` (not `[^a-z0-9_]`) — preserve uppercase before `lower()`
- FormKey convention: `doorman:{moduleId}:{objectTypeId}`

### Blockers/Concerns

- [Phase 1]: Confirm PostgreSQL JDBC driver version compatible with Operaton before starting
- [Phase 1]: Verify Operaton `demo/demo` default credentials; check if assignee enforced without identity service
- [Phase 2]: 39+ topics in one `fetchAndLock` may hit timeout — NOT an issue, 50 topics work fine
- [Phase 3]: `candidateGroup` REST filter known edge case — test in spike before building full inbox
- [Phase 2]: BPMN bim-coordination.bpmn has parallel gateway modeling bug (pg_sync_start has 2 incoming but happy path sends only 1)

### Pending Todos

None yet.

## Session Continuity

Last session: 2026-03-09
Stopped at: ALL PHASES + AI FEATURE COMPLETE — Phases 1-4 done + provider-agnostic AI form assistant. Supports OpenAI/ChatGPT, Claude/Anthropic, Gemini/Google, Ollama/local via AI_PROVIDER + AI_API_KEY env vars. "Föreslå värden" button on task page populates DynamicForm fields with AI suggestions.
Resume file: N/A — milestone complete
