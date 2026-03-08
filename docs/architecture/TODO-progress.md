# Building Lifecycle Process - Progress Tracker

> Iterative development of PLCS-compliant Camunda 7 BPMN processes for full building lifecycle management.

## Iteration Status

| # | Focus | Status | Started | Completed |
|---|-------|--------|---------|-----------|
| 1 | Fix master process (add missing phases) + create phase-level BPMNs | DONE | 2026-03-06 | 2026-03-06 |
| 2 | Add missing discipline subprocesses (sprinkler, transport, architecture, structural, plumbing) | DONE | 2026-03-06 | 2026-03-06 |
| 3 | Add operational processes (inspections, tenant, warranty, access, energy) | DONE | 2026-03-06 | 2026-03-06 |
| 4 | Module-to-process mapping (271 Samrum modules -> BPMN subprocesses) | DONE | 2026-03-06 | 2026-03-06 |
| 5 | Cross-discipline coordination & integration events | DONE | 2026-03-06 | 2026-03-06 |
| 6 | Renovation/refurbishment mini-project cycle | DONE | 2026-03-06 | 2026-03-06 |
| 7 | Emergency & incident processes + change management | DONE | 2026-03-06 | 2026-03-06 |
| 8 | Process quality review + Camunda deployment readiness | DONE | 2026-03-06 | 2026-03-06 |
| 9 | Deployment descriptor + delegate implementation guide | DONE | 2026-03-06 | 2026-03-06 |
| 10 | Process KPIs, SLA monitoring, and reporting | DONE | 2026-03-06 | 2026-03-06 |
| 11 | Form keys + document approval workflow | DONE | 2026-03-06 | 2026-03-06 |
| 12 | Complete formKey coverage for all 31 BPMN files (237 total) | DONE | 2026-03-07 | 2026-03-07 |
| 13 | Task permission rules seeding + FormService module-aware upgrade | DONE | 2026-03-07 | 2026-03-07 |
| 14 | Multi-building portfolio, BIM, contractor scheduling, indoor climate | DONE | 2026-03-07 | 2026-03-07 |
| 15 | POE, budget overrun, insurance, sustainability, 100% formKey | DONE | 2026-03-07 | 2026-03-07 |
| 16 | Backend API for Portfolio + BIM (wired into demo-server) | DONE | 2026-03-07 | 2026-03-07 |
| 17 | Camunda delegate stubs (25 delegates, TypeScript + REST endpoint) | DONE | 2026-03-07 | 2026-03-07 |
| 18 | Process quality review: 100% delegate coverage (50/50) | DONE | 2026-03-07 | 2026-03-07 |

---

## Iteration 1: Master Process + Phase-Level BPMNs -- COMPLETE

### Tasks

- [x] Read and assess all existing docs and BPMNs
- [x] Update master process: add Pre-study and Procurement phases (8 phases total)
- [x] Create `processes/phases/investigation-phase.bpmn`
- [x] Create `processes/phases/pre-study-phase.bpmn`
- [x] Create `processes/phases/design-phase.bpmn` (10 parallel discipline Call Activities)
- [x] Create `processes/phases/procurement-phase.bpmn`
- [x] Create `processes/phases/production-phase.bpmn` (8 parallel installation tracks + SFP + OVK)
- [x] Create `processes/phases/handover-phase.bpmn` (PIM->AIM transfer)
- [x] Create `processes/phases/operations-phase.bpmn` (6 concurrent operational sub-processes)
- [x] Create `processes/phases/decommission-phase.bpmn`
- [x] Create doc 04: Phase-level process details
- [x] Create doc 05: Module-to-process mapping

### Key Decisions
- Master process expanded from 5 to 8 phases (added Forstudie, Upphandling, Avveckling)
- Each phase gate includes a `lifecycleTransitionDelegate` service task
- Phase-level BPMNs in `processes/phases/`, discipline subs in `processes/sub/`
- Operations phase uses event sub-process for change management
- Production phase includes remediation loop for failed inspections

---

## Iteration 2: Missing Discipline Subprocesses -- COMPLETE

