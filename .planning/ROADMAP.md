# Roadmap: Doorman — v1.0 Camunda Integration + Task Worker UI

## Overview

This milestone wires Camunda 7 (standalone JAR, no Docker) to the existing Express/TypeScript backend and Next.js frontend. Phase 1 establishes the engine with PostgreSQL backing and BPMN deployment. Phase 2 connects the external task worker so service tasks advance process flow automatically. Phase 3 builds the human-facing task inbox and form submit loop, reusing the already-built DynamicForm and FormService. Phase 4 adds a supervisory process timeline view, which is independent and can ship last.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Camunda Infrastructure** - Camunda 7 JAR running on PostgreSQL with all 39 BPMNs deployed and proxied through the backend
- [ ] **Phase 2: External Task Worker** - Backend polls Camunda service tasks and dispatches to the existing delegate registry with correct retry/failure handling
- [ ] **Phase 3: Task Worker UI** - Task inbox, claim/unclaim, DynamicForm load via formKey, and typed-variable form submit that advances the process
- [ ] **Phase 4: Process Instance Timeline** - Supervisory view showing which phase/subprocess is currently active for a selected building

## Phase Details

### Phase 1: Camunda Infrastructure
**Goal**: Camunda 7 is running, backed by the existing PostgreSQL database, with all 39 BPMN files deployed and all frontend-to-Camunda traffic proxied through the backend
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. `java -jar camunda-bpm-run-7.23.0.jar` starts without errors and Cockpit is accessible at `localhost:8080`; startup logs confirm `org.postgresql` driver loaded, not H2
  2. All 39 BPMN files are visible as deployed process definitions in Camunda Cockpit after `demo-server.mjs` starts; restarting the server does not create additional versions
  3. `curl localhost:3000/api/camunda/engine-rest/process-definition` returns the process list (proxied through the backend, no CORS error from the frontend)
**Plans**: TBD

### Phase 2: External Task Worker
**Goal**: The backend external task worker polls Camunda service tasks and dispatches them to the existing delegate registry, completing tasks with typed variables and handling failures as Camunda incidents
**Depends on**: Phase 1
**Requirements**: WORK-01, WORK-02, WORK-03
**Success Criteria** (what must be TRUE):
  1. Starting a process instance in Cockpit causes service task steps to complete automatically; delegate execution is visible in backend logs
  2. A deliberate delegate failure decrements `task.retries` toward zero and creates a Camunda incident (not an infinite poll loop); incident is visible in Cockpit
  3. BPMN gateway routing works correctly: Boolean/Integer/String variables set by delegates steer flow to the expected branch (verified by starting a known process and observing which user task appears next)
**Plans**: TBD

### Phase 3: Task Worker UI
**Goal**: A logged-in user can see their assigned Camunda tasks, claim unclaimed group tasks, load the admin-configured DynamicForm for each task, fill it out, and submit it — advancing the process in Camunda
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. The task inbox at `/tasks` shows tasks assigned to or claimable by the logged-in user's group, with task name, process name, and created date visible
  2. A user can claim an unclaimed task and unclaim a task they previously claimed; the inbox reflects the change without a page reload
  3. Opening a claimed task renders the correct DynamicForm (same fields as in the admin form preview for that formKey) with current attribute values pre-filled
  4. Submitting the form marks the Camunda user task complete and the next step in the process becomes active in Cockpit; submitted values are persisted in `attribute_values`
**Plans**: TBD

### Phase 4: Process Instance Timeline
**Goal**: A supervisor can select a building and see which BPMN phase or subprocess is currently active for its process instance
**Depends on**: Phase 1
**Requirements**: UI-05
**Success Criteria** (what must be TRUE):
  1. The process timeline view shows the current active activity name (from Camunda's `activity-instances` endpoint) for a selected building's process instance
  2. When a task is completed and the process advances, refreshing the timeline view reflects the new active activity
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

Note: Phase 4 depends only on Phase 1 (not Phase 3) and may be scheduled before Phase 3 if needed.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Camunda Infrastructure | 0/? | Not started | - |
| 2. External Task Worker | 0/? | Not started | - |
| 3. Task Worker UI | 0/? | Not started | - |
| 4. Process Instance Timeline | 0/? | Not started | - |
