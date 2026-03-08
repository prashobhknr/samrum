# 05 - Module-to-Process Mapping

> Maps the 271 Samrum modules to BPMN subprocesses, showing how each module
> becomes a data entry interface for specific Camunda user tasks.

---

## 1. Mapping Principle

Each Samrum module represents a **view** of object data for a specific discipline
and activity. In the BPMN-driven architecture:

- **Module** = Data entry form for a Camunda user task
- **Module columns** = Attributes visible/editable in that task
- **Subprocess** = The BPMN process that orchestrates when this module is used

```
Samrum Module  -->  maps to  -->  BPMN User Task  -->  in Subprocess
  (data view)                     (work item)           (workflow)
```

---

## 2. Investigation Phase Modules

| Module Family | Module IDs | Subprocess | User Task | Candidate Groups |
|--------------|-----------|------------|-----------|-----------------|
| 1.00 Programprocessen | 94 | `investigation-phase` | `develop_space_program` | `project_managers`, `designers_architect` |
| 1.01 Lokalbenamning | 69 | `investigation-phase` | `develop_space_program` | `project_managers` |
| 1.02 Lankn rum | 71 | `investigation-phase` | `occupant_review_space` | `occupants`, `facility_managers` |
| 1.03 Lokalbenamningsstatistik | 92 | `investigation-phase` | `budget_estimate` | `project_managers`, `finance` |

---

## 3. Design Phase Modules by Discipline

### Architecture (design-architecture / design-phase)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 2.01 Lankn rum | 67 | `room_design` | Room linking and adjacencies |
| 3.11 Utokad rumsbeskrivning | 73 | `detailed_room_spec` | Extended room specification |
| 3.12 Golv | 102 | `floor_specification` | Floor material and finish |
| 3.13 Innervagg/Innertak | (new) | `interior_surfaces` | Wall and ceiling finishes |

### Fire Safety (fire-safety)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.21 Brandskydd rumsredovisat | 79 | `define_fire_compartments` | Fire class per room |
| 3.22 Brand- o sakerhetsfunktioner | 99 | `specify_fire_functions` | Fire functions per room |
| 3.52 Brandlarm | 81 | `design_fire_alarm` | Fire alarm system |
| Brandskyddsdokumentation | 789 | `fire_safety_documentation` | Fire safety documentation |

### Door/Passage (design-door-process)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.31 Tilltradeobjekt arkitekt | 32 | `architect_door_design` | Door architectural spec |
| 3.32 Funktionsprogrammering | 63 | `define_door_requirements` | Door functional requirements |
| 3.33 Tilltradeobjekt teknik | 64 | `technical_specification` | Lock and hardware spec |
| 3.34 Kanalisation El | 108 | `electrical_conduit` | Electrical conduit to door |
| 3.35 Passagekontroll | 83 | `access_control_design` | Access control at door |
| 3.36 Gransdragningslista | 107 | `boundary_list` | Discipline boundaries |
| Dokumentation tilltradeobjekt | 112 | `document_door` | Door documentation |

### Access Control / Security (access-control)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.41 Passagekontroll | 83 | `define_access_zones` | Access zones and levels |
| 3.42 Sakerhet | 82 | `specify_readers` | Reader and integration spec |
| Nyckelgrupp | 66 | `define_key_groups` | Key group management |

### Electrical (electrical)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.51 Elcentraler | 90 | `specify_panels` | Panel specification |
| Beskrivning El | 76 | `design_power_distribution` | Power distribution design |
| El belysning | 110 | `design_lighting` | Lighting design |
| Tele-styr gemensamma | 103 | `telecom_integration` | Telecom/controls coordination |

### HVAC (hvac)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.61 Beskrivning Ror | 75 | `design_piping` | Piping system design |
| 3.62 Ventilation | 84 | `design_ventilation` | Ventilation system design |
| 3.63 Kylmaskiner | (id) | `design_cooling` | Cooling system design |
| 3.66 Klimatberakning | 74 | `climate_calculation` | Climate calculation |
| Styrprojektering | 84 | `design_controls` | Building automation design |

