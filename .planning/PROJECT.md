# Doorman / Samrum

## What This Is

Doorman is a building lifecycle management system (replacing the legacy SAS-based Samrum) that orchestrates door/lock/access object workflows through BPMN processes on Camunda 7. It provides permission-filtered dynamic forms, full audit trails, and AI-assisted task completion for Swedish property management teams.

## Core Value

Users can work BPMN-driven tasks (inspect, approve, document, manage access) through a Swedish UI that shows them exactly the right form fields at the right lifecycle stage — and Camunda enforces the process.

## Current Milestone: v1.0 — Camunda Integration + Task Worker UI + AI

**Goal:** Wire Camunda 7 (standalone, no Docker) to the existing backend via External Task pattern, build a task worker inbox UI, and add AI-assisted form filling.

**Target features:**
- Camunda 7 Run (standalone JAR) — deploy 39 BPMNs, no Docker
- External Task worker in backend polling Camunda REST API
- Delegate stubs in `backend/src/delegates/` execute real logic and complete tasks
- Frontend task inbox: list assigned tasks, render DynamicForm per formKey, claim/complete/escalate
- Claude API AI assistant: suggest form values, decision support on gateway tasks
- Process instance status view: which phase/subprocess is currently active

## Requirements

### Validated

<!-- Shipped from previous work -->

- ✓ OMS database schema (11 core tables) — migrations 001–013 applied
- ✓ 39 BPMN process files with 301 formKeys and 50 delegate expressions (100% coverage)
- ✓ 50 TypeScript delegate stubs in `backend/src/delegates/`
- ✓ Backend API: objects, forms, portfolio, BIM endpoints (`backend/demo-server.mjs`)
- ✓ Frontend: Next.js 14 admin section, DynamicForm component, DataGrid, SamrumLayout
- ✓ FormService: `generateFormFromKey()` routes formKey → module-aware or task-permission form
- ✓ Architecture docs: 10 docs covering PLCS mapping, personas, KPIs, delegate guide

### Active

- [ ] Camunda 7 Run installed and running (standalone JAR, no Docker)
- [ ] 39 BPMN files deployed to Camunda via REST API on startup
- [ ] External Task worker in backend polls Camunda, dispatches to delegate registry
- [ ] Frontend task inbox: user sees assigned Camunda user tasks
- [ ] Frontend: claim task, load DynamicForm via formKey, submit → complete Camunda task
- [ ] AI form assistant: Claude API suggests field values for active form
- [ ] Process instance timeline: shows current phase/subprocess for a building

### Out of Scope

- Docker-based Camunda — no Docker available on dev machine
- Java delegates — External Task REST polling replaces this entirely
- Mobile app — web-first
- Multi-tenant SaaS — single organization deployment
- Real-time collaboration — single user per task

## Context

- **Runtime**: macOS, no Docker. Camunda 7 Run (community) as standalone JAR via `java -jar`.
- **Backend**: `backend/demo-server.mjs` (Node.js/MJS, port 3000) — main server. TypeScript services compile to it.
- **Frontend**: Next.js 14, port 3001. Auth: localStorage base64 token (`lib/auth.ts`).
- **DB**: PostgreSQL at `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db` (must be running separately).
- **Delegate pattern**: External Task approach — backend polls `GET /engine-rest/external-task/fetchAndLock`, runs TypeScript delegate, calls `POST /engine-rest/external-task/{id}/complete`.
- **FormKey convention**: `doorman:{moduleId}:{objectTypeId}` — already routed by `generateFormFromKey()`.
- **Language**: UI labels in Swedish.

## Constraints

- **Runtime**: No Docker — Camunda must run as standalone JAR (`camunda-bpm-run-7.x.x.zip`)
- **Stack**: TypeScript/Node backend, Next.js frontend — no Java code
- **Camunda version**: 7.x community (open-source, latest 7.x release)
- **AI**: Claude API via `@anthropic-ai/sdk` for AI assistant feature
- **Existing delegates**: Use `backend/src/delegates/index.ts` registry — do NOT rewrite

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| External Task over Java delegates | Backend is TypeScript, no Java allowed | ✓ Good |
| Camunda 7 (not 8) | Open-source, community edition, established | — Pending |
| Camunda Run (JAR) not Docker | No Docker available on dev machine | — Pending |
| DynamicForm reuse for task UI | Already built, formKey routing already works | ✓ Good |
| Claude API for AI assistant | Existing expertise, Anthropic SDK available | — Pending |

---
*Last updated: 2026-03-08 — Milestone v1.0 started*