### Tasks
- [x] Create `processes/sub/sprinkler.bpmn` (SS-EN 12845, hazard classification)
- [x] Create `processes/sub/transport.bpmn` (elevators, AFS 2003:6)
- [x] Create `processes/sub/architecture.bpmn` (spatial/room design, BBR accessibility)
- [x] Create `processes/sub/structural.bpmn` (foundation, Eurocode, SAK-K review)
- [x] Create `processes/sub/plumbing.bpmn` (sanitary, drainage, pressure test)

---

## Iteration 3: Operational Processes -- COMPLETE

### Tasks
- [x] Create `processes/operations/inspections.bpmn` (OVK, elevator, SBA, energy declaration)
- [x] Create `processes/operations/tenant-move.bpmn` (move-in/move-out paths)
- [x] Create `processes/operations/access-management.bpmn` (5 request types)
- [x] Create `processes/operations/energy-management.bpmn` (ISO 50001, annual cycle)
- [x] Create `processes/operations/warranty.bpmn` (AB 04, 2yr+5yr inspections)

---

## Iteration 5: Cross-Discipline Coordination -- COMPLETE

### Tasks
- [x] Restructure design-phase.bpmn: Phase A (baseline producers) → Phase B (consumers)
- [x] Add baseline review meeting between Phase A and Phase B
- [x] Add `sig_design_freeze` throw event in design-phase after approval
- [x] Add `sig_construction_start` throw event in production-phase after technical startup
- [x] Create doc 07: Cross-discipline integration architecture

### Key Decisions
- Design disciplines split into Phase A (architecture, structural, fire) and Phase B (remaining 7)
- Mandatory baseline review meeting gates Phase B start
- Design freeze signal thrown after approval, before audit
- Construction start signal thrown after technical startup, before parallel installations

---

## Iteration 6: Renovation Mini-Project -- COMPLETE

### Tasks
- [x] Create `processes/renovation/mini-project.bpmn`
- [x] Inclusive gateway for affected disciplines (only involved disciplines execute)
- [x] Condensed design→production→handback cycle

---

## Iteration 7: Emergency & Incident + Change Management -- COMPLETE

### Tasks
- [x] Create `processes/emergency/incident-response.bpmn` (6 incident types)
- [x] Create `processes/operations/change-management.bpmn` (minor/moderate/major classification)
- [x] Change management routes to renovation mini-project for moderate changes

---

## Iteration 8: Process Quality Review -- COMPLETE

### Tasks
- [x] Validate all BPMN files for structural correctness
- [x] Verify all Call Activity references resolve to existing process IDs
- [x] Fix 4 orphaned calledElement references (production-structural/plumbing/transport, renovation-subprocess)
- [x] Check sequence flows have valid sourceRef/targetRef (design-phase: 33/33, production-phase: 30/30)
- [x] Update cross-reference doc (06) with new processes and metrics

---

## Iteration 9: Deployment + Delegate Guide -- COMPLETE

### Tasks
- [x] Create `processes/META-INF/processes.xml` deployment descriptor
- [x] Create doc 08: Delegate implementation guide (22 delegates, priority-ranked)
- [x] Define REST API integration pattern for all delegates
- [x] Stub implementation strategy for phased rollout

---

## Iteration 10: KPIs and SLA Monitoring -- COMPLETE

### Tasks
- [x] Create doc 09: Process KPIs and SLA monitoring
- [x] Define phase duration targets and escalation thresholds
- [x] Define operational SLAs (access management, maintenance, warranty, inspections)
- [x] Define emergency response SLAs per incident type
- [x] Camunda SQL monitoring queries for dashboards
- [x] Dashboard recommendations (executive, operations, project manager)

---

## Iteration 11: Form Keys + Document Approval -- COMPLETE

### Tasks
- [x] Add `camunda:formKey` to user tasks in investigation-phase (8 tasks)
- [x] Add `camunda:formKey` to user tasks in design-phase (5 tasks)
- [x] Add `camunda:formKey` to user tasks in production-phase (8 tasks)
- [x] Add `camunda:formKey` to user tasks in procurement-phase (8 tasks)
- [x] Add `camunda:formKey` to user tasks in handover-phase (7 tasks)
- [x] Add `camunda:formKey` to user tasks in access-management (6 tasks)
- [x] Add `camunda:formKey` to user tasks in energy-management (5 tasks)
- [x] Add `camunda:formKey` to door-process with specific Samrum module IDs (9 tasks)
- [x] Create `processes/sub/document-approval.bpmn` (document approval workflow)
- [x] Create doc 10: Form-task mapping

