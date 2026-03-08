# 06 - Process Cross-Reference and Integration Map

> Maps all 30 BPMN processes, their Call Activity chains, user personas per task,
> and integration points between processes.
>
> **Updated**: Iteration 5-7 additions (change management, emergency response, renovation mini-project)

---

## 1. Complete Process Inventory

### 1.1 Top-Level

| Process ID | File | Type | Called By |
|-----------|------|------|----------|
| `master-building-lifecycle` | `master-building-lifecycle.bpmn` | Executable | Message start |

### 1.2 Phase Processes (called by master)

| Process ID | File | Phase # | PLCS State | Timer |
|-----------|------|---------|------------|-------|
| `investigation-phase` | `phases/investigation-phase.bpmn` | 1 | AS_REQUIRED | 90d |
| `pre-study-phase` | `phases/pre-study-phase.bpmn` | 2 | AS_REQUIRED | 120d |
| `design-phase` | `phases/design-phase.bpmn` | 3 | AS_DESIGNED | 270d |
| `procurement-phase` | `phases/procurement-phase.bpmn` | 4 | AS_DESIGNED | 120d |
| `production-phase` | `phases/production-phase.bpmn` | 5 | AS_REALIZED | 730d |
| `handover-phase` | `phases/handover-phase.bpmn` | 6 | AS_IS | 90d |
| `operations-phase` | `phases/operations-phase.bpmn` | 7 | AS_IS | - |
| `decommission-phase` | `phases/decommission-phase.bpmn` | 8 | AS_REMOVED | - |

### 1.3 Discipline Subprocesses (called by design-phase and production-phase)

| Process ID | File | Design Phase | Production Phase |
|-----------|------|-------------|-----------------|
| `design-architecture` | `sub/architecture.bpmn` | Yes | - |
| `design-structural` | `sub/structural.bpmn` | Yes | Yes (ca_prod_structural) |
| `fire-safety` | `sub/fire-safety.bpmn` | Yes | Yes (ca_prod_fire) |
| `design-door-process` | `sub/door-process.bpmn` | Yes | Yes (ca_prod_doors) |
| `access-control` | `sub/access-control.bpmn` | Yes | Yes (ca_prod_access) |
| `electrical` | `sub/electrical.bpmn` | Yes | Yes (ca_prod_elec) |
| `hvac` | `sub/hvac.bpmn` | Yes | Yes (ca_prod_hvac) |
| `design-sprinkler` | `sub/sprinkler.bpmn` | Yes | - |
| `design-transport` | `sub/transport.bpmn` | Yes | Yes (ca_prod_transport) |
| `design-plumbing` | `sub/plumbing.bpmn` | Yes | Yes (ca_prod_plumbing) |
| `contractor-scheduling` | `sub/contractor-scheduling.bpmn` | - | Yes (ca_prod_scheduling) |
| `budget-overrun-handling` | `sub/budget-overrun.bpmn` | - | Yes (event subprocess in production) |
| `maintenance-cycle` | `sub/maintenance.bpmn` | - | - (operations) |

### 1.4 Operational Processes (called by operations-phase)

| Process ID | File | Trigger | Frequency |
|-----------|------|---------|-----------|
| `maintenance-cycle` | `sub/maintenance.bpmn` | Timer R/P30D + Manual | Monthly |
| `operations-access-management` | `operations/access-management.bpmn` | On-demand | As needed |
| `operations-inspections` | `operations/inspections.bpmn` | Timer R/P365D | Annual |
| `operations-warranty` | `operations/warranty.bpmn` | Timer (2yr, 5yr) | Fixed |
| `operations-tenant` | `operations/tenant-move.bpmn` | On-demand | As needed |
| `operations-energy` | `operations/energy-management.bpmn` | Timer R/P365D | Annual |
| `operations-change-management` | `operations/change-management.bpmn` | Message event | As needed |
| `operations-indoor-climate` | `operations/indoor-climate.bpmn` | Timer R/P30D | Monthly |
| `post-occupancy-evaluation` | `operations/post-occupancy-evaluation.bpmn` | Manual (6-12mo after handover) | Periodic |
| `sustainability-reporting` | `operations/sustainability-reporting.bpmn` | Timer R/P365D | Annual |

