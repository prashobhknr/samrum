# 07 - Cross-Discipline Integration Architecture

> Defines how disciplines coordinate during design and production phases,
> signal events for cross-process synchronization, and inter-discipline
> data dependencies.

---

## 1. Design Phase Phased Execution Model

### Problem
The original design-phase.bpmn ran all 10 disciplines in flat parallel. In reality,
some disciplines produce baseline data that others consume. Running them simultaneously
causes rework when baseline data changes.

### Solution: Two-Phase Discipline Execution

```
System Design (Systemhandling)
  |
  +-- PHASE A: Baseline Producers (parallel)
  |     +-- Architecture    → room layout, door locations, facade
  |     +-- Structural      → grid, shafts, penetrations, load paths
  |     +-- Fire Safety     → compartments, fire class, damper locations
  |     |
  |     [Join] → Baseline Review Meeting (Granskningsmote Fas A)
  |
  +-- PHASE B: Consumer Disciplines (parallel, after baseline frozen)
  |     +-- Door/Passage    ← arch (locations) + fire (class)
  |     +-- Access Control  ← door (inventory) + fire (emergency unlock)
  |     +-- Electrical      ← arch (rooms) + fire (alarm) + access (readers)
  |     +-- HVAC            ← arch (dims) + structural (shafts) + fire (dampers)
  |     +-- Sprinkler       ← fire (hazard class) + HVAC (water supply)
  |     +-- Transport       ← structural (shaft dims) + fire (designation)
  |     +-- Plumbing        ← structural (shaft locations)
  |     |
  |     [Join]
  |
  +-- Cross-Discipline Coordination (Samordning)
  +-- Energy Calculation
  +-- Validation → Design Freeze Signal → Audit → End
```

### Baseline Review Meeting
After Phase A completes, a mandatory review meeting verifies:
- Architecture room layout matches structural grid
- Fire compartment boundaries align with architectural plans
- Shaft locations coordinated between structural and HVAC routes
- Door locations and fire class assignments are consistent
- Boundary list (gransdragningslista) between disciplines is approved

This is gate-kept by `baseline_review` user task assigned to:
`project_managers, designers_architect, designers_structural, designers_fire`

---

## 2. Signal Events

### 2.1 Design Freeze (`sig_design_freeze`)

| Property | Value |
|----------|-------|
| Defined in | master-building-lifecycle.bpmn |
| Thrown by | design-phase.bpmn (after approval, before audit) |
| Caught by | procurement-phase.bpmn (can start preparing tender docs) |
| Semantics | All design documents are frozen; no further changes without formal change order |

The design freeze is a critical project milestone. After this signal:
- Tender documents can be prepared from frozen drawings
- No design changes without formal change management process
- PLCS lifecycle state transitions from AS_DESIGNED → ready for AS_PLANNED

### 2.2 Construction Start (`sig_construction_start`)

| Property | Value |
|----------|-------|
| Defined in | master-building-lifecycle.bpmn |
| Thrown by | production-phase.bpmn (after technical startup, before parallel installations) |
| Caught by | operations-phase.bpmn (event subprocess for future use) |
| Semantics | Physical construction has begun on site |

After this signal:
- Site access protocols are enforced
- Insurance coverage shifts to construction mode
- Weekly building meetings (byggmoten) begin
- Progress reporting starts

---

## 3. Inter-Discipline Data Dependencies

### 3.1 Dependency Graph

```
Architecture ─────────┬──→ Fire Safety ──────┬──→ Door Process ──→ Access Control ──→ Electrical
                      │                      │
                      ├──→ HVAC ◄────────────┤
                      │                      │
Structural ───────────┼──→ Transport         ├──→ Sprinkler
                      │                      │
                      └──→ Plumbing          └──→ Electrical (fire alarm)
```

### 3.2 Data Flow Matrix

| Producer | Consumer | Data Element | Doorman Object Type |
|----------|----------|-------------|---------------------|
| Architecture | Fire Safety | Room layout, fire compartment boundaries | Rum (type 9) |
| Architecture | HVAC | Room dimensions, climate zone requirements | Rum (type 9) |
| Architecture | Electrical | Room lighting requirements, outlet locations | Rum (type 9) |
| Architecture | Door Process | Door locations, dimensions, swing direction | ID tilltradeobjekt (type 6) |
| Fire Safety | Door Process | Fire class per door (EI30/EI60/EI90), smoke class | ID tilltradeobjekt (type 6) |
| Fire Safety | HVAC | Fire damper locations, smoke extract zones | - |
| Fire Safety | Electrical | Fire alarm detector placement, emergency lighting | - |
| Fire Safety | Transport | Fire fighter lift designation, fire recall | - |
| Fire Safety | Sprinkler | Hazard classification per zone | - |
| Structural | HVAC | Shaft penetrations, beam locations (route constraints) | - |
| Structural | Transport | Shaft dimensions, pit depth, machine room | - |
| Structural | Plumbing | Shaft locations, floor penetrations | - |
| Door Process | Access Control | Door inventory, reader locations, lock types | ID tilltradeobjekt (type 6) |
| Access Control | Electrical | Power supply to readers/locks (PoE or 12V) | - |
| HVAC | Sprinkler | Water supply coordination, pipe routing | - |

