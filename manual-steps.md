# Doorman — Manual Testing Guide

## 1. Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 18+ | Backend + Frontend |
| PostgreSQL | 14 | Native install or Docker |
| Java JRE | 17+ | Operaton (Camunda 7 fork) |

Database connection: `postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db`

---

## 2. Starting the Application

### 2.1 Start PostgreSQL

```powershell
# Windows service
net start postgresql-x64-14

# Verify
psql -U doorman_user -d doorman_db -c "SELECT 1"
```

### 2.2 Start Operaton (BPMN engine)

```powershell
cd camunda-bpm-run
cmd /c "internal\run.bat start"
# Wait ~30 seconds for startup

# Verify (should return engine info)
Invoke-RestMethod http://localhost:8080/engine-rest/engine
```

Operaton Web UI: http://localhost:8080 (login: `demo` / `demo`)

### 2.3 Start Backend (port 3000)

```powershell
cd backend
node demo-server.mjs
```

Expected output:
- `✓ Connected to PostgreSQL`
- `[Deploy] ...` BPMN deployment messages
- `[Worker] Polling for external tasks...`

```powershell
# Verify
Invoke-RestMethod http://localhost:3000/health
# → { status: "ok", database: "connected" }
```

### 2.4 Start Frontend (port 3001)

```powershell
cd frontend
npm run dev
```

Open http://localhost:3001 in a browser.

---

## 3. Test Scenarios

### 3.1 Authentication

**Login**
```
URL:     http://localhost:3001/login
Creds:   admin / password123
```

**API equivalent:**
```powershell
$body = '{"username":"admin","password":"password123"}'
Invoke-RestMethod -Uri http://localhost:3000/api/login -Method POST `
  -ContentType "application/json" -Body $body
```
**Verify:** Response contains `success: true` with user `id`, `username`, `email`, `groups`.

---

### 3.2 OMS Objects (Phase 1)

#### 3.2.1 List Object Types
```powershell
Invoke-RestMethod http://localhost:3000/api/objects/types | Format-Table id, type_name
```
**Verify:** Returns 84+ Samrum object types (Door, Lock, Door Frame, etc.)

**Frontend:** http://localhost:3001/admin/object-types

#### 3.2.2 List Object Instances
```powershell
Invoke-RestMethod http://localhost:3000/api/objects/instances | Select-Object -First 5
```
**Verify:** Returns instances with `id`, `object_type_id`, `external_id`, `name`, `is_active`.

**Frontend:** http://localhost:3001/admin/modules/269

#### 3.2.3 Get Instance Details
```powershell
Invoke-RestMethod "http://localhost:3000/api/objects/instances/1"
```
**Verify:** Returns instance with all attribute values.

**Frontend:** http://localhost:3001/objects/12?module=269

#### 3.2.4 Create New Object Instance
```powershell
$body = '{"objectTypeId":1,"externalId":"TEST-001","name":"Test Door","isActive":true,"attributes":{}}'
Invoke-RestMethod -Uri http://localhost:3000/api/objects/instances -Method POST `
  -ContentType "application/json" -Body $body
```
**Verify:** Returns new instance with generated `id`.

**Frontend:** http://localhost:3001/objects/new?module=269

#### 3.2.5 Lock/Unlock Object (A010)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/objects/instances/12/lock" -Method PATCH `
  -ContentType "application/json" -Body '{"is_locked":true}'
```
**Verify:** Returns updated instance with `is_locked: true`. UI shows amber "Låst version" badge.

**Frontend:** Click lock icon on http://localhost:3001/objects/12?module=269

#### 3.2.6 Copy Object
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/objects/instances/12/copy" -Method POST
```
**Verify:** Returns new instance with "-kopia" suffix on name. All attribute values duplicated.

#### 3.2.7 Get Statistics
```powershell
Invoke-RestMethod http://localhost:3000/api/stats
```
**Verify:** Returns counts for `objectTypes`, `instances`, `attributes`, `relationships`.

---

### 3.3 Admin UI (Samrum Feature Parity)

All admin pages require login first.

