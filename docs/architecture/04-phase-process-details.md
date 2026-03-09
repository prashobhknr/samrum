# 04 - Phase Process Details

> Detailed description of all 8 lifecycle phase BPMNs, their Call Activities,
> user tasks, and integration with Doorman's OMS.

---

## 1. Process Hierarchy Overview

```
master-building-lifecycle.bpmn (8 phases + gates)
  |
  +-- Fas 1: Utredning (investigation-phase.bpmn)
  |     +-- Stakeholder needs gathering
  |     +-- Parallel: Space program / Risk analysis / Regulatory pre-check
  |     +-- Budget estimate
  |     +-- Phase gate: Owner approval
  |
  +-- [Gate 1] --> lifecycle_phase = pre_study
  |
  +-- Fas 2: Forstudie (pre-study-phase.bpmn)
  |     +-- Concept design alternatives
  |     +-- Parallel: 5 discipline feasibility studies
  |     +-- Select concept -> Cost estimation -> Scope/timeline
  |     +-- Building permit preparation
  |     +-- Phase gate: Owner + FM approval
  |
  +-- [Gate 2] --> lifecycle_phase = design
  |
  +-- Fas 3: Projektering (design-phase.bpmn)
  |     +-- System design (Systemhandling)
  |     +-- Parallel: 10 discipline Call Activities
  |     |     +-- Architecture (design-architecture.bpmn)
  |     |     +-- Structural (design-structural.bpmn)
  |     |     +-- Fire Safety (fire-safety.bpmn)
  |     |     +-- Door/Passage (design-door-process.bpmn)
  |     |     +-- Access Control (access-control.bpmn)
  |     |     +-- Electrical (electrical.bpmn)
  |     |     +-- HVAC (hvac.bpmn)
  |     |     +-- Sprinkler (design-sprinkler.bpmn)
  |     |     +-- Transport (design-transport.bpmn)
  |     |     +-- Plumbing (design-plumbing.bpmn)
  |     +-- Cross-discipline coordination
  |     +-- Energy calculation
  |     +-- Validation + Phase gate
  |
  +-- [Gate 3] --> lifecycle_phase = procurement
  |
  +-- Fas 4: Upphandling (procurement-phase.bpmn)
  |     +-- Procurement strategy + contract packaging
  |     +-- Tender document preparation
  |     +-- Publish -> Q&A -> Receive bids
  |     +-- Evaluation -> Selection -> Contract signing
  |     +-- Contractor onboarding into Doorman
  |
  +-- [Gate 4] --> lifecycle_phase = production
  |
  +-- Fas 5: Produktion (production-phase.bpmn)
  |     +-- Pre-construction meeting
  |     +-- Technical startup (Startbesked)
  |     +-- Parallel: 8 installation Call Activities
  |     +-- Coordinated Functional Testing (SFP)
  |     +-- OVK inspection (mandatory ventilation)
  |     +-- Final inspection (Slutbesiktning)
  |     +-- Remediation loop if needed
  |     +-- As-built documentation
  |
  +-- [Gate 5] --> lifecycle_phase = handover
  |
  +-- Fas 6: Overlamning (handover-phase.bpmn)
  |     +-- Parallel: Documentation/AIM transfer / FM training / Move-in prep
  |     +-- Warranty period activation (5 years)
  |     +-- FM acceptance
  |     +-- Obtain Slutbesked from municipality
  |
  +-- [Gate 6] --> lifecycle_phase = operations
  |
  +-- Fas 7: Forvaltning (operations-phase.bpmn)
  |     +-- Operations setup
  |     +-- Parallel long-running sub-processes:
  |     |     +-- Scheduled maintenance (maintenance-cycle.bpmn)
  |     |     +-- Access management (operations-access-management.bpmn)
  |     |     +-- Regulatory inspections (operations-inspections.bpmn)
  |     |     +-- Warranty management (operations-warranty.bpmn)
  |     |     +-- Tenant management (operations-tenant.bpmn)
  |     |     +-- Energy management (operations-energy.bpmn)
  |     +-- Event sub-process: Change management (triggered by message)
  |
  +-- [Gate 7: Decommission decision]
  |
  +-- Fas 8: Avveckling (decommission-phase.bpmn)
        +-- Decommission planning
        +-- Parallel: Tenant relocation / Environmental survey / Demolition permit
        +-- System deactivation
        +-- Salvage and recycling
        +-- Demolition execution
        +-- Archive and close lifecycle
```

---

## 2. Phase Gate Criteria