### Key Decisions
- Form key convention: `doorman:{moduleId}:{objectTypeId}`
- Door subprocess uses specific Samrum module IDs (32, 63, 64, 65, 79, 83, 107, 108)
- Document approval supports 3 review types: single, dual (parallel), committee
- Revision loop: rejected documents cycle back for revision and reclassification

---

## Iteration 12: Complete FormKey Coverage -- COMPLETE

### Tasks
- [x] Add formKeys to pre-study-phase.bpmn (11 user tasks)
- [x] Add formKeys to operations-phase.bpmn (4 user tasks)
- [x] Add formKeys to decommission-phase.bpmn (7 user tasks)
- [x] Add formKeys to 9 discipline subprocesses (architecture, structural, fire-safety, hvac, electrical, sprinkler, transport, plumbing, access-control)
- [x] Add formKeys to operations: inspections, tenant-move, warranty, change-management (34 user tasks)
- [x] Add formKeys to maintenance.bpmn (4 user tasks)
- [x] Add formKeys to emergency/incident-response.bpmn (27 user tasks)
- [x] Add formKeys to renovation/mini-project.bpmn (16 user tasks)

### Key Decisions
- Discipline-specific modules: electrical→`doorman:108:6`, access-control→`doorman:83:6`, fire-safety→`doorman:79:6`, architecture→`doorman:32:6`
- Telecom integration task uses `doorman:103:16` (module 103, type 16 Brand- och säkerhetsfunktion)
- Renovation installation tasks use discipline-specific formKeys (arch→32:6, fire→79:6, door→83:6, elec→108:6)
- All generic tasks use `doorman:generic:1`
- Total: 237 formKey annotations across 30 BPMN files (100% coverage)

---

## Iteration 13: Task Permission Rules + FormService Module-Aware Upgrade -- COMPLETE

### Tasks
- [x] Add `generateFormForModule()` to FormService (queries module_view_columns for Samrum module column sets)
- [x] Add `generateFormFromKey()` to FormService (routes formKey to task-based or module-based generation)
- [x] Update forms API `/task/:taskId` endpoint to accept `formKey` query param
- [x] Create migration 012: task_permission_rules for 6 lifecycle phases (26 rules, 20 task-object mappings)
- [x] Type-check both formService.ts and forms.ts (clean compile)

### Key Decisions
- Module-aware forms pull columns from `module_view_columns` instead of `task_permission_rules`
- `generateFormFromKey("doorman:83:6", ...)` routes to module 83 (Passagekontroll) with type 6 attributes
- `generateFormFromKey("doorman:generic:1", ...)` falls back to task_permission_rules-based form generation
- Seeded rules for: investigation, design, production, procurement, handover, access-management, energy phases
- Task-object mappings link phase tasks to correct object types (6=access object, 9=room, 1=door)

---

## Iteration 14: Multi-Building, BIM, Contractor Scheduling, Indoor Climate -- COMPLETE

### Tasks
- [x] Create `processes/portfolio/building-portfolio.bpmn` (event-based gateway, 4 paths)
- [x] Update `docs/architecture/06-process-cross-reference.md` with portfolio process
- [x] Add 5 new delegate specs to `docs/architecture/08-delegate-implementation-guide.md`
- [x] Create `processes/portfolio/bim-coordination.bpmn` (BIM/IFC model management)
- [x] Wire BIM coordination as optional Call Activity in design-phase.bpmn (gw_bim_enabled)
- [x] Create migration 013: portfolio + BIM tables (building_portfolio, portfolio_campaigns, bim_models, bim_entity_mappings, bim_clash_results)
- [x] Create `processes/sub/contractor-scheduling.bpmn` (CPM, resource management, delay mitigation)
- [x] Wire contractor scheduling as parallel track in production-phase.bpmn
- [x] Create `processes/operations/indoor-climate.bpmn` (IAQ monitoring, radon/CO2/PM2.5)
- [x] Wire indoor climate as 7th parallel track in operations-phase.bpmn
- [ ] Add portfolio API endpoints to backend