### 1.5 Insurance Process

| Process ID | File | Trigger |
|-----------|------|---------|
| `insurance-claim` | `operations/insurance-claim.bpmn` | Message: msg_insurance_trigger |

### 1.6 Emergency Process

| Process ID | File | Trigger |
|-----------|------|---------|
| `incident-response` | `emergency/incident-response.bpmn` | Message: msg_incident_reported |

### 1.6 Renovation Process

| Process ID | File | Called By |
|-----------|------|----------|
| `renovation-mini-project` | `renovation/mini-project.bpmn` | operations-change-management (moderate changes) |

### 1.7 Portfolio Process

| Process ID | File | Trigger |
|-----------|------|---------|
| `building-portfolio` | `portfolio/building-portfolio.bpmn` | Event-based gateway (4 paths) |

---

## 2. Call Activity Chain (Full Depth)

```
master-building-lifecycle
  |
  +-- investigation-phase
  |     (no Call Activities — all inline user tasks)
  |
  +-- pre-study-phase
  |     (no Call Activities — all inline user tasks)
  |
  +-- design-phase
  |     +-- PHASE A (baseline producers, parallel):
  |     |     +-- design-architecture (sub/architecture.bpmn)
  |     |     +-- design-structural (sub/structural.bpmn)
  |     |     +-- fire-safety (sub/fire-safety.bpmn)
  |     +-- [Baseline Review Meeting]
  |     +-- PHASE B (consumers, parallel):
  |     |     +-- design-door-process (sub/door-process.bpmn)
  |     |     +-- access-control (sub/access-control.bpmn)
  |     |     +-- electrical (sub/electrical.bpmn)
  |     |     +-- hvac (sub/hvac.bpmn)
  |     |     +-- design-sprinkler (sub/sprinkler.bpmn)
  |     |     +-- design-transport (sub/transport.bpmn)
  |     |     +-- design-plumbing (sub/plumbing.bpmn)
  |     +-- bim-coordination (portfolio/bim-coordination.bpmn) [if bimEnabled]
  |     +-- [Design Freeze Signal: sig_design_freeze]
  |
  +-- procurement-phase
  |     (no Call Activities — all inline)
  |
  +-- production-phase
  |     +-- [Construction Start Signal: sig_construction_start]
  |     +-- design-structural (reused for production)
  |     +-- design-door-process (reused for production)
  |     +-- hvac (reused for production)
  |     +-- electrical (reused for production)
  |     +-- fire-safety (reused for production)
  |     +-- access-control (reused for production)
  |     +-- design-plumbing (reused for production)
  |     +-- design-transport (reused for production)
  |     +-- contractor-scheduling (sub/contractor-scheduling.bpmn)
  |
  +-- handover-phase
  |     (no Call Activities — inline parallel tracks)
  |
  +-- operations-phase
  |     +-- maintenance-cycle (sub/maintenance.bpmn)
  |     +-- operations-access-management (operations/access-management.bpmn)
  |     +-- operations-inspections (operations/inspections.bpmn)
  |     +-- operations-warranty (operations/warranty.bpmn)
  |     +-- operations-tenant (operations/tenant-move.bpmn)
  |     +-- operations-energy (operations/energy-management.bpmn)
  |     +-- operations-indoor-climate (operations/indoor-climate.bpmn)
  |     +-- post-occupancy-evaluation (operations/post-occupancy-evaluation.bpmn) [6mo delay]
  |     +-- sustainability-reporting (operations/sustainability-reporting.bpmn)
  |
  +-- decommission-phase
        (no Call Activities — inline)

--- Standalone processes (triggered by messages) ---

operations-change-management
  +-- renovation-mini-project (for moderate changes)
        +-- design-architecture (if scope includes architecture)
        +-- design-structural (if scope includes structural)
        +-- fire-safety (if scope includes fire)
        +-- design-door-process (if scope includes doors)
        +-- hvac (if scope includes HVAC)
        +-- electrical (if scope includes electrical)

incident-response
  (no Call Activities — all inline, 6 incident type paths)

building-portfolio (event-based gateway, continuous loop)
  +-- master-building-lifecycle (for new buildings)
  +-- operations-phase (for existing buildings — bulk maintenance)
```

