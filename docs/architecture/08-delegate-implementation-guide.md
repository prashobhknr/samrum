# 08 - Delegate Implementation Guide

> Specification for all Camunda 7 Java/JavaScript delegates referenced by
> service tasks across the 30 BPMN processes. Each delegate integrates with
> the Doorman OMS API.

---

## 1. Delegate Inventory

### 1.1 Core Lifecycle Delegates

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${projectInitDelegate}` | master | 1 | P0 |
| `${lifecycleTransitionDelegate}` | master | 7 | P0 |
| `${escalationDelegate}` | master | 6 | P1 |

### 1.2 Validation Delegates

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${validationDelegate}` | 8 discipline subs | 8 | P1 |
| `${doorValidationDelegate}` | door-process | 1 | P1 |
| `${designValidationDelegate}` | design-phase | 1 | P1 |

### 1.3 Audit Delegate

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${auditWriteDelegate}` | All processes | 20+ | P0 |

### 1.4 Phase-Specific Delegates

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${reportCompileDelegate}` | investigation, pre-study | 2 | P2 |
| `${tenderPublishDelegate}` | procurement | 1 | P2 |
| `${bidRegistrationDelegate}` | procurement | 1 | P2 |
| `${contractorOnboardDelegate}` | procurement | 1 | P2 |
| `${aimPopulationDelegate}` | handover | 1 | P1 |
| `${warrantyActivationDelegate}` | handover | 1 | P2 |
| `${notificationDelegate}` | procurement, emergency, various | 3+ | P1 |

### 1.5 Operations Delegates

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${maintenanceQueryDelegate}` | maintenance-cycle | 1 | P1 |
| `${maintenanceDateDelegate}` | maintenance-cycle | 1 | P2 |
| `${inspectionQueryDelegate}` | inspections | 1 | P2 |
| `${energyDataCollectionDelegate}` | energy-management | 1 | P2 |
| `${accessProvisionDelegate}` | access-management | 1 | P1 |
| `${archiveDelegate}` | decommission | 1 | P3 |

### 1.6 New Delegates (Iterations 5-7)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${projectInitiationDelegate}` | change-management | 1 | P2 |
| `${doormanAttributeUpdateDelegate}` | renovation mini-project | 1 | P1 |
| `${renovationAuditDelegate}` | renovation mini-project | 1 | P2 |

### 1.7 Portfolio Delegates (Iteration 14)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${buildingInstanceDelegate}` | building-portfolio | 1 | P1 |
| `${processSpawnDelegate}` | building-portfolio | 1 | P1 |
| `${bulkMaintenanceDelegate}` | building-portfolio | 1 | P2 |
| `${portfolioReportDelegate}` | building-portfolio | 1 | P2 |
| `${portfolioBenchmarkDelegate}` | building-portfolio | 1 | P2 |

### 1.8 Contractor Scheduling Delegates (Iteration 14)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${cpmScheduleDelegate}` | contractor-scheduling | 2 | P2 |
| `${resourceMonitorDelegate}` | contractor-scheduling | 1 | P2 |
| `${delayDetectionDelegate}` | contractor-scheduling | 1 | P2 |

### 1.9 Indoor Climate Delegates (Iteration 14)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${climateDataCollectionDelegate}` | indoor-climate | 2 | P2 |
| `${climateAnalysisDelegate}` | indoor-climate | 1 | P2 |
| `${climateReportDelegate}` | indoor-climate | 1 | P2 |

### 1.10 Budget & Insurance Delegates (Iteration 15)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${costAnalysisDelegate}` | budget-overrun-handling | 1 | P2 |
| `${budgetUpdateDelegate}` | budget-overrun-handling | 1 | P2 |
| `${insuranceSubmitDelegate}` | insurance-claim | 1 | P3 |
| `${surveyCollectionDelegate}` | post-occupancy-evaluation | 1 | P3 |
| `${performanceDataDelegate}` | post-occupancy-evaluation | 1 | P3 |

### 1.11 BIM/IFC Delegates (Iteration 14)

| Delegate Expression | Used In | Count | Priority |
|--------------------|---------|-------|----------|
| `${ifcImportDelegate}` | bim-coordination | 1 | P2 |
| `${ifcParseDelegate}` | bim-coordination | 1 | P2 |
| `${bimValidationDelegate}` | bim-coordination | 1 | P2 |
| `${clashDetectionDelegate}` | bim-coordination | 1 | P2 |
| `${bimSyncDelegate}` | bim-coordination | 3 | P1 |