### Key Decisions
- Event-based gateway pattern: portfolio process runs continuously, waiting for 1 of 4 triggers
- New buildings spawn `master-building-lifecycle` instances; existing buildings get `operations-phase`
- Bulk maintenance campaigns group work orders by geographic zone
- Portfolio KPI reporting aggregates across all building instances
- 5 new delegates: buildingInstanceDelegate, processSpawnDelegate, bulkMaintenanceDelegate, portfolioReportDelegate, portfolioBenchmarkDelegate

---

## Iteration 15: POE, Budget Overrun, Insurance, Sustainability -- COMPLETE

### Tasks
- [x] Create `processes/operations/post-occupancy-evaluation.bpmn` (4 parallel tracks: survey, walkthrough, performance, accessibility)
- [ ] Create `processes/sub/budget-overrun.bpmn` (ÄTA handling, cost escalation, re-scoping)
- [ ] Create `processes/operations/insurance-claim.bpmn` (property damage claim workflow)
- [x] Create `processes/sub/budget-overrun.bpmn` (3 severity paths: minor/moderate/major + ÄTA per AB 04)
- [x] Wire budget overrun as event subprocess in production-phase.bpmn (msg_budget_deviation)
- [x] Create `processes/operations/insurance-claim.bpmn` (5-phase: register→document→submit→settle→repair)
- [x] Wire POE into operations-phase as 7th parallel track with 6-month timer delay
- [x] Create `processes/operations/sustainability-reporting.bpmn` (ESG, EU Taxonomy, GHG, Miljöbyggnad)
- [x] Run process quality review: all 30 calledElement refs resolve, 301/301 formKeys (100%)
- [x] Fix 4 missing formKeys (master:handle_incident, door-process: install/inspect/document)

### Key Decisions
- POE includes 4 parallel evaluation tracks: occupant survey, physical walkthrough, technical performance, accessibility audit
- Accessibility audit per BBR 3:1 and HIN 2 with remediation path
- POE report feeds into action plan approved by building owner

---

## Iteration 16: Backend API for Portfolio + BIM -- DONE

### Tasks
- [x] Create `backend/src/api/portfolio.ts` (7 endpoints: buildings CRUD, campaigns, dashboard)
- [x] Type-check portfolio API (clean compile)
- [x] Create `backend/src/api/bim.ts` (8 endpoints: models CRUD, entity mappings, clash results)
- [x] Type-check BIM API (clean compile)
- [x] Wire portfolio + BIM routes into `demo-server.mjs` (15 new endpoints, syntax-verified)

### New Endpoints
**Portfolio** (`/api/portfolio/*`):
- `GET /api/portfolio/buildings` — list with lifecycle_phase/geographic_zone/is_active filters
- `GET /api/portfolio/buildings/:id` — single building detail with OMS type
- `POST /api/portfolio/buildings` — register building in portfolio
- `PUT /api/portfolio/buildings/:id` — update lifecycle_phase, is_active, process linkage
- `GET /api/portfolio/campaigns` — list campaigns with status/type filters
- `POST /api/portfolio/campaigns` — create maintenance campaign
- `GET /api/portfolio/dashboard` — aggregate KPIs (buildings, area, phases, types, campaigns)

**BIM/IFC** (`/api/bim/*`):
- `GET /api/bim/models` — list models with building/status filters
- `POST /api/bim/models` — register model (auto-versioning per building)
- `GET /api/bim/models/:id` — model detail with entity count + clash summary
- `PUT /api/bim/models/:id/status` — update parse/validation status
- `GET /api/bim/models/:id/entities` — list IFC↔OMS entity mappings
- `GET /api/bim/models/:id/clashes` — list clash results with status/severity filters
- `POST /api/bim/models/:id/clashes` — bulk insert clashes (transactional)
- `PUT /api/bim/clashes/:id` — resolve/accept/ignore clashes

---

## Iteration 17: Camunda Delegate Stubs -- DONE