**Max depth**: master -> phase -> discipline = 3 levels
**Max depth (renovation)**: change-mgmt -> mini-project -> discipline = 3 levels

---

## 3. User Persona Task Distribution

### Tasks per Persona (across all processes)

| Persona | Task Count | Key Processes |
|---------|-----------|---------------|
| P01 Anvandare | 2 | investigation (space review), operations (fault reporting) |
| P02 Fastighetsagare/owners | 12 | All phase gates, procurement, warranty |
| P03 Forvaltare/facility_managers | 18 | Pre-study, handover, all operations |
| P04 Projektledare/project_managers | 25 | All project phases, coordination |
| P05 Projektor/designers_* | 35 | Design phase (most tasks), pre-study feasibility |
| P06 Byggentreprenor/contractors | 15 | Production, handover, warranty |
| P07 Underleverantor/locksmiths,etc | 5 | Production installation, maintenance |
| P08 Teknikverksamhet/maintenance | 8 | Maintenance cycle, inspections, decommission |
| P09 Ekonomi/finance,legal | 8 | Procurement, investigation, contracts |
| P10 Sakerhetspersonal/security_* | 10 | Access control (all phases), operations |

### Busiest Candidate Groups

| Group | Process Count | Task Count |
|-------|-------------|-----------|
| `project_managers` | 12 | 25+ |
| `facility_managers` | 10 | 18+ |
| `designers_architect` | 4 | 8 |
| `designers_fire` | 3 | 7 |
| `security_admin` | 5 | 10 |
| `contractors` | 6 | 15 |

---

## 4. Cross-Process Integration Points

### 4.1 Data Dependencies Between Disciplines

| Producer Process | Consumer Process | Data Element |
|-----------------|-----------------|--------------|
| `design-architecture` | `fire-safety` | Room layout, fire compartment boundaries |
| `design-architecture` | `hvac` | Room dimensions, climate requirements |
| `design-architecture` | `electrical` | Room lighting requirements |
| `design-architecture` | `design-door-process` | Door locations, dimensions |
| `fire-safety` | `design-door-process` | Fire class per door (EI30/60/90) |
| `fire-safety` | `hvac` | Fire damper locations |
| `fire-safety` | `electrical` | Fire alarm detector placement |
| `fire-safety` | `design-transport` | Fire fighter lift designation |
| `design-structural` | `hvac` | Shaft penetrations, beam locations |
| `design-structural` | `design-transport` | Shaft dimensions, pit depth |
| `design-door-process` | `access-control` | Door inventory, reader locations |
| `access-control` | `electrical` | Power supply to readers |
| `hvac` | `design-sprinkler` | Water supply coordination |

### 4.2 Phase-to-Phase Data Flow

| Source Phase | Target Phase | Variables Passed |
|-------------|-------------|-----------------|
| Investigation | Pre-study | `spaceProgramId`, `riskAssessmentId` |
| Pre-study | Design | `budgetEstimate`, `projectScope`, `spaceProgramId` |
| Design | Procurement | `totalEstimatedCost`, `designCompletionDate` |
| Procurement | Production | `contractIds`, `awardedContractorIds` |
| Production | Handover | `commissioningDate` |
| Handover | Operations | `warrantyStartDate`, `aimValidated` |

### 4.3 Service Task Delegates Required

