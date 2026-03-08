# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Users work BPMN-driven tasks through a Swedish UI showing the right form fields at each lifecycle stage — Camunda enforces the process.
**Current focus:** Defining requirements for v1.0

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-08 — Milestone v1.0 started

## Accumulated Context

- DB owned by user `a123` — run migrations as `a123`, then GRANT to `doorman_user`
- Kill demo server: `pkill -f demo-server.mjs` then `node backend/demo-server.mjs`
- Column normalization regex must use `[^a-zA-Z0-9_]` (NOT `[^a-z0-9_]`) to preserve uppercase before `lower()`
- `module_view_columns` drives per-module column definitions (not object_attributes directly)
- FormKey convention: `doorman:{moduleId}:{objectTypeId}`
- Camunda must run as standalone JAR (no Docker) — `java -jar camunda-bpm-run-*.jar`
- External Task approach: backend polls Camunda REST, dispatches to delegate registry in `backend/src/delegates/index.ts`