### Tasks
- [x] Create `backend/src/delegates/types.ts` — DelegateExecution, DelegateResult, ProcessVariable types
- [x] Create `backend/src/delegates/lifecycle.ts` — projectInitDelegate, lifecycleTransitionDelegate, escalationDelegate
- [x] Create `backend/src/delegates/audit.ts` — auditWriteDelegate (P0, used by 20+ service tasks)
- [x] Create `backend/src/delegates/validation.ts` — validationDelegate, doorValidationDelegate, designValidationDelegate
- [x] Create `backend/src/delegates/operations.ts` — maintenance, inspection, energy, access, archive delegates
- [x] Create `backend/src/delegates/bim.ts` — ifcImport, ifcParse, bimValidation, clashDetection, bimSync delegates
- [x] Create `backend/src/delegates/notification.ts` — notification, report, tender, bid, contractor, warranty, AIM delegates
- [x] Create `backend/src/delegates/index.ts` — central registry with executeDelegate() dispatcher
- [x] Type-check all delegate files (clean compile)
- [x] Wire `GET /api/delegates` + `POST /api/delegates/:name/execute` into demo-server.mjs

### Delegate Registry (25 delegates)
| Priority | Delegate | Module |
|----------|----------|--------|
| P0 | projectInitDelegate | lifecycle.ts |
| P0 | lifecycleTransitionDelegate | lifecycle.ts |
| P0 | auditWriteDelegate | audit.ts |
| P1 | validationDelegate | validation.ts |
| P1 | doorValidationDelegate | validation.ts |
| P1 | designValidationDelegate | validation.ts |
| P1 | notificationDelegate | notification.ts |
| P1 | accessProvisionDelegate | operations.ts |
| P1 | aimPopulationDelegate | notification.ts |
| P1 | maintenanceQueryDelegate | operations.ts |
| P1 | bimSyncDelegate | bim.ts |
| P2 | escalationDelegate | lifecycle.ts |
| P2 | reportCompileDelegate | notification.ts |
| P2 | tenderPublishDelegate | notification.ts |
| P2 | bidRegistrationDelegate | notification.ts |
| P2 | contractorOnboardDelegate | notification.ts |
| P2 | warrantyActivationDelegate | notification.ts |
| P2 | maintenanceDateDelegate | operations.ts |
| P2 | inspectionQueryDelegate | operations.ts |
| P2 | energyDataCollectionDelegate | operations.ts |
| P2 | ifcImportDelegate | bim.ts |
| P2 | ifcParseDelegate | bim.ts |
| P2 | bimValidationDelegate | bim.ts |
| P2 | clashDetectionDelegate | bim.ts |
| P3 | archiveDelegate | operations.ts |

---

## Iteration 18: Process Quality Review Round 2 -- DONE

### Validation Results
- [x] 44 calledElement references — 0 broken (100% valid)
- [x] 301 formKeys — all present
- [x] 50 delegate expressions — 50 registered (100% coverage, 0 missing)
- [x] 2 signal refs, 8 unique message refs — consistent
- [x] 39 BPMN files, 39 process IDs — all accounted for

### New Delegate Files (Iteration 17-18)
| File | Delegates | Description |
|------|-----------|-------------|
| `delegates/types.ts` | — | DelegateExecution, DelegateResult types |
| `delegates/lifecycle.ts` | 3 | projectInit, lifecycleTransition, escalation |
| `delegates/audit.ts` | 1 | auditWrite |
| `delegates/validation.ts` | 3 | validation, doorValidation, designValidation |
| `delegates/operations.ts` | 6 | maintenance×2, inspection, energy, access, archive |
| `delegates/bim.ts` | 5 | ifcImport, ifcParse, bimValidation, clashDetection, bimSync |
| `delegates/notification.ts` | 7 | notification, report, tender, bid, contractor, warranty, aim |
| `delegates/portfolio.ts` | 5 | buildingInstance, processSpawn, bulkMaint, report, benchmark |
| `delegates/climate.ts` | 6 | climate×3, ghg, water, esg |
| `delegates/specialized.ts` | 14 | cost, budget, insurance, renovation×4, cpm×3, poe×2, document, auditLog |
| `delegates/index.ts` | — | Central registry + executeDelegate() |

---

## Iteration 19+: Future

- Frontend portfolio dashboard page
- Frontend BIM model viewer integration
- End-to-end process testing framework
- Process simulation / load testing

---

## File Inventory

