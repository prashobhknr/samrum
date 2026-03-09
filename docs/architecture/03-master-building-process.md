# 03 - Master Building Process Design

> Top-level BPMN process architecture using Camunda 7 Call Activities,
> phase gates, and parallel discipline workflows.

---

## 1. Process Hierarchy

```
master-building-lifecycle (top-level)
  |
  +-- Phase 1: investigation-phase (Call Activity)
  |     +-- investigation-space-program
  |     +-- investigation-risk-analysis
  |
  +-- [Phase Gate 1: investigation-approved]
  |
  +-- Phase 2: design-phase (Call Activity)
  |     +-- Parallel Gateway (fork)
  |     |     +-- design-architecture
  |     |     +-- design-fire-safety
  |     |     +-- design-door-process
  |     |     +-- design-access-security
  |     |     +-- design-electrical
  |     |     +-- design-hvac
  |     |     +-- design-sprinkler
  |     |     +-- design-transport
  |     +-- Parallel Gateway (join)
  |     +-- design-coordination (all disciplines merged)
  |
  +-- [Phase Gate 2: design-approved]
  |
  +-- Phase 3: production-phase (Call Activity)
  |     +-- Parallel Gateway (fork)
  |     |     +-- production-doors
  |     |     +-- production-hvac
  |     |     +-- production-electrical
  |     |     +-- production-fire-systems
  |     |     +-- production-access-control
  |     |     +-- production-transport
  |     +-- Parallel Gateway (join)
  |     +-- production-commissioning
  |
  +-- [Phase Gate 3: production-approved]
  |
  +-- Phase 4: handover-phase (Call Activity)
  |     +-- handover-documentation
  |     +-- handover-aim-validation
  |     +-- handover-fm-acceptance
  |
  +-- [Phase Gate 4: handover-approved]
  |
  +-- Phase 5: operations-phase (Call Activity)
        +-- operations-maintenance-cycle (recurring)
        +-- operations-access-management (recurring)
        +-- operations-change-management (event-driven)
```

---

## 2. Master Process Design

### Process ID: `master-building-lifecycle`

| Element | Type | Description |
|---------|------|-------------|
| `start_project` | Message Start Event | Triggered by `msg_project_initiated` |
| `phase1_investigation` | Call Activity | Calls `investigation-phase` |
| `gate1_investigation` | Exclusive Gateway | Checks `investigationApproved == true` |
| `phase2_design` | Call Activity | Calls `design-phase` |
| `gate2_design` | Exclusive Gateway | Checks `designApproved == true` |
| `phase3_production` | Call Activity | Calls `production-phase` |
| `gate3_production` | Exclusive Gateway | Checks `productionApproved == true` |
| `phase4_handover` | Call Activity | Calls `handover-phase` |
| `gate4_handover` | Exclusive Gateway | Checks `handoverApproved == true` |
| `phase5_operations` | Call Activity | Calls `operations-phase` |
| `end_lifecycle` | End Event | Building decommissioned or lifecycle complete |

### Variable Passing

**Process-level variables** (set at start, passed In to all Call Activities):

| Variable | Type | Source | Description |
|----------|------|--------|-------------|
| `projectId` | String | Start message | Doorman project identifier |
| `buildingId` | Integer | Start message | `object_instances.id` for building |
| `currentPhase` | String | Updated by phase gates | Current lifecycle phase |
| `ownerGroupId` | String | Start message | Owner's user group for approvals |

**Call Activity In/Out mapping** pattern:

```xml
<bpmn:callActivity id="phase2_design" calledElement="design-phase">
  <bpmn:extensionElements>
    <camunda:in source="projectId" target="projectId" />
    <camunda:in source="buildingId" target="buildingId" />
    <camunda:in source="currentPhase" target="currentPhase" />
    <camunda:out source="designApproved" target="designApproved" />
    <camunda:out source="designCompletionDate" target="designCompletionDate" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

### Phase Gate Pattern

Each phase gate is an exclusive gateway that checks approval status:

```xml
<bpmn:exclusiveGateway id="gate1_investigation" name="Investigation Approved?">
  <bpmn:incoming>flow_from_phase1</bpmn:incoming>
  <bpmn:outgoing>flow_approved</bpmn:outgoing>
  <bpmn:outgoing>flow_rejected</bpmn:outgoing>
