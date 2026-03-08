# 10 - Form-Task Mapping and Camunda Form Keys

> Maps each BPMN user task to its Doorman frontend form, defining how the
> Camunda task worker portal renders dynamic forms using the existing
> FormService and DynamicForm infrastructure.

---

## 1. Integration Architecture

```
Camunda Engine                    Doorman Frontend
  |                                  |
  | Task created with                | Task Worker Portal
  | formKey="doorman:moduleId:typeId"| (/tasks page)
  |                                  |
  | GET /engine-rest/task?assignee=  | Polls for user's tasks
  |                                  |
  | Task claimed by user             | User clicks task
  |                                  |
  | formKey parsed →                 | GET /api/forms/{taskId}
  |   moduleId = Samrum module       |   → FormService.generateFormForTask()
  |   typeId = OMS object type       |   → task_permission_rules
  |                                  |   → permissions (group-level)
  |                                  |   → field_dependencies
  |                                  |   → attribute_validators
  |                                  |
  |                                  | Renders DynamicForm component
  |                                  |   with visible/editable/required fields
  |                                  |
  | Task completed with variables    | POST /api/forms/{taskId}/submit
  |   → attribute_values updated     |   → audit_log written
```

### Form Key Convention
```
doorman:{moduleId}:{objectTypeId}
```
- `moduleId`: Samrum module ID (from `samrum_modules` table, 1-271)
- `objectTypeId`: OMS object type ID (from `object_types` table)
- Special: `doorman:generic:{objectTypeId}` for tasks without a specific module view

---

## 2. Phase Task → Form Mappings

### 2.1 Investigation Phase

| Task ID | Task Name | Form Key | Module | Notes |
|---------|-----------|----------|--------|-------|
| `review_space_program` | Granska rumsprogram | `doorman:47:9` | Rum (module 47) | Room type instances |
| `risk_assessment` | Riskanalys | `doorman:generic:1` | Generic | Free-form risk assessment |
| `regulatory_precheck` | Myndighetskontroll | `doorman:generic:1` | Generic | Checklist form |
| `budget_estimate` | Budgetuppskattning | `doorman:generic:1` | Generic | Cost fields |
| `compile_report` | Sammanstall utredning | (service task) | - | Automated |
| `owner_approval` | Bestallarens godkannande | `doorman:generic:1` | Generic | Approve/reject |

### 2.2 Design Phase

| Task ID | Task Name | Form Key | Module | Notes |
|---------|-----------|----------|--------|-------|
| `system_design` | Systemhandling | `doorman:generic:1` | Generic | System design overview |
| `baseline_review` | Granskningsmote Fas A | `doorman:generic:1` | Generic | Review checklist |
| `design_coordination` | Samordning projektering | `doorman:generic:1` | Generic | Clash detection review |
| `energy_calculation` | Energiberakning | `doorman:generic:1` | Generic | Energy calculation |
| `approve_design` | Godkann projektering | `doorman:generic:1` | Generic | Final design approval |

### 2.3 Discipline Subprocess Forms

| Discipline | Design Task | Form Key | Production Task | Form Key |
|-----------|------------|----------|----------------|----------|
| Architecture | Room layout, facade, interior | `doorman:47:9` | - | - |
| Structural | Foundation, frame, openings | `doorman:generic:1` | Shell/frame | `doorman:generic:1` |
| Fire Safety | Compartments, classification | `doorman:142:6` | Fire system install | `doorman:142:6` |
| Door/Passage | Door specification | `doorman:1:6` | Door installation | `doorman:1:6` |
| Access Control | Reader placement, key groups | `doorman:103:6` | Access install | `doorman:103:6` |
| Electrical | Power, lighting, fire alarm | `doorman:generic:1` | Electrical install | `doorman:generic:1` |
| HVAC | Duct, pipe, equipment | `doorman:generic:1` | HVAC install | `doorman:generic:1` |
| Sprinkler | Hazard class, system design | `doorman:generic:1` | - | - |
| Transport | Elevator spec, shaft coord | `doorman:generic:1` | Elevator install | `doorman:generic:1` |
| Plumbing | Supply, drainage | `doorman:generic:1` | Plumbing install | `doorman:generic:1` |

### 2.4 Production Phase

