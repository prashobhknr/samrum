# 02 - User Personas and Role-Per-Phase Matrix

> Defines 10 user personas covering the full building lifecycle, their active
> phases, Doorman permission templates, and Camunda candidate group assignments.

---

## 1. Persona Catalog

### P01: Anvandare (Occupant / End User)

| Field | Value |
|-------|-------|
| **Swedish** | Anvandare / Nyttjare / Hyresgast |
| **English** | Occupant / Tenant |
| **Description** | Building occupants who interact with doors, rooms, and access systems daily |
| **Active Phases** | Investigation (requirements), Operations |
| **Doorman Group** | `occupants` |
| **Camunda Groups** | `occupants` |
| **Key Tasks** | Submit space requirements, report faults, request access changes |
| **Permission Scope** | READ on spatial objects in own zone; WRITE on fault reports |

### P02: Fastighetsagare (Property Owner)

| Field | Value |
|-------|-------|
| **Swedish** | Fastighetsagare / Bestellare |
| **English** | Property Owner / Client |
| **Description** | Organization owning the building asset; authorizes investments and approves phases |
| **Active Phases** | All phases (approval authority) |
| **Doorman Group** | `owners` |
| **Camunda Groups** | `owners`, `approvers` |
| **Key Tasks** | Approve phase gates, authorize budgets, accept handovers |
| **Permission Scope** | READ on ALL; WRITE on project-level attributes; DELETE never |

### P03: Forvaltare (Facility Manager)

| Field | Value |
|-------|-------|
| **Swedish** | Forvaltare / Fastighetsforvaltare |
| **English** | Facility Manager / FM |
| **Description** | Manages building operations, maintenance planning, and asset lifecycle |
| **Active Phases** | Pre-study (requirements), Handover (acceptance), Operations (primary) |
| **Doorman Group** | `facility_managers` |
| **Camunda Groups** | `facility_managers`, `approvers` |
| **Key Tasks** | Define maintenance schedules, accept AIM data, manage drift |
| **Permission Scope** | READ on ALL; WRITE on operations + maintenance attributes |

### P04: Projektledare (Project Manager)

| Field | Value |
|-------|-------|
| **Swedish** | Projektledare |
| **English** | Project Manager |
| **Description** | Coordinates all disciplines during project phases; manages timelines and deliverables |
| **Active Phases** | Investigation through Handover |
| **Doorman Group** | `project_managers` |
| **Camunda Groups** | `project_managers`, `approvers` |
| **Key Tasks** | Create projects, assign tasks, approve discipline deliverables, manage phase gates |
| **Permission Scope** | READ on ALL; WRITE on project metadata; approval authority on phase gates |

### P05: Projektor (Designer / Consultant)

| Field | Value |
|-------|-------|
| **Swedish** | Projektor / Konsult |
| **English** | Designer / Design Consultant |
| **Description** | Discipline-specific designers (architect, structural, HVAC, electrical, fire, security) |
| **Active Phases** | Design (primary), Pre-study (input), Production (site support) |
| **Doorman Group** | `designers_architect`, `designers_fire`, `designers_hvac`, `designers_electrical`, `designers_structural`, `designers_security` |
| **Camunda Groups** | Same as Doorman groups + `designers` (umbrella) |
| **Key Tasks** | Populate design attributes, produce drawings, verify requirements |
| **Permission Scope** | READ on ALL in own discipline types; WRITE on own discipline attributes; READ on related disciplines |

**Sub-roles** (Camunda candidate group per discipline):

| Discipline | Group ID | Samrum Module Families |
|-----------|----------|----------------------|
| Arkitekt | `designers_architect` | Tilltradeobjekt arkitekt, Utokad rumsbeskrivning |
| Brand | `designers_fire` | Brandskydd, Brand- o sakerhetsfunktioner |
| Dorr/Las | `designers_door` | Tilltradeobjekt teknik, Passagekontroll |
| El | `designers_electrical` | Beskrivning El, Elcentraler, El belysning |
| VVS | `designers_hvac` | Beskrivning Ror, Ventilation, Kylmaskiner |
| Styr | `designers_controls` | Styrprojektering |
| Sprinkler | `designers_sprinkler` | Sprinkler |
| Transport | `designers_transport` | Hissar |
| Struktur | `designers_structural` | Grundkonstruktion, Grundlaggning |

### P06: Byggentreprenor (General Contractor)

| Field | Value |
|-------|-------|
| **Swedish** | Byggentreprenor / Totalentreprenor |
| **English** | General Contractor |
| **Description** | Main contractor responsible for construction execution |
| **Active Phases** | Procurement (bidding), Production (primary), Handover |
| **Doorman Group** | `contractors` |
| **Camunda Groups** | `contractors` |
| **Key Tasks** | Manage deliveries, install components, document as-built, commission |
| **Permission Scope** | READ on design attributes; WRITE on installation + as-built attributes |