</bpmn:exclusiveGateway>

<bpmn:sequenceFlow id="flow_approved" sourceRef="gate1_investigation" targetRef="phase2_design">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">
    ${investigationApproved == true}
  </bpmn:conditionExpression>
</bpmn:sequenceFlow>

<bpmn:sequenceFlow id="flow_rejected" sourceRef="gate1_investigation" targetRef="phase1_investigation">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">
    ${investigationApproved == false}
  </bpmn:conditionExpression>
</bpmn:sequenceFlow>
```

**Phase gate approval criteria** (checked by Doorman validation API):

| Gate | Required Conditions |
|------|-------------------|
| Gate 1 (Investigation) | Space program complete, budget estimate approved |
| Gate 2 (Design) | All discipline designs approved, coordination conflicts resolved |
| Gate 3 (Production) | Commissioning protocols signed, OVK inspection passed |
| Gate 4 (Handover) | AIM data validated, FM team trained, documentation complete |

---

## 3. Phase 2: Design Phase (Parallel Disciplines)

The design phase is the most complex, with 8 parallel discipline tracks:

### Process ID: `design-phase`

```
start --> parallel_fork --> [8 discipline Call Activities] --> parallel_join --> coordination --> approval --> end
```

| Call Activity ID | Called Process | Candidate Groups | Object Types |
|-----------------|---------------|-----------------|--------------|
| `ca_design_arch` | `design-architecture` | `designers_architect` | Rum, Tilltradeobjekt, Golv, Yttervagg |
| `ca_design_fire` | `design-fire-safety` | `designers_fire` | Brand- o sakerhetsfunktion, Brandskyddsdokumentation |
| `ca_design_door` | `design-door-process` | `designers_door`, `designers_architect` | ID tilltradeobjekt, Laskista |
| `ca_design_access` | `design-access-security` | `designers_security`, `security_admin` | Passagekontroll, Nyckelgrupp |
| `ca_design_elec` | `design-electrical` | `designers_electrical` | Elcentral, El belysning, Elkraft |
| `ca_design_hvac` | `design-hvac` | `designers_hvac` | Luftbehandlingssystem, Injusteringsventil |
| `ca_design_sprinkler` | `design-sprinkler` | `designers_sprinkler` | Sprinkler |
| `ca_design_transport` | `design-transport` | `designers_transport` | HissID |

**Per-discipline Call Activity variable mapping**:

```xml
<bpmn:callActivity id="ca_design_door" calledElement="design-door-process">
  <bpmn:extensionElements>
    <camunda:in source="projectId" target="projectId" />
    <camunda:in source="buildingId" target="buildingId" />
    <camunda:in businessKey="#{execution.processBusinessKey}" />
    <camunda:out source="disciplineApproved" target="doorDesignApproved" />
  </bpmn:extensionElements>
</bpmn:callActivity>
```

### Design Coordination Task

After all 8 disciplines complete, a coordination task verifies:
- No conflicting attribute values across disciplines
- All cross-references resolved (e.g., door fire rating matches room fire compartment)
- Integration points documented

```xml
<bpmn:userTask id="design_coordination"
               name="Samordning projektering"
               camunda:candidateGroups="project_managers">
  <bpmn:documentation>
    Verify all discipline designs are coordinated. Check for conflicts
    in fire ratings, spatial requirements, and system integration points.
  </bpmn:documentation>