| Use Case | Frontend URL | What to Verify |
|----------|-------------|----------------|
| Select project | http://localhost:3001/select-project | Project list renders, select navigates to project view |
| Project view | http://localhost:3001/project/1 | Module tree + object list |
| Module list (user) | http://localhost:3001/modules/269 | DataGrid with door data, column selector, filters |
| Module list (admin) | http://localhost:3001/admin/modules/269 | Same + Importera/Exportera/Utskrifter toolbar |
| Object detail | http://localhost:3001/objects/12?module=269 | Swedish labels, EJ ANGIVET in red, related sub-sections |
| Create object (A001) | http://localhost:3001/objects/new?module=269 | Form with all module fields, Aktivt toggle |
| Bulk edit (A001) | http://localhost:3001/objects/bulk-edit?module=269&ids=12,13 | Per-field checkboxes, typed inputs |
| Classify (A005) | http://localhost:3001/admin/classify | Tree groups by classification |
| Analysis (A006+A007) | http://localhost:3001/admin/analysis | Tab 1: incomplete objects, Tab 2: validation errors |
| Users (B000) | http://localhost:3001/admin/users | 3 tabs: info, roles, project access |
| Projects (B010) | http://localhost:3001/admin/projects | Project tree, CRUD |
| Modules (B011) | http://localhost:3001/admin/modules | Module tree, create/edit/delete |
| Object types (B012) | http://localhost:3001/admin/object-types | Type list, detail panel, add attribute |
| Classifications (B013) | http://localhost:3001/admin/classifications | Classification tree, edit |
| Import/Export (B014) | http://localhost:3001/admin/import-export | ID-sets + definition CRUD |

#### 3.3.1 CSV Import (A002)
1. Go to http://localhost:3001/admin/modules/269
2. Click **Importera** in toolbar
3. Browse a CSV file or download template first
4. Preview rows → click **Importera**
5. **Verify:** Toast shows imported/skipped/error counts

**API equivalent:**
```powershell
# Download template
Invoke-RestMethod "http://localhost:3000/api/admin/modules/269/import/template"
```

#### 3.3.2 CSV Export (A003)
1. Go to http://localhost:3001/admin/modules/269
2. Click **Exportera** → choose "alla kolumner" or "valda objekt"
3. **Verify:** CSV downloads with Swedish headers + attribute values

**API equivalent:**
```powershell
Invoke-RestMethod "http://localhost:3000/api/admin/modules/269/export"
```

#### 3.3.3 Print Reports (A004)
1. Go to http://localhost:3001/admin/modules/269
2. Click **Utskrifter** → choose report type (Totalrapport dörrar, etc.)
3. **Verify:** New tab opens with formatted spec sheet

---

### 3.4 BPMN Process Management (Phase 2)

#### 3.4.1 List Process Definitions
```powershell
Invoke-RestMethod http://localhost:3000/api/processes | ForEach-Object { "$($_.key) v$($_.version)" }
```
**Verify:** Lists deployed BPMN processes (master-building-lifecycle, door-lifecycle, etc.)

**Frontend:** http://localhost:3001/processes

#### 3.4.2 Start a Process Instance
```powershell
$body = '{"variables":{"buildingId":{"value":"B-001","type":"String"},"buildingName":{"value":"Test Building","type":"String"}}}'
Invoke-RestMethod -Uri "http://localhost:3000/api/processes/master-building-lifecycle/start" `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify:** Returns `id` (process instance ID), `definitionId`, `businessKey`.

**Frontend:** http://localhost:3001/processes → click "Starta" next to a process

#### 3.4.3 List Process Instances
```powershell
Invoke-RestMethod http://localhost:3000/api/process-instances | ForEach-Object {
  "$($_.id) $($_.processDefinitionKey) started=$($_.startTime)"
}
```
**Verify:** Returns active instances with `id`, `processDefinitionKey`, `startTime`.

**Frontend:** http://localhost:3001/timeline

#### 3.4.4 View Activity History (Timeline)
```powershell
# Replace {instanceId} with an actual process instance ID from step 3.4.3
$instanceId = "<paste-id-here>"
Invoke-RestMethod "http://localhost:3000/api/process-instances/$instanceId/activity-history"
```
**Verify:** Returns `timeline` array with activity events (startEvent, userTask, serviceTask, etc.), each having `activityName`, `activityType`, `startTime`, `endTime`, `isActive`.

**Frontend:** http://localhost:3001/timeline → select a process in left sidebar → see event log

---

### 3.5 Task Inbox & Dynamic Forms (Phase 3)

#### 3.5.1 List Available Tasks
```powershell
# All tasks
Invoke-RestMethod http://localhost:3000/api/tasks

# Tasks for a specific group
Invoke-RestMethod "http://localhost:3000/api/tasks?candidateGroup=locksmiths"

# Tasks assigned to a user
Invoke-RestMethod "http://localhost:3000/api/tasks?assignee=admin"
```
**Verify:** Returns task array with `id`, `name`, `assignee`, `created`, `processInstanceId`.