### P07: Underleverantor (Subcontractor / Supplier)

| Field | Value |
|-------|-------|
| **Swedish** | Underleverantor / Materialleverantor |
| **English** | Subcontractor / Supplier |
| **Description** | Specialized installers (locksmith, electrician, HVAC installer) and product suppliers |
| **Active Phases** | Production |
| **Doorman Group** | `locksmiths`, `electricians`, `hvac_installers`, `suppliers` |
| **Camunda Groups** | Same as Doorman groups |
| **Key Tasks** | Install specific components, record serial numbers, submit delivery data |
| **Permission Scope** | READ on assigned objects only; WRITE on installation attributes (SCOPE: ASSIGNED) |

### P08: Teknikverksamhet (Technical Operations)

| Field | Value |
|-------|-------|
| **Swedish** | Teknisk drift / Drifttekniker |
| **English** | Technical Operations / Building Technician |
| **Description** | On-site technicians who operate, maintain, and repair building systems |
| **Active Phases** | Operations (primary), Handover (training) |
| **Doorman Group** | `maintenance`, `technicians` |
| **Camunda Groups** | `maintenance`, `technicians` |
| **Key Tasks** | Perform maintenance, record measurements, respond to alarms |
| **Permission Scope** | READ on system attributes; WRITE on maintenance + measurement attributes |

### P09: Ekonomi/Juridik (Finance & Legal)

| Field | Value |
|-------|-------|
| **Swedish** | Ekonomi / Juridik / Upphandling |
| **English** | Finance / Legal / Procurement |
| **Description** | Handles contracts, costs, warranties, insurance, and regulatory compliance |
| **Active Phases** | Procurement (primary), all phases (cost tracking) |
| **Doorman Group** | `finance`, `legal` |
| **Camunda Groups** | `finance`, `legal` |
| **Key Tasks** | Manage contracts, track costs, verify warranties, handle permits |
| **Permission Scope** | READ on cost + contract attributes; WRITE on financial attributes |

### P10: Sakerhetspersonal (Security Staff)

| Field | Value |
|-------|-------|
| **Swedish** | Sakerhetspersonal / Sakerhetsansvarig |
| **English** | Security Manager / Security Staff |
| **Description** | Manages access control, security zones, and alarm systems |
| **Active Phases** | Design (security requirements), Operations (primary) |
| **Doorman Group** | `security_admin`, `security_operators` |
| **Camunda Groups** | `security_admin`, `security_operators` |
| **Key Tasks** | Define access zones, manage key groups, monitor alarms, audit access |
| **Permission Scope** | READ+WRITE on security + access control attributes; READ on spatial layout |

---

## 2. Role-Per-Phase Matrix

Active participation level: **P** = Primary, **S** = Secondary/Support, **A** = Approval only, **-** = Not active

| Persona | Investigation | Pre-study | Design | Procurement | Production | Handover | Operations | Decommission |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| P01 Anvandare | P | S | - | - | - | - | P | - |
| P02 Fastighetsagare | A | A | A | A | A | A | A | A |
| P03 Forvaltare | S | P | S | - | - | P | P | P |
| P04 Projektledare | P | P | P | P | P | P | - | S |
| P05 Projektor | - | S | P | - | S | S | - | - |
| P06 Byggentreprenor | - | - | - | P | P | P | - | P |
| P07 Underleverantor | - | - | - | S | P | S | - | - |
| P08 Teknikverksamhet | - | - | - | - | - | S | P | S |
| P09 Ekonomi/Juridik | - | S | S | P | S | S | S | S |
| P10 Sakerhetspersonal | - | - | P | - | S | S | P | S |

---

## 3. Permission Templates per Persona

### Doorman `permissions` table entries (per object_type_id)

Each template defines the base READ/WRITE/DELETE grants. Task-specific overrides come from `task_permission_rules`.

#### P01: Anvandare (occupants)

```sql
-- Spatial objects: READ only
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('occupants', :room_type_id, 'READ', 'OWN'),        -- own rooms
  ('occupants', :door_type_id, 'READ', 'ASSIGNED');    -- assigned doors
```

#### P02: Fastighetsagare (owners)

```sql
-- All object types: READ; project metadata: WRITE
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('owners', NULL, 'READ', 'ALL'),                     -- all types, all objects
  ('owners', :project_type_id, 'WRITE', 'ALL');        -- project attributes
```

#### P03: Forvaltare (facility_managers)