| Gate | From -> To | Required Conditions | Approvers |
|------|-----------|---------------------|-----------|
| **Gate 1** | Investigation -> Pre-study | Space program complete, risk assessment done, budget estimate acceptable | `owners`, `approvers` |
| **Gate 2** | Pre-study -> Design | Feasibility studies positive, concept selected, cost within budget, building permit application filed | `owners`, `facility_managers`, `approvers` |
| **Gate 3** | Design -> Procurement | All 10 disciplines approved, coordination complete, energy calc meets BBR, no unresolved conflicts | `project_managers`, `owners`, `approvers` |
| **Gate 4** | Procurement -> Production | Contracts signed, contractors onboarded, Startbesked received | `owners`, `project_managers` |
| **Gate 5** | Production -> Handover | Slutbesiktning approved, OVK passed, as-built docs complete | `project_managers`, `owners`, `supervisors` |
| **Gate 6** | Handover -> Operations | AIM validated, FM trained, keys transferred, Slutbesked received | `facility_managers`, `owners` |
| **Gate 7** | Operations -> Decommission | Decommission decision approved by owner | `owners` |

---

## 3. Timer Boundaries (Escalation)

| Phase | Timer Duration | Escalation Action |
|-------|---------------|-------------------|
| Investigation | 90 days | Notify owner + PM |
| Pre-study | 120 days | Notify owner + PM |
| Design | 270 days | Notify owner + PM + all discipline leads |
| Procurement | 120 days | Notify owner + legal |
| Production | 730 days (2 years) | Notify owner + PM |
| Handover | 90 days | Notify owner + FM |

---

## 4. Lifecycle Phase Transition

Each phase gate includes a service task that calls Doorman's lifecycle API:

```
POST /api/objects/:buildingId/lifecycle
{
  "targetPhase": "design",
  "cascade": true,
  "userId": "${currentUser}"
}
```

The `lifecycleTransitionDelegate` in Camunda:
1. Validates the transition is legal (e.g., `pre_study` -> `design` is valid)
2. Updates `object_instances.lifecycle_phase` for the building
3. Optionally cascades to all child instances
4. Writes to `audit_log`
5. Adjusts active `task_permission_rules` for the new phase

---

## 5. Process Variables Flow

### Variables Set at Project Initiation

| Variable | Type | Description |
|----------|------|-------------|
| `projectId` | String | Doorman project identifier |
| `buildingId` | Integer | Building `object_instances.id` |
| `ownerGroupId` | String | Owner's user group |
| `currentPhase` | String | Updated at each gate |

### Variables Accumulated Through Phases

| Variable | Set By Phase | Used By Phase |
|----------|-------------|---------------|
| `spaceProgramId` | Investigation | Pre-study, Design |
| `riskAssessmentId` | Investigation | Pre-study |
| `budgetEstimate` | Pre-study | Design, Procurement |
| `projectScope` | Pre-study | Design |
| `designCompletionDate` | Design | Procurement |
| `totalEstimatedCost` | Design | Procurement |
| `contractIds` | Procurement | Production |
| `awardedContractorIds` | Procurement | Production |
| `commissioningDate` | Production | Handover |
| `warrantyStartDate` | Handover | Operations |

---

## 6. Swedish Regulatory Touchpoints

| Process Step | Regulation | Mandatory |
|-------------|-----------|-----------|
| Building permit (Bygglov) | PBL 9 kap | Yes for new build |
| Start notification (Startbesked) | PBL 10 kap 3 § | Yes before construction |
| OVK inspection | BFS 2011:16 | Yes before occupancy |
| Energy declaration | Lag 2006:985 | Yes for buildings > 250m2 |
| Final approval (Slutbesked) | PBL 10 kap 4 § | Yes before occupancy |
| Fire safety documentation | BBR 5:12 | Yes for all buildings |
| Climate declaration | Lag 2021:787 | Yes for new buildings from 2022 |
| Demolition permit (Rivningslov) | PBL 9 kap 10 § | Yes for significant demolition |

---

## 7. Connection to Doorman App Modules

Each subprocess maps to one or more Doorman modules (from the 271 Samrum modules).
The module becomes the data entry interface for that subprocess's user tasks.

When a Camunda user task activates:
1. Camunda sends task details to Doorman via REST
2. Doorman creates a `task_object_mapping` linking the task to relevant object instances
3. The module view (`/modules/:id`) shows only the attributes allowed by `task_permission_rules`
4. User completes the form → Doorman saves `attribute_values` + `audit_log`
5. Doorman signals task completion back to Camunda

```
Camunda User Task  -->  Doorman Module View  -->  DynamicForm (filtered by permissions)
     |                       |                         |
     |                  module_view_columns        task_permission_rules
     |                  (column definitions)       (visible/editable/required)
     |                       |                         |
     +------ task_object_mappings ------+--- attribute_values (saved data)
                                            audit_log (change history)
```