### Architecture Docs
| File | Description |
|------|-------------|
| `01-plcs-building-lifecycle.md` | PLCS/AEC/ISO mapping to Doorman OMS |
| `02-user-personas.md` | 10 personas, role matrix, permission templates |
| `03-master-building-process.md` | Original 5-phase design (superseded by 8-phase) |
| `04-phase-process-details.md` | 8-phase hierarchy, gate criteria, variable flow |
| `05-module-process-mapping.md` | 271 Samrum modules -> BPMN subprocess mapping |
| `06-process-cross-reference.md` | Process inventory, Call Activity chains, metrics |
| `07-cross-discipline-integration.md` | Phased discipline execution, signals, data dependencies |
| `08-delegate-implementation-guide.md` | 22 delegate specs, REST API integration, stub strategy |
| `09-process-kpis-and-sla.md` | Phase KPIs, operational SLAs, monitoring queries, dashboards |

### BPMN Files (30 total)
| File | Process ID | Type |
|------|-----------|------|
| `master-building-lifecycle.bpmn` | `master-building-lifecycle` | Top-level |
| `phases/investigation-phase.bpmn` | `investigation-phase` | Phase |
| `phases/pre-study-phase.bpmn` | `pre-study-phase` | Phase |
| `phases/design-phase.bpmn` | `design-phase` | Phase |
| `phases/procurement-phase.bpmn` | `procurement-phase` | Phase |
| `phases/production-phase.bpmn` | `production-phase` | Phase |
| `phases/handover-phase.bpmn` | `handover-phase` | Phase |
| `phases/operations-phase.bpmn` | `operations-phase` | Phase |
| `phases/decommission-phase.bpmn` | `decommission-phase` | Phase |
| `sub/architecture.bpmn` | `design-architecture` | Discipline |
| `sub/structural.bpmn` | `design-structural` | Discipline |
| `sub/fire-safety.bpmn` | `fire-safety` | Discipline |
| `sub/door-process.bpmn` | `design-door-process` | Discipline |
| `sub/access-control.bpmn` | `access-control` | Discipline |
| `sub/electrical.bpmn` | `electrical` | Discipline |
| `sub/hvac.bpmn` | `hvac` | Discipline |
| `sub/sprinkler.bpmn` | `design-sprinkler` | Discipline |
| `sub/transport.bpmn` | `design-transport` | Discipline |
| `sub/plumbing.bpmn` | `design-plumbing` | Discipline |
| `sub/maintenance.bpmn` | `maintenance-cycle` | Operations |
| `operations/inspections.bpmn` | `operations-inspections` | Operations |
| `operations/tenant-move.bpmn` | `operations-tenant` | Operations |
| `operations/warranty.bpmn` | `operations-warranty` | Operations |
| `operations/access-management.bpmn` | `operations-access-management` | Operations |
| `operations/energy-management.bpmn` | `operations-energy` | Operations |
| `operations/change-management.bpmn` | `operations-change-management` | Operations |
| `emergency/incident-response.bpmn` | `incident-response` | Emergency |
| `renovation/mini-project.bpmn` | `renovation-mini-project` | Renovation |
| `portfolio/building-portfolio.bpmn` | `building-portfolio` | Portfolio |
| `portfolio/bim-coordination.bpmn` | `bim-coordination` | Portfolio |
| `sub/contractor-scheduling.bpmn` | `contractor-scheduling` | Discipline |
| `operations/indoor-climate.bpmn` | `operations-indoor-climate` | Operations |
| `operations/post-occupancy-evaluation.bpmn` | `post-occupancy-evaluation` | Operations |
| `operations/insurance-claim.bpmn` | `insurance-claim` | Operations |
| `sub/budget-overrun.bpmn` | `budget-overrun-handling` | Discipline |
| `operations/sustainability-reporting.bpmn` | `sustainability-reporting` | Operations |
| `door-maintenance.bpmn` | `door-maintenance` | Legacy |
| `door-unlock.bpmn` | `door-unlock` | Legacy |

---

## Last Updated: 2026-03-07 -- Iterations 1-18 complete (39 BPMN files, 301 formKeys, 10 architecture docs, 2 migrations, 17 REST endpoints, 50 delegate stubs, 100% coverage)