**Frontend:** http://localhost:3001/tasks — two tabs: "Mina uppgifter" and "Lediga uppgifter"

#### 3.5.2 Claim a Task
```powershell
$taskId = "<paste-task-id-here>"
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/$taskId/claim" `
  -Method POST -ContentType "application/json" -Body '{"userId":"admin"}'
```
**Verify:** 204 No Content. Task now has `assignee = admin`.

**Frontend:** Click "Ta uppgift" button on task list

#### 3.5.3 Unclaim a Task
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/$taskId/unclaim" -Method POST
```
**Verify:** 204 No Content. Task assignee is cleared.

#### 3.5.4 Generate Form for a Task
```powershell
Invoke-RestMethod "http://localhost:3000/api/forms/task/door-lifecycle_define_door_requirements?doorInstanceId=1&userGroup=locksmiths"
```
**Verify:** Returns `FormSchema` with:
- `task_id` — the task identifier
- `fields[]` — each with `attribute_name`, `type`, `value`, `visible`, `editable`, `required`
- `metadata` — `generated_at`, `user_group`, `read_only`

**Frontend:** http://localhost:3001/tasks/{taskId} — DynamicForm renders automatically

#### 3.5.5 Validate Form Data
```powershell
$body = @{
  taskId = "door-lifecycle_define_door_requirements"
  doorInstanceId = 1
  userGroup = "locksmiths"
  formData = @{ door_name = "Updated Door"; fire_class = "EI60" }
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/forms/validate `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify:** Returns `{ valid: true, errors: [], warnings: [] }` for valid data.

**Test invalid data** — omit a required field or set a wrong type to see validation errors.

#### 3.5.6 Submit Form Data (Persist to DB)
```powershell
$body = @{
  taskId = "door-lifecycle_define_door_requirements"
  doorInstanceId = 1
  userGroup = "locksmiths"
  formData = @{ door_name = "Updated Entrance"; fire_class = "EI60" }
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/forms/submit `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify:** Returns `{ success: true, message: "Updated 2 fields", updatedFields: 2 }`.

**Double-check persistence** by re-fetching the form:
```powershell
(Invoke-RestMethod "http://localhost:3000/api/forms/task/door-lifecycle_define_door_requirements?doorInstanceId=1&userGroup=locksmiths").fields |
  Where-Object { $_.attribute_name -in @('door_name','fire_class') } |
  Format-Table attribute_name, value
```
Should show `Updated Entrance` and `EI60`.

#### 3.5.7 Complete a Task
```powershell
$taskId = "<paste-task-id-here>"
$body = '{"variables":{"approved":{"value":true,"type":"Boolean"}}}'
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/$taskId/complete" `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify:** 204 No Content. Task disappears from task list. Process advances to next step.

**Frontend:** Fill form → click "Slutför uppgift" on http://localhost:3001/tasks/{taskId}

---

### 3.6 Portfolio & BIM (Phase 4)

#### 3.6.1 Portfolio Buildings
```powershell
# List
Invoke-RestMethod http://localhost:3000/api/portfolio/buildings

# Dashboard
Invoke-RestMethod http://localhost:3000/api/portfolio/dashboard

# Campaigns
Invoke-RestMethod http://localhost:3000/api/portfolio/campaigns
```
**Verify:** Buildings returns array with `id`, `name`, `address`, etc. Dashboard returns aggregated stats.

#### 3.6.2 Create a Building
```powershell
$body = '{"name":"Test Building","address":"Test St 1","city":"Stockholm","building_type":"office","total_doors":50,"year_built":2020}'
Invoke-RestMethod -Uri http://localhost:3000/api/portfolio/buildings -Method POST `
  -ContentType "application/json" -Body $body
```
**Verify:** Returns created building with generated `id`.

#### 3.6.3 BIM Models
```powershell
# List
Invoke-RestMethod http://localhost:3000/api/bim/models

# Create
$body = '{"building_id":1,"model_name":"Test Model","ifc_version":"IFC4","file_path":"/models/test.ifc"}'
Invoke-RestMethod -Uri http://localhost:3000/api/bim/models -Method POST `
  -ContentType "application/json" -Body $body

# Get details
Invoke-RestMethod http://localhost:3000/api/bim/models/1

# Get entities
Invoke-RestMethod http://localhost:3000/api/bim/models/1/entities