| Delegate Expression | Used In | Purpose |
|--------------------|---------|---------|
| `${projectInitDelegate}` | master | Initialize project variables |
| `${lifecycleTransitionDelegate}` | master (7x) | Update `lifecycle_phase` |
| `${escalationDelegate}` | master (6x) | Timer escalation notification |
| `${reportCompileDelegate}` | investigation, pre-study | Compile phase reports |
| `${validationDelegate}` | 8 discipline subs | Validate design completeness |
| `${doorValidationDelegate}` | door-process | Door-specific validation |
| `${auditWriteDelegate}` | All (20+ tasks) | Write to audit_log |
| `${maintenanceQueryDelegate}` | maintenance-cycle | Query objects due for maintenance |
| `${maintenanceDateDelegate}` | maintenance-cycle | Update maintenance date |
| `${tenderPublishDelegate}` | procurement | Publish tender documents |
| `${bidRegistrationDelegate}` | procurement | Register received bids |
| `${contractorOnboardDelegate}` | procurement | Create contractor user groups |
| `${aimPopulationDelegate}` | handover | Transfer PIM to AIM |
| `${warrantyActivationDelegate}` | handover | Activate warranty period |
| `${notificationDelegate}` | procurement, various | Send notifications |
| `${inspectionQueryDelegate}` | inspections | Query due inspections |
| `${energyDataCollectionDelegate}` | energy | Collect energy consumption |
| `${accessProvisionDelegate}` | access-management | Provision access cards |
| `${archiveDelegate}` | decommission | Archive building data |

---

## 5. Completeness Assessment

### What We Have (Strong)

- Full 8-phase lifecycle from investigation to decommission
- 12 discipline/sub-process subprocesses (10 original + contractor scheduling + budget overrun)
- 10 operational sub-processes (maintenance, access, inspections, warranty, tenant, energy, change mgmt, indoor climate, POE, sustainability)
- Phase gates with lifecycle transitions
- Timer escalations on all project phases
- Error handling on production (+ budget overrun event subprocess)
- Event sub-process for change management
- Inclusive gateway for conditional inspections
- Swedish regulatory touchpoints (OVK, Bygglov, Slutbesked, SBA, BBR, AFS)
- AB 04 contract-aligned warranty management and ÄTA handling
- Multi-path operational processes (access, tenant, insurance)
- BIM/IFC integration with clash detection and OMS attribute sync
- Multi-building portfolio management with bulk campaigns
- Post-occupancy evaluation with accessibility audit
- Sustainability/ESG reporting (EU Taxonomy, GHG Protocol, Miljöbyggnad)
- 100% formKey coverage (301/301 user tasks)
- All 30 calledElement cross-references validated

### Known Gaps (for future iterations)

1. ~~**Renovation mini-project**~~: RESOLVED — `renovation/mini-project.bpmn` created
2. ~~**Cross-discipline signals**~~: RESOLVED — design freeze + construction start signals implemented
3. ~~**Multi-building**~~: RESOLVED — `portfolio/building-portfolio.bpmn` created with event-based gateway for portfolio-level management
4. ~~**Contractor scheduling**~~: RESOLVED — `sub/contractor-scheduling.bpmn` with CPM, resource management, and delay mitigation
5. ~~**BIM integration**~~: RESOLVED — `portfolio/bim-coordination.bpmn` with IFC import, clash detection, OMS sync
6. ~~**Document management**~~: RESOLVED — `sub/document-approval.bpmn` with single/dual/committee review paths
7. ~~**Risk escalation**~~: RESOLVED — `sub/budget-overrun.bpmn` with 3 severity paths, ÄTA per AB 04
8. ~~**Insurance events**~~: RESOLVED — `incident-response.bpmn` + `operations/insurance-claim.bpmn` for full claim lifecycle
9. ~~**Accessibility audit**~~: RESOLVED — `operations/post-occupancy-evaluation.bpmn` includes full accessibility track per BBR 3:1 and HIN 2
10. ~~**Indoor environment**~~: RESOLVED — `operations/indoor-climate.bpmn` with sensor data collection, threshold alerts, remediation tracking
11. ~~**Change management**~~: RESOLVED — `operations/change-management.bpmn` created

---

## 6. Process Metrics

| Metric | Value |
|--------|-------|
| Total BPMN files | 39 |
| Total user tasks | ~222 |
| Total service tasks | ~75 |
| Total gateways | ~64 |
| Total Call Activities | ~42 |
| Max process depth | 3 levels |
| Unique candidate groups | 28+ |
| Timer events | 11 |
| Parallel gateways | 14 |
| Inclusive gateways | 4 |
| Signal events | 2 (design_freeze, construction_start) |
| Process categories | 8 (master, phase, discipline, operations, emergency, renovation, portfolio, insurance) |