</bpmn:userTask>
```

---

## 4. Phase 3: Production Phase (Parallel Installations)

### Process ID: `production-phase`

```
start --> parallel_fork --> [6 installation tracks] --> parallel_join --> commissioning --> approval --> end
```

| Call Activity ID | Called Process | Candidate Groups | Description |
|-----------------|---------------|-----------------|-------------|
| `ca_prod_doors` | `production-doors` | `contractors`, `locksmiths` | Door installation + hardware |
| `ca_prod_hvac` | `production-hvac` | `contractors`, `hvac_installers` | HVAC install + balance |
| `ca_prod_elec` | `production-electrical` | `contractors`, `electricians` | Electrical install + test |
| `ca_prod_fire` | `production-fire-systems` | `contractors`, `fire_installers` | Fire alarm + sprinkler |
| `ca_prod_access` | `production-access-control` | `contractors`, `security_admin` | Access control install |
| `ca_prod_transport` | `production-transport` | `contractors` | Elevator install |

### Commissioning Task

After all installations, a comprehensive commissioning task runs:

```xml
<bpmn:userTask id="production_commissioning"
               name="Samordnad funktionsprovning"
               camunda:candidateGroups="project_managers,contractors">
  <bpmn:documentation>
    Coordinated functional testing (SFP). Verify all systems work together.
    Maps to Samrum module 104: "Samordnade funktionsprover".
  </bpmn:documentation>
</bpmn:userTask>
```

---

## 5. Boundary Events

### Timer Boundary Events

Each Call Activity has a timer boundary for phase timeout escalation:

```xml
<bpmn:boundaryEvent id="timer_design_phase" attachedToRef="phase2_design" cancelActivity="false">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>P180D</bpmn:timeDuration>  <!-- 180 days -->
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>flow_to_escalation</bpmn:outgoing>
</bpmn:boundaryEvent>
```

### Error Boundary Events

Critical failures escalate to project management:

```xml
<bpmn:boundaryEvent id="error_production" attachedToRef="phase3_production">
  <bpmn:errorEventDefinition errorRef="err_critical_failure" />
  <bpmn:outgoing>flow_to_incident</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

## 6. Process-to-Module Mapping Summary

Each Call Activity maps to one or more Samrum module families:

| Call Activity | Primary Samrum Modules | Module IDs |
|--------------|----------------------|------------|
| `investigation-space-program` | 1.00-1.04 Programprocessen | 94, 69, 71, 92 |
| `design-architecture` | 3.11 Utokad rum, 2.01 Lankn rum | 73, 67, 102 |
| `design-fire-safety` | 3.21-3.22 Brandskydd | 79, 99 |
| `design-door-process` | 3.31-3.36 Dorrar | 32, 63, 64, 107, 108 |
| `design-access-security` | 3.41-3.42 Passage/Sakerhet | 83, 82, 98 |
| `design-electrical` | 3.51 Elcentraler, Beskr El | 90, 76, 110 |
| `design-hvac` | 3.6x Ror, Ventilation, Styr | 75, 84, 74 |
| `design-sprinkler` | 3.7 Sprinkler | 80 |
| `design-transport` | 3.81 Hissar | 88 |
| `production-doors` | 4.xx Leveransplanering dorrar | 65, 112, 113 |
| `production-hvac` | 4.6xx Injustering, leverans | 77, 78, 100, 101 |
| `production-electrical` | (install + test modules) | 109 |
| `production-commissioning` | 3.09 Samordnade funktionsprover | 104 |
| `operations-maintenance` | Door maintenance, revisioner | 89, door-maintenance.bpmn |

---

## 7. Lifecycle Phase Transition Service Tasks

Each phase gate includes a service task that updates `object_instances.lifecycle_phase`:

```xml
<bpmn:serviceTask id="update_phase_to_design"
                  name="Update lifecycle to Design"
                  camunda:delegateExpression="${lifecycleTransitionDelegate}">
  <bpmn:extensionElements>
    <camunda:field name="targetPhase" stringValue="design" />
    <camunda:field name="buildingId" expression="${buildingId}" />
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

The delegate calls Doorman's REST API:

```
POST /api/objects/:buildingId/lifecycle
{
  "targetPhase": "design",
  "cascade": true,  // update all child instances
  "userId": "${currentUser}"
}
```

This updates `lifecycle_phase` on the building instance and optionally cascades to all child object instances, while writing to `audit_log`.