---

## 2. Delegate Specifications

### 2.1 `projectInitDelegate`

**Purpose**: Initialize a new building project in Doorman OMS.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingId` | Long | Message payload |
| `ownerGroupId` | Long | Message payload |

**Actions**:
1. Create `object_instance` for the building (if not exists)
2. Set initial `attribute_values` (project name, start date, owner)
3. Set `lifecycle_phase = 'investigation'`
4. Create `audit_log` entry

**Output Variables**:
| Variable | Type |
|----------|------|
| `projectId` | Long |

---

### 2.2 `lifecycleTransitionDelegate`

**Purpose**: Transition the building's PLCS lifecycle phase.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `targetPhase` | String | Field injection (e.g., "pre_study", "design") |
| `buildingId` | Long | Process variable |

**Actions**:
1. Update `attribute_values` where `attribute.sys_name = 'lifecycle_phase'`
2. Set `value_qualifier` based on phase (TARGET → DESIGNED → REALIZED → MEASURED)
3. Record timestamp in `attribute_values` for `phase_transition_date`
4. Create `audit_log` entry with old and new phase

**PLCS State Mapping**:
| targetPhase | PLCS State | value_qualifier |
|-------------|-----------|-----------------|
| investigation | AS_REQUIRED | TARGET |
| pre_study | AS_REQUIRED | TARGET |
| design | AS_DESIGNED | CALCULATED |
| procurement | AS_DESIGNED | CALCULATED |
| production | AS_REALIZED | MEASURED |
| handover | AS_IS | MEASURED |
| operations | AS_IS | MEASURED |
| decommission | AS_REMOVED | MEASURED |

---

### 2.3 `auditWriteDelegate`

**Purpose**: Write an immutable audit log entry for the current process step.

**Input Variables** (auto-captured from execution context):
| Variable | Type | Source |
|----------|------|--------|
| `buildingId` | Long | Process variable |
| `projectId` | Long | Process variable |

**Actions**:
1. Capture current task ID, process definition, assignee/candidate group
2. Capture all changed `attribute_values` since last audit entry
3. Write to `audit_log` table:
   ```sql
   INSERT INTO audit_log (
     object_instance_id, user_id, action, old_value, new_value,
     changed_at, process_instance_id, task_id
   ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
   ```
4. Include process variables snapshot for traceability

---

### 2.4 `escalationDelegate`

**Purpose**: Send escalation notification when a phase timer fires.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `phaseName` | String | Field injection |
| `escalationLevel` | String | Field injection (default "1") |
| `buildingId` | Long | Process variable |
| `ownerGroupId` | Long | Process variable |

**Actions**:
1. Query `permissions` table for users in `owners` and `project_managers` groups
2. Send notification (email/in-app) with phase name, elapsed time, deadline
3. If escalationLevel > 1, also notify `facility_managers`
4. Create `audit_log` entry for the escalation

---

### 2.5 `validationDelegate`

**Purpose**: Validate design completeness for a discipline subprocess.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingId` | Long | Process variable |
| `projectId` | Long | Process variable |

**Actions**:
1. Query all `attribute_values` for the building's object instances of the relevant type
2. Check required attributes have non-null values
3. Check attribute values pass `attribute_validators` rules
4. Return validation result

**Output Variables**:
| Variable | Type |
|----------|------|
| `disciplineApproved` | Boolean |
| `validationErrors` | List<String> |

---

### 2.6 `designValidationDelegate`

**Purpose**: Validate cross-discipline design completeness after all disciplines.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `validationType` | String | Field injection ("design_completeness") |
| `buildingId` | Long | Process variable |

**Actions**:
1. For each discipline, verify `disciplineApproved == true` output variable
2. Run cross-discipline consistency checks:
   - Fire class on doors matches fire safety compartment assignments
   - Access reader locations match door inventory
   - HVAC damper locations match fire compartment boundaries
3. Optional: BIM clash detection integration point

**Output Variables**:
| Variable | Type |
|----------|------|
| `validationPassed` | Boolean |
| `clashReport` | String (JSON) |

---

### 2.7 `aimPopulationDelegate`

**Purpose**: Transfer Project Information Model (PIM) data to Asset Information Model (AIM) per ISO 19650.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingId` | Long | Process variable |
| `projectId` | Long | Process variable |

**Actions**:
1. For all object instances linked to building:
   - Copy `attribute_values` from design/production qualifiers to operational qualifier
   - Update `value_qualifier` from CALCULATED/TARGET to MEASURED
2. Verify all mandatory AIM attributes are populated
3. Generate AIM completeness report

**Output Variables**:
| Variable | Type |
|----------|------|
| `aimValidated` | Boolean |
| `aimCompletenessScore` | Double (0.0-1.0) |

---

### 2.8 `accessProvisionDelegate`

**Purpose**: Provision access cards/credentials in the access control system.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingId` | Long | Process variable |

**Actions**:
1. Read approved access request details from process variables
2. Create/update access credential in external access control system (API call)
3. Update Doorman `attribute_values` for the access object instance
4. Set key group membership

---

### 2.9 `energyDataCollectionDelegate`

**Purpose**: Collect energy consumption data from building management system.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `dataPoints` | String | Field injection ("electricity,heating,cooling,water") |
| `buildingId` | Long | Process variable |

**Actions**:
1. Query BMS/energy metering API for consumption data
2. Store readings as `attribute_values` with `value_qualifier = 'MEASURED'`
3. Calculate kWh/m2 and degree-day normalized values

---

### 2.10 `buildingInstanceDelegate`

**Purpose**: Create or look up a building object instance in Doorman OMS when registering a new building in the portfolio.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingName` | String | User task form |
| `buildingAddress` | String | User task form |
| `buildingType` | String | User task form (residential/commercial/mixed) |

**Actions**:
1. Create `object_instance` of type Building
2. Set initial `attribute_values` (name, address, type, registration date)
3. Set `lifecycle_phase = 'pre_portfolio'`
4. Return building instance ID for downstream process spawning

**Output Variables**:
| Variable | Type |
|----------|------|
| `buildingInstanceId` | Long |

---

### 2.11 `processSpawnDelegate`

**Purpose**: Spawn a new `master-building-lifecycle` process instance for a registered building, or an `operations-phase` for existing buildings entering bulk maintenance.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `buildingInstanceId` | Long | Process variable |
| `spawnType` | String | Field injection ("lifecycle" or "operations") |

**Actions**:
1. Start a new process instance via Camunda RuntimeService
2. Pass `buildingId`, `ownerGroupId`, and portfolio context as variables
3. Record the spawned process instance ID for portfolio tracking

**Output Variables**:
| Variable | Type |
|----------|------|
| `spawnedProcessInstanceId` | String |

---

### 2.12 `bulkMaintenanceDelegate`

**Purpose**: Create bulk maintenance campaigns across multiple buildings in the portfolio.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `campaignType` | String | User task form (e.g., "fire_safety_audit", "elevator_inspection") |
| `buildingIds` | List<Long> | User task form (selected buildings) |

**Actions**:
1. For each selected building, spawn a maintenance-cycle subprocess
2. Group maintenance tasks by geographic zone for contractor efficiency
3. Generate campaign tracking record

---

### 2.13 `portfolioReportDelegate`

**Purpose**: Compile portfolio-wide KPI report across all managed buildings.

**Actions**:
1. Query all active `master-building-lifecycle` process instances
2. For each building, collect phase status, overdue tasks, SLA compliance
3. Aggregate portfolio-level metrics (total area, energy per m², maintenance backlog)
4. Generate report JSON for dashboard rendering

**Output Variables**:
| Variable | Type |
|----------|------|
| `reportJson` | String (JSON) |

---

### 2.14 `portfolioBenchmarkDelegate`

**Purpose**: Benchmark individual building performance against portfolio averages.

**Actions**:
1. Calculate portfolio averages for energy, maintenance cost, occupancy
2. Rank buildings by performance category
3. Flag underperforming buildings for strategic review

**Output Variables**:
| Variable | Type |
|----------|------|
| `benchmarkJson` | String (JSON) |
| `flaggedBuildingIds` | List<Long> |

---

### 2.15 `ifcImportDelegate`

**Purpose**: Import an IFC model file and store it for processing.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `ifcFileUrl` | String | Process variable (upload path or CDE URL) |
| `buildingId` | Long | Process variable |

**Actions**:
1. Download/read the IFC file from the provided URL
2. Store model metadata (version, schema, authoring tool)
3. Extract IFC header information (IfcProject, IfcSite)

**Output Variables**:
| Variable | Type |
|----------|------|
| `ifcModelId` | String |
| `ifcSchema` | String (IFC2x3/IFC4) |

---

### 2.16 `ifcParseDelegate`

**Purpose**: Parse IFC entities into OMS object instances.

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `ifcModelId` | String | Process variable |
| `entityTypes` | String | Field injection (comma-separated: "IfcDoor,IfcSpace,IfcWall") |

**Actions**:
1. Parse specified IFC entity types from the model
2. For each entity, create/match to OMS object instance
3. Extract property sets (Pset_DoorCommon, Pset_SpaceCommon)
4. Map IFC properties to OMS attribute IDs

**Output Variables**:
| Variable | Type |
|----------|------|
| `parsedEntityCount` | Integer |
| `newInstanceCount` | Integer |
| `matchedInstanceCount` | Integer |

---

### 2.17 `bimValidationDelegate`

**Purpose**: Validate model completeness (required entities present, property sets populated).

**Output Variables**:
| Variable | Type |
|----------|------|
| `modelValid` | Boolean |
| `validationIssues` | String (JSON array) |

---

### 2.18 `clashDetectionDelegate`

**Purpose**: Run spatial clash detection between disciplines.

**Actions**:
1. Check for geometric intersections between IfcDoor and IfcWall entities
2. Verify clearance zones around doors
3. Check HVAC duct routing against structural elements
4. Report clash locations with severity

**Output Variables**:
| Variable | Type |
|----------|------|
| `clashCount` | Integer |
| `clashReport` | String (JSON) |

---

### 2.19 `bimSyncDelegate`

**Purpose**: Synchronize IFC entity properties to OMS attribute values. Used 3 times in parallel (doors, rooms, fire safety).

**Input Variables**:
| Variable | Type | Source |
|----------|------|--------|
| `ifcEntity` | String | Field injection (e.g., "IfcDoor") |
| `omsObjectTypeId` | Integer | Field injection |
| `attributeMapping` | String | Field injection (e.g., "width:200,height:205,fire_rating:520") |

**Actions**:
1. For each IFC entity of the specified type:
   - Parse the attribute mapping string
   - Read IFC property value
   - Write to OMS `attribute_values` with `value_qualifier = 'MEASURED'`
2. Track sync statistics (created, updated, skipped)

**Output Variables**:
| Variable | Type |
|----------|------|
| `syncedCount` | Integer |
| `syncErrors` | List<String> |

---

## 3. Integration Pattern

All delegates follow the same integration pattern with Doorman OMS:

```
Camunda Engine
  → Delegate (Java/JS)
    → Doorman REST API (localhost:3000)
      → PostgreSQL (doorman_db)
```

### REST API Endpoints Used by Delegates

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/api/objects/:typeId/instances` | GET, POST | projectInitDelegate, validationDelegate |
| `/api/objects/:typeId/instances/:id/attributes` | GET, PUT | lifecycleTransitionDelegate, aimPopulationDelegate |
| `/api/audit` | POST | auditWriteDelegate |
| `/api/forms/:taskId` | GET | (frontend, not delegates) |
| `/api/permissions/:group` | GET | escalationDelegate |

### Authentication
Delegates authenticate to the Doorman API using a service account token,
configured as a Camunda process application property.

---

## 4. Implementation Priority

| Priority | Delegates | Rationale |
|----------|-----------|-----------|
| **P0** | projectInitDelegate, lifecycleTransitionDelegate, auditWriteDelegate | Required for basic process execution |
| **P1** | validationDelegate, designValidationDelegate, escalationDelegate, notificationDelegate, accessProvisionDelegate, aimPopulationDelegate, maintenanceQueryDelegate, doormanAttributeUpdateDelegate, buildingInstanceDelegate, processSpawnDelegate, bimSyncDelegate | Required for phase completion and key integrations |
| **P2** | reportCompileDelegate, tenderPublishDelegate, bidRegistrationDelegate, contractorOnboardDelegate, warrantyActivationDelegate, maintenanceDateDelegate, inspectionQueryDelegate, energyDataCollectionDelegate, projectInitiationDelegate, renovationAuditDelegate, bulkMaintenanceDelegate, portfolioReportDelegate, portfolioBenchmarkDelegate, ifcImportDelegate, ifcParseDelegate, bimValidationDelegate, clashDetectionDelegate | Nice-to-have, can be stubbed initially |
| **P3** | archiveDelegate | Only needed for decommission phase |

### Stub Implementation Strategy
For initial deployment, all P1+ delegates can be stubbed with a simple implementation:
```java
public class StubDelegate implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    // Log the delegate call for development/testing
    LOGGER.info("STUB: {} called for building {}",
      getClass().getSimpleName(),
      execution.getVariable("buildingId"));
    // Set expected output variables with defaults
    execution.setVariable("disciplineApproved", true);
  }
}
```