```sql
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('facility_managers', NULL, 'READ', 'ALL'),
  ('facility_managers', :door_type_id, 'WRITE', 'ALL'),       -- maintenance fields
  ('facility_managers', :room_type_id, 'WRITE', 'ALL'),
  ('facility_managers', :hvac_type_id, 'WRITE', 'ALL');
```

#### P05: Projektor (designers_*)

```sql
-- Discipline-scoped: each designer group gets WRITE on own discipline
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('designers_architect', :door_type_id, 'READ', 'ALL'),
  ('designers_architect', :door_type_id, 'WRITE', 'ALL'),     -- arch attributes only
  ('designers_fire', :fire_function_type_id, 'WRITE', 'ALL'),
  ('designers_hvac', :hvac_type_id, 'WRITE', 'ALL'),
  ('designers_electrical', :electrical_type_id, 'WRITE', 'ALL');
```

#### P06: Byggentreprenor (contractors)

```sql
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('contractors', :door_type_id, 'READ', 'ALL'),
  ('contractors', :door_type_id, 'WRITE', 'ASSIGNED'),        -- only assigned objects
  ('contractors', :room_type_id, 'READ', 'ALL');
```

#### P07: Underleverantor (locksmiths, etc.)

```sql
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('locksmiths', :door_type_id, 'READ', 'ASSIGNED'),
  ('locksmiths', :door_type_id, 'WRITE', 'ASSIGNED');         -- lock attributes only
```

#### P08: Teknikverksamhet (maintenance)

```sql
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('maintenance', NULL, 'READ', 'ALL'),
  ('maintenance', :door_type_id, 'WRITE', 'ALL'),             -- maintenance fields
  ('technicians', NULL, 'READ', 'ASSIGNED'),
  ('technicians', NULL, 'WRITE', 'ASSIGNED');
```

#### P10: Sakerhetspersonal (security_admin)

```sql
INSERT INTO permissions (user_group_id, object_type_id, operation, scope) VALUES
  ('security_admin', :door_type_id, 'READ', 'ALL'),
  ('security_admin', :door_type_id, 'WRITE', 'ALL'),          -- security attributes
  ('security_admin', :access_type_id, 'WRITE', 'ALL'),
  ('security_operators', :door_type_id, 'READ', 'ALL'),
  ('security_operators', :access_type_id, 'READ', 'ALL');
```

---

## 4. Camunda Candidate Group Assignments

### Process-Level Assignments

| Process | Start Group | Primary Workers | Approvers |
|---------|-------------|-----------------|-----------|
| `master-building-lifecycle` | `project_managers` | All groups | `owners`, `approvers` |
| `investigation-space-program` | `project_managers` | `occupants`, `facility_managers` | `owners` |
| `design-architecture` | `project_managers` | `designers_architect` | `project_managers` |
| `design-fire-safety` | `project_managers` | `designers_fire` | `project_managers`, `security_admin` |
| `design-door-process` | `project_managers` | `designers_door`, `designers_architect` | `project_managers` |
| `design-access-security` | `project_managers` | `designers_security`, `security_admin` | `project_managers` |
| `design-electrical` | `project_managers` | `designers_electrical` | `project_managers` |
| `design-hvac` | `project_managers` | `designers_hvac` | `project_managers` |
| `production-doors` | `contractors` | `locksmiths`, `contractors` | `supervisors` |
| `production-hvac` | `contractors` | `hvac_installers`, `contractors` | `supervisors` |
| `maintenance-cycle` | `facility_managers` | `maintenance`, `technicians` | `facility_managers` |
| `access-control-mgmt` | `security_admin` | `security_operators` | `security_admin` |

### Task-Level Candidate Groups (examples)

```xml
<!-- Design task: only the discipline designer can claim -->
<bpmn:userTask id="design-door-attributes"
               camunda:candidateGroups="designers_door,designers_architect" />

<!-- Approval task: PM + owner must approve -->
<bpmn:userTask id="approve-design-phase"
               camunda:candidateGroups="project_managers,owners" />

<!-- Installation task: contractor + locksmith -->
<bpmn:userTask id="install-door-hardware"
               camunda:candidateGroups="contractors,locksmiths" />

<!-- Commissioning: contractor documents, FM verifies -->
<bpmn:userTask id="verify-commissioning"
               camunda:candidateGroups="facility_managers" />
```

---

## 5. Multi-Group Permission Merging (Recap)

When a user belongs to multiple groups (e.g., a security-aware FM is in both `facility_managers` and `security_admin`):

| Attribute Type | Merge Rule | Rationale |
|---------------|------------|-----------|
| **Visible** | UNION | User sees everything any of their groups can see |
| **Editable** | INTERSECTION | User can only edit fields ALL their groups agree on |
| **Required** | UNION | If any group requires it, it's required |

This existing FormService behavior correctly handles cross-role users without changes.