### 3.3 How Data Flows in Doorman

1. Phase A disciplines create/update `attribute_values` in Doorman OMS
2. Baseline review meeting verifies data consistency
3. Phase B disciplines read `attribute_values` created by Phase A
4. Each discipline's Call Activity receives `projectId` and `buildingId`
5. Within each subprocess, user tasks query Doorman for relevant object instances
6. `task_permission_rules` control which attributes each discipline can read/write

---

## 4. Coordination Mechanisms

### 4.1 Boundary Lists (Gransdragningslistor)
A boundary list defines which discipline is responsible for what at each interface point.
Example for a fire door:
- **Architecture**: location, dimensions, finish material
- **Fire Safety**: fire class (EI30), smoke seal requirement
- **Door Process**: lock type, closer specification, hardware schedule
- **Access Control**: reader type, key group assignment
- **Electrical**: power supply to reader/lock

### 4.2 Design Review Meetings (Samordningsmoeten)
Periodic meetings during Phase B where disciplines present progress and flag conflicts:
- Modeled as the `design_coordination` user task after all disciplines join
- Assigned to `project_managers` who chair the coordination
- Can trigger a validation loop back if `validationPassed == false`

### 4.3 Clash Detection
In a BIM-enabled project, clash detection runs automatically:
- Modeled as part of the `designValidationDelegate` service task
- Checks spatial conflicts between discipline models
- Returns `validationPassed` boolean

---

## 5. Change Management Integration

When a design change is needed after the design freeze:

```
Change Request → Impact Assessment
  |
  ├── Minor (e.g., color change): Direct modification, no process impact
  ├── Moderate (e.g., door relocation): Mini-project (renovation subprocess)
  └── Major (e.g., structural change): Full re-design of affected disciplines
```

The change management process (`operations/change-management.bpmn`) handles this by:
1. Classifying the change scope
2. Identifying affected disciplines from the dependency graph
3. Routing to appropriate approval level
4. For moderate/major: invoking renovation mini-project (`renovation/mini-project.bpmn`)

---

## 6. Emergency/Incident Integration

The emergency incident response process (`emergency/incident-response.bpmn`) integrates with:
- **Access Control**: lock down zones, override access policies
- **Fire Safety**: coordinate with fire department, verify fire systems
- **HVAC**: emergency ventilation modes (smoke extract, pressurization)
- **Electrical**: backup power, emergency lighting verification
- **Maintenance**: damage assessment, restoration planning

---

## 7. Production Phase Coordination

During production, discipline installation tracks run in parallel but have implicit dependencies:

```
Structural (shell) ──must precede──→ All interior installations
HVAC rough-in ──must precede──→ Sprinkler (shared water supply)
Electrical rough-in ──must precede──→ Access Control installation
Door frames ──must precede──→ Door hardware ──must precede──→ Access reader mount
```

The production-phase models these as parallel Call Activities (simplification),
with the `coordinated_testing` (SFP) task serving as the integration verification
point where all systems are tested together.

The `sig_construction_start` signal is thrown after technical startup to notify
all interested parties that physical construction has begun.

---

## 8. Process File Inventory (Updated)

| File | Process ID | Type | New/Modified |
|------|-----------|------|-------------|
| `phases/design-phase.bpmn` | `design-phase` | Phase | **Modified** — phased A/B execution, design freeze signal |
| `phases/production-phase.bpmn` | `production-phase` | Phase | **Modified** — construction start signal |
| `operations/change-management.bpmn` | `operations-change-mgmt` | Operations | **New** — change classification, mini-project routing |
| `emergency/incident-response.bpmn` | `incident-response` | Emergency | **New** — 6 incident types, restoration flow |
| `renovation/mini-project.bpmn` | `renovation-mini-project` | Renovation | **New** — condensed design→production cycle |

Total BPMN files: **30** (was 27)