# Get clashes
Invoke-RestMethod http://localhost:3000/api/bim/models/1/clashes
```

---

### 3.7 AI Form Assistant

#### 3.7.1 Check AI Configuration
```powershell
Invoke-RestMethod http://localhost:3000/api/ai/config
```
**Verify (no provider):** `{ provider: "none", configured: false }` — graceful when not configured.

**Verify (with provider):** `{ provider: "openai", configured: true, model: "gpt-4" }` — when env vars set.

#### 3.7.2 Request AI Suggestions
```powershell
$body = @{
  taskId = "door-lifecycle_define_door_requirements"
  doorInstanceId = 1
  userGroup = "locksmiths"
  fields = @(
    @{ attribute_name = "fire_class"; type = "enum"; value = "" }
    @{ attribute_name = "security_class"; type = "enum"; value = "" }
  )
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri http://localhost:3000/api/ai/suggest `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify (no provider):** Returns `{ suggestions: {}, message: "Ingen AI-leverantör konfigurerad..." }`.

**Verify (with provider):** Returns `{ suggestions: { fire_class: "EI30", security_class: "HIGH" } }`.

To enable AI, set env vars before starting backend:
```powershell
$env:AI_PROVIDER = "openai"      # or "claude", "gemini", "ollama"
$env:AI_API_KEY = "sk-..."
$env:AI_MODEL = "gpt-4"          # optional
# $env:AI_BASE_URL = "http://localhost:11434"  # for Ollama
node demo-server.mjs
```

**Frontend:** On http://localhost:3001/tasks/{taskId}, click **"Föreslå värden"** button. Suggested fields get a ✨ AI-förslag indicator.

#### 3.7.3 Error Handling
```powershell
# Missing body → 400
Invoke-RestMethod -Uri http://localhost:3000/api/ai/suggest -Method POST `
  -ContentType "application/json" -Body '{}' -ErrorAction SilentlyContinue
```
**Verify:** Returns 400 with `{ error: "Missing required fields..." }`.

---

### 3.8 Delegates (External Task Workers)

#### 3.8.1 List Registered Delegates
```powershell
Invoke-RestMethod http://localhost:3000/api/delegates | Format-Table name, description
```
**Verify:** Returns 50+ delegate handlers (e.g., `ValidateRequirements`, `CheckFireRating`, etc.)

#### 3.8.2 Execute a Delegate Manually
```powershell
$body = '{"variables":{"doorInstanceId":1}}'
Invoke-RestMethod -Uri "http://localhost:3000/api/delegates/ValidateRequirements/execute" `
  -Method POST -ContentType "application/json" -Body $body
```
**Verify:** Returns `{ success: true, outputs: {...}, logs: [...] }`.

---

## 4. End-to-End Workflow Test

This is the full happy-path simulating a user working a BPMN-driven door task:

### Step 1: Login
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/login -Method POST `
  -ContentType "application/json" -Body '{"username":"admin","password":"password123"}'
```

### Step 2: Start a Process
```powershell
$proc = Invoke-RestMethod -Uri "http://localhost:3000/api/processes/door-lifecycle/start" `
  -Method POST -ContentType "application/json" `
  -Body '{"variables":{"doorInstanceId":{"value":"1","type":"String"}}}'
$proc.id  # save this
```

### Step 3: Find the Created Task
```powershell
$tasks = Invoke-RestMethod "http://localhost:3000/api/tasks?candidateGroup=locksmiths"
$task = $tasks[0]
$task.id  # save this
$task.name
```

### Step 4: Claim the Task
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/$($task.id)/claim" `
  -Method POST -ContentType "application/json" -Body '{"userId":"admin"}'
```

### Step 5: Generate Form
```powershell
$form = Invoke-RestMethod "http://localhost:3000/api/forms/task/$($task.name)?doorInstanceId=1&userGroup=locksmiths"
$form.fields | Format-Table attribute_name, type, value, editable
```

### Step 6: Submit Form Data
```powershell
$submitBody = @{
  taskId = $task.name
  doorInstanceId = 1
  userGroup = "locksmiths"
  formData = @{ door_name = "E2E Test Door"; fire_class = "EI60" }
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/forms/submit -Method POST `
  -ContentType "application/json" -Body $submitBody
```

### Step 7: Complete the Task
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/tasks/$($task.id)/complete" `
  -Method POST -ContentType "application/json" `
  -Body '{"variables":{"approved":{"value":true,"type":"Boolean"}}}'
```

### Step 8: Verify Process Advanced
```powershell
$history = Invoke-RestMethod "http://localhost:3000/api/process-instances/$($proc.id)/activity-history"
$history.timeline | ForEach-Object { "[$($_.activityType)] $($_.activityName) active=$($_.isActive)" }
```
**Verify:** First task shows `isActive = false` (completed). Next task should appear.

---

## 5. Quick Health Checks

Run these to confirm all components are healthy:

```powershell
# PostgreSQL
psql -U doorman_user -d doorman_db -c "SELECT count(*) FROM object_types"

# Operaton engine
Invoke-RestMethod http://localhost:8080/engine-rest/engine

# Backend
Invoke-RestMethod http://localhost:3000/health

# Frontend
Invoke-WebRequest http://localhost:3001 -TimeoutSec 3 | Select-Object StatusCode
```

All should return 200 / valid data.

---

## 6. All Backend Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate (username + password123) |
| GET | `/health` | Health check |
| GET | `/api` | API info |
| GET | `/api/stats` | OMS statistics |
| GET | `/api/objects/types` | List all object types |
| GET | `/api/objects/instances` | List object instances |
| GET | `/api/objects/instances/{id}` | Instance detail with attributes |
| POST | `/api/objects/instances` | Create new instance |
| PATCH | `/api/objects/instances/{id}/lock` | Lock/unlock instance |
| POST | `/api/objects/instances/{id}/copy` | Duplicate instance |
| POST | `/api/objects/instances/{id}/relationships` | Add relationship |
| DELETE | `/api/objects/instances/{id}/relationships/{linkId}` | Remove relationship |
| GET | `/api/objects/attributes` | List all attributes |
| GET | `/api/processes` | List BPMN process definitions |
| POST | `/api/processes/{key}/start` | Start process instance |
| GET | `/api/process-instances` | List active process instances |
| GET | `/api/process-instances/{id}/activity-history` | Activity timeline |
| GET | `/api/tasks` | List tasks (?assignee, ?candidateGroup) |
| GET | `/api/tasks/{id}` | Single task detail |
| POST | `/api/tasks/{id}/claim` | Claim task |
| POST | `/api/tasks/{id}/unclaim` | Unclaim task |
| POST | `/api/tasks/{id}/complete` | Complete task with variables |
| GET | `/api/forms/task/{taskId}` | Generate permission-filtered form |
| POST | `/api/forms/validate` | Validate form data |
| POST | `/api/forms/submit` | Persist form data to DB |
| GET | `/api/portfolio/buildings` | List portfolio buildings |
| POST | `/api/portfolio/buildings` | Create building |
| PUT | `/api/portfolio/buildings/{id}` | Update building |
| GET | `/api/portfolio/dashboard` | Portfolio dashboard stats |
| GET | `/api/portfolio/campaigns` | List campaigns |
| POST | `/api/portfolio/campaigns` | Create campaign |
| GET | `/api/bim/models` | List BIM models |
| POST | `/api/bim/models` | Create BIM model |
| GET | `/api/bim/models/{id}` | BIM model detail |
| PUT | `/api/bim/models/{id}/status` | Update model status |
| GET | `/api/bim/models/{id}/entities` | Model entities |
| GET | `/api/bim/models/{id}/clashes` | Model clashes |
| POST | `/api/bim/models/{id}/clashes` | Bulk insert clashes |
| PUT | `/api/bim/clashes/{id}` | Resolve/accept/ignore clash |
| GET | `/api/delegates` | List registered delegates |
| POST | `/api/delegates/{name}/execute` | Execute delegate manually |
| POST | `/api/ai/suggest` | AI field suggestions |
| GET | `/api/ai/config` | AI provider status |

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend won't start — port 3000 in use | `Get-Process -Name "node" \| Stop-Process -Force` |
| Database connection refused | `net start postgresql-x64-14` |
| Operaton not responding on 8080 | Restart: `cd camunda-bpm-run; .\shutdown.bat; Start-Sleep 5; cmd /c "internal\run.bat start"` |
| "No process definitions" | BPMN deploy failed — check backend startup logs for errors |
| Tasks list empty | Start a process first (section 3.4.2), then check tasks |
| Form returns empty fields | Ensure `doorInstanceId` exists in `object_instances` and has `attribute_values` |
| Frontend 404 on pages | Run `npm run dev` from `frontend/` folder, not project root |
| AI returns empty suggestions | Set `AI_PROVIDER` + `AI_API_KEY` env vars before starting backend |