| Task ID | Task Name | Form Key | Notes |
|---------|-----------|----------|-------|
| `preconstruction_meeting` | Byggstartsmote | `doorman:generic:1` | Meeting protocol |
| `technical_startup` | Teknisk byggstart | `doorman:generic:1` | Checklist |
| `coordinated_testing` | SFP | `doorman:104:1` | Module 104 = SFP |
| `ovk_inspection` | OVK-besiktning | `doorman:generic:1` | OVK protocol |
| `final_inspection` | Slutbesiktning | `doorman:generic:1` | Inspection protocol |
| `remediate_defects` | Avhjalpa anmarkningar | `doorman:generic:1` | Defect list |
| `asbuilt_documentation` | Relationshandlingar | `doorman:generic:1` | Document checklist |

### 2.5 Operations Phase

| Task ID | Process | Form Key | Notes |
|---------|---------|----------|-------|
| `report_defect` | warranty | `doorman:generic:6` | Defect on door/object |
| `contractor_assessment` | warranty | `doorman:generic:6` | Assessment form |
| `new_access_request` | access-mgmt | `doorman:103:6` | Access card request |
| `approve_access` | access-mgmt | `doorman:103:6` | Security approval |
| `modify_access` | access-mgmt | `doorman:103:6` | Modify key groups |
| `energy_analysis` | energy-mgmt | `doorman:generic:1` | Energy analysis |
| `identify_measures` | energy-mgmt | `doorman:generic:1` | Efficiency measures |

---

## 3. Form Key → FormService Integration

When the Doorman task worker portal receives a task with a form key:

```typescript
// Parse formKey
const [prefix, moduleId, typeId] = task.formKey.split(':');

if (prefix === 'doorman') {
  if (moduleId === 'generic') {
    // Generic form: use object type attributes directly
    const form = await formService.generateFormForTask(
      task.id, null, userGroup, parseInt(typeId)
    );
  } else {
    // Module-specific form: use module_view_columns for field selection
    const form = await formService.generateFormForModule(
      task.id, parseInt(moduleId), parseInt(typeId), userGroup
    );
  }
}
```

### Module-Aware Form Generation

For module-specific forms, the `FormService` should:
1. Query `module_view_columns` for the module to get column definitions
2. Map columns to `object_attributes` via `oms_attribute_id`
3. Apply `task_permission_rules` for visible/editable/required
4. Apply `permissions` for READ/WRITE grants
5. Apply `field_dependencies` for conditional show/hide
6. Apply `attribute_validators` for validation rules

This ensures each Samrum module (of the 271) renders its specific column set
when a user works on a Camunda task.

---

## 4. Task Permission Rules by Phase

### Visibility Progression Through Lifecycle

| Attribute Category | Investigation | Design | Production | Operations |
|-------------------|--------------|--------|------------|-----------|
| Location/Space | READ | READ | READ | READ |
| Dimensions | - | WRITE | READ | READ |
| Fire class | - | WRITE | READ | READ |
| Lock type | - | WRITE | WRITE | READ |
| Access groups | - | WRITE | WRITE | WRITE |
| Maintenance date | - | - | - | WRITE |
| Measured values | - | - | WRITE | WRITE |
| Installation date | - | - | WRITE | READ |
| Warranty status | - | - | - | WRITE |

This progression maps to `task_permission_rules.editable` per task and
`attribute_values.value_qualifier` changes (TARGET → CALCULATED → MEASURED).

---

## 5. Candidate Group → Module Permission Matrix

| Candidate Group | Typical Modules | Permission Level |
|----------------|-----------------|-----------------|
| `project_managers` | All modules | READ all, WRITE project metadata |
| `designers_architect` | 47 (Rum), 1 (Door) | READ/WRITE design attributes |
| `designers_fire` | 142 (Fire), 6 (Access obj) | READ/WRITE fire attributes |
| `security_admin` | 103 (Access), 6 (Access obj) | READ/WRITE access attributes |
| `contractors` | 1 (Door), 104 (SFP) | READ design, WRITE installation |
| `facility_managers` | All operational modules | READ/WRITE operational attributes |
| `maintenance` | All modules | READ all, WRITE maintenance dates |
| `owners` | All modules | READ all, WRITE approval fields |