### Sprinkler (design-sprinkler)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.71 Sprinkler | 80 | `design_sprinkler_system` | Sprinkler system design |

### Transport / Elevators (design-transport)

| Module | ID | User Task | Description |
|--------|-----|-----------|-------------|
| 3.81 Hissar | 88 | `design_elevator` | Elevator specification |

---

## 4. Production Phase Modules

| Module | ID | Subprocess | User Task | Description |
|--------|-----|-----------|-----------|-------------|
| Leveransplanering dorrar | 65 | `design-door-process` | `delivery_planning` | Door delivery schedule |
| Injustering Ror | 77 | `hvac` | `balance_systems` | Pipe balancing |
| Injustering Luft | 78 | `hvac` | `balance_systems` | Air balancing |
| Ventilation leveransdata | 100 | `hvac` | `record_delivery_data` | Ventilation delivery data |
| Ror leveransdata | 101 | `hvac` | `record_delivery_data` | Piping delivery data |
| El-leveransdata | 109 | `electrical` | `test_electrical` | Electrical test data |
| Leveransobjekt dorrar | 113 | `design-door-process` | `install_door` | Door installation data |
| Samordnade funktionsprover | 104 | `production-phase` | `coordinated_testing` | SFP results |

---

## 5. Operations Phase Modules

| Module | ID | Subprocess | User Task | Description |
|--------|-----|-----------|-----------|-------------|
| Door Maintenance | 89 | `maintenance-cycle` | `inspect_object` | Door condition inspection |
| Revisioner | (id) | `maintenance-cycle` | `perform_repair` | Repair records |
| Nyckelgrupp (ops) | 66 | `operations-access-management` | `manage_key_groups` | Key group updates |

---

## 6. Module Activation by Lifecycle Phase

Not all modules are active in all phases. The lifecycle phase controls which modules appear in the UI:

| Lifecycle Phase | Active Module Families | Module Count (approx) |
|----------------|----------------------|----------------------|
| `investigation` | 1.xx (Program) | ~10 |
| `pre_study` | 1.xx + early 2.xx | ~15 |
| `design` | 2.xx + 3.xx (all design) | ~80 |
| `procurement` | Admin/contract modules | ~15 |
| `production` | 4.xx (delivery/install) + 3.xx (reference) | ~50 |
| `handover` | Documentation + commissioning | ~20 |
| `operations` | Maintenance + access + inspection | ~40 |
| `decommission` | Disposal + archive | ~5 |

---

## 7. How Modules Connect to Camunda Tasks

### Task Activation Flow

```
1. Camunda activates user task "architect_door_design"
   → candidateGroups: "designers_architect"

2. Doorman task worker polls Camunda for active tasks
   → GET /engine-rest/task?candidateGroup=designers_architect

3. Task worker portal shows task with link to module view
   → /modules/32 (Tilltradeobjekt arkitekt)
   → DynamicForm filtered by task_permission_rules for this task

4. Designer completes form in module view
   → POST /api/objects/:instanceId/attributes
   → attribute_values saved with value_qualifier='TARGET'

5. Designer marks task complete
   → POST /engine-rest/task/:taskId/complete
   → Camunda advances to next task in subprocess
```

### Permission Filtering

```sql
-- For task "architect_door_design" and group "designers_architect"
SELECT a.id, a.attr_name, tpr.visible, tpr.editable, tpr.required
FROM object_attributes a
JOIN task_permission_rules tpr ON tpr.attribute_id = a.id
WHERE tpr.process_definition_key = 'design-door-process'
  AND tpr.task_name = 'architect_door_design'
  AND tpr.user_group_id = 'designers_architect';
```

This ensures each user sees only the attributes relevant to their current task,
even though the module may have 60+ attributes defined.
