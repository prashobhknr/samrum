# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Users work BPMN-driven tasks through a Swedish UI showing the right admin-configured form fields at each lifecycle stage — Camunda enforces the process.
**Current focus:** Phase 1 — Camunda Infrastructure

## Current Position

Phase: 1 of 4 (Camunda Infrastructure)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-08 — Roadmap created, REQUIREMENTS.md traceability finalized

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [Pre-GSD]: External Task over Java delegates — TypeScript-only, no Java
- [Pre-GSD]: Camunda Run (JAR) not Docker — no Docker on dev machine
- [Roadmap]: Phase 4 (Timeline) depends only on Phase 1, not Phase 3

### Env / Ops Notes

- DB owned by user `a123` — run migrations as `a123`, then GRANT to `doorman_user`
- Kill demo server: `pkill -f demo-server.mjs` then `node backend/demo-server.mjs`
- Column normalization regex: `[^a-zA-Z0-9_]` (not `[^a-z0-9_]`) — preserve uppercase before `lower()`
- FormKey convention: `doorman:{moduleId}:{objectTypeId}`

### Blockers/Concerns

- [Phase 1]: Confirm PostgreSQL JDBC driver version compatible with Camunda 7.23 before starting
- [Phase 1]: Verify Camunda `demo/demo` default credentials; check if assignee enforced without identity service
- [Phase 2]: 39+ topics in one `fetchAndLock` may hit timeout — investigate grouping strategy during planning
- [Phase 3]: `candidateGroup` REST filter known edge case — test in spike before building full inbox

### Pending Todos

None yet.

## Session Continuity

Last session: 2026-03-08
Stopped at: Roadmap written, STATE.md initialized, REQUIREMENTS.md traceability confirmed
Resume file: None
