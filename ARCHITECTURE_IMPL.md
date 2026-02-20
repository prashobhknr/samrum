# 🏗️ ARCHITECTURE_IMPL.md - Design to Code Mapping

How the architecture design translates to the actual codebase.

---

## 📖 Design Documents (Reference)

All design in parent directory `/Users/prashobh/.openclaw/workspace/`:

1. **ARCHITECTURE.md** - System design
2. **DOOR_MODULE_DESIGN.md** - Door objects, attributes, relationships
3. **DYNAMIC_FORM_GENERATION.md** - Form engine
4. **IMPLEMENTATION_ROADMAP.md** - Phases 1-5
5. **ENHANCED_USE_CASES.md** - 14 scenarios

Read these to understand **why** we're building what we're building.

---

## 🏗️ Design → Code Mapping

### ARCHITECTURE.md → Code Structure

**Design Says:** 11 OMS tables with relationships and audit trail  
**Code Location:** `database/migrations/001_create_oms_schema.sql`

**Design Says:** REST API with /api/objects/*, /api/forms/*, /api/permissions/* routes  
**Code Location:** `backend/src/routes/` (objects.ts, forms.ts, permissions.ts)

**Design Says:** Permission evaluation at request time  
**Code Location:** `backend/src/services/PermissionService.ts` → checks groups, scope, attributes

**Design Says:** Audit trail for compliance  
**Code Location:** `backend/src/middleware/auditLogger.ts` → logs all changes to audit_log table

---

### DOOR_MODULE_DESIGN.md → Database Seeding

**Design Says:** Door object type with 14 attributes (door_id, lock_type, location, etc.)  
**Code Location:** `database/migrations/002_seed_door_objects.sql`  
**Implementation:**
```sql
INSERT INTO object_types (name) VALUES ('Door');
INSERT INTO object_attributes (object_type_id, attribute_name, ...) 
  VALUES (1, 'door_id', ...), (1, 'lock_type', ...), ...
```

**Design Says:** Lock object type with 10 attributes  
**Code Location:** Same file, inserted as object_type_id=2

**Design Says:** Relationships (Door contains Lock, Door has Frame, etc.)  
**Code Location:** Same file, `object_relationships` table

---

### DYNAMIC_FORM_GENERATION.md → FormService

**Design Says:** At runtime, fetch form schema based on user's groups and task  
**Code Location:** `backend/src/services/FormService.ts`

```typescript
async generateFormSchema(taskId, userId) {
  // 1. Get task from Camunda
  // 2. Get user's groups from JWT
  // 3. Query task_permission_rules for (task, process, groups)
  // 4. Merge permissions (UNION visible, INTERSECTION editable)
  // 5. Evaluate field dependencies
  // 6. Check scope (ALL, OWN, ASSIGNED)
  // 7. Return JSON form schema
}
```

**Design Says:** Field dependencies (if lock_type=electronic, show battery_status)  
**Code Location:** `backend/src/database/queries/fieldDependencies.ts`  
**Database:** `field_dependencies` table

**Design Says:** Form validation (required, min_length, pattern, enum)  
**Code Location:** `backend/src/services/FormService.ts` + frontend (React Hook Form)

---

## 🛢️ Database Layer

### OMS Schema (11 Tables)

| Table | Design Doc | Purpose |
|-------|-----------|---------|
| object_types | ARCHITECTURE.md | What kinds of objects exist |
| object_attributes | ARCHITECTURE.md | Attributes per object type |
| object_relationships | ARCHITECTURE.md | How objects relate |
| object_instances | ARCHITECTURE.md | Actual objects (doors, locks) |
| attribute_values | ARCHITECTURE.md | Actual data |
| permissions | ARCHITECTURE.md | Type-level access control |
| task_permission_rules | DYNAMIC_FORM_GENERATION.md | Per-task visibility rules |
| attribute_validators | DYNAMIC_FORM_GENERATION.md | Validation rules |
| field_dependencies | DYNAMIC_FORM_GENERATION.md | Conditional field logic |
| task_object_mappings | ARCHITECTURE.md | Link tasks to objects |
| audit_log | ARCHITECTURE.md | Compliance logging |

**Code Location:** `database/migrations/001_create_oms_schema.sql`

### Data Seeding

| Object Type | Design Doc | SQL Location |
|-----------|-----------|--|
| Door (60+ attributes) | DOOR_MODULE_DESIGN.md | database/migrations/002_seed_door_objects.sql |
| Lock (10 attributes) | DOOR_MODULE_DESIGN.md | Same file |
| Door Frame (10 attributes) | DOOR_MODULE_DESIGN.md | Same file |
| Door Automation (9 attributes) | DOOR_MODULE_DESIGN.md | Same file |
| Wall Type (7 attributes) | DOOR_MODULE_DESIGN.md | Same file |

---

## 🚀 Backend Layer

### Service Architecture

```
Controllers (request handlers)
    ↓
Services (business logic)
    ↓
Database queries (SQL)
    ↓
PostgreSQL
```

### Services (By Design Concept)

**1. ObjectService** (ARCHITECTURE.md)
```typescript
// src/services/ObjectService.ts
- getAllTypes() → SELECT * FROM object_types
- createObjectType(name, desc) → INSERT INTO object_types
- getObjectAttributes(typeId) → Query attributes for type
- createObjectInstance(typeId, external_id, name) → New object
- setAttributeValue(instanceId, attrId, value) → Store data
```

**2. PermissionService** (ARCHITECTURE.md + DYNAMIC_FORM_GENERATION.md)
```typescript
// src/services/PermissionService.ts
- getTaskPermissionRules(processKey, taskName, groupId) → From task_permission_rules table
- mergePermissionRules(rules) → UNION visible, INTERSECTION editable
- checkPermission(userId, groups, operation, objectTypeId) → Can user READ/WRITE?
- evaluateScope(userId, objectInstance, scope) → ALL, OWN, or ASSIGNED?
```

**3. FormService** (DYNAMIC_FORM_GENERATION.md)
```typescript
// src/services/FormService.ts
- generateFormSchema(taskId, userId) → Runtime form generation
- getFieldDependencies(attributeId, value) → Conditional logic
- getAttributeValidators(attributeId, userGroups) → Validation rules
- mergeFieldDependencies(fields, objectData) → Apply show/hide/require logic
```

**4. AuditService** (ARCHITECTURE.md)
```typescript
// src/services/AuditService.ts
- logAction(userId, action, objectInstanceId, details) → INSERT into audit_log
- queryAuditLog(filters) → Search audit trail
```

### Routes (By Design API)

**Objects CRUD** (ARCHITECTURE.md API Contracts)
```
GET    /api/objects/types
POST   /api/objects/types
GET    /api/objects/types/{id}/attributes
POST   /api/objects/types/{id}/attributes
GET    /api/objects/instances
POST   /api/objects/instances
GET    /api/objects/instances/{id}/attributes
POST   /api/objects/instances/{id}/attributes
```

**Permissions** (ARCHITECTURE.md)
```
GET    /api/permissions
POST   /api/permissions
```

**Forms** (DYNAMIC_FORM_GENERATION.md)
```
GET    /api/tasks/{taskId}/form
POST   /api/tasks/{taskId}/complete
```

---

## 🔐 Permission Model Implementation

### Type-Level (ARCHITECTURE.md)

Database table: `permissions`

```sql
user_group_id='locksmiths'
object_type_id=1 (Door)
operation='READ'
scope='ASSIGNED'
```

Code check:
```typescript
const perm = await PermissionService.checkPermission(
  userId,
  ['locksmiths'],
  'READ',
  1 // Door type
);
```

### Task-Level (DYNAMIC_FORM_GENERATION.md)

Database table: `task_permission_rules`

```sql
process_definition_key='door-unlock'
task_name='Inspect Door'
user_group_id='locksmiths'
visible_attributes=[1,2,12,100]  -- door_id, lock_type, notes, inspection_notes
editable_attributes=[2,12,100]   -- lock_type, notes, inspection_notes
```

Code implementation:
```typescript
const rule = await db.query(
  `SELECT * FROM task_permission_rules 
   WHERE process_definition_key=? 
   AND task_name=? 
   AND user_group_id=?`,
  ['door-unlock', 'Inspect Door', 'locksmiths']
);
// Result: visible=[1,2,12,100], editable=[2,12,100]
```

### Multi-Group Merging (DYNAMIC_FORM_GENERATION.md Section 2)

Code algorithm:
```typescript
function mergePermissionRules(rules) {
  return {
    visible: union(...rules.map(r => r.visible_attributes)),      // UNION
    editable: intersection(...rules.map(r => r.editable_attributes)), // INTERSECTION
    required: union(...rules.map(r => r.required_attributes))     // UNION
  };
}
```

If user has groups ['locksmiths', 'supervisors']:
- Locksmith: visible=[door_id, lock_type], editable=[lock_type]
- Supervisor: visible=[door_id, lock_type, location], editable=[lock_type, location]
- Merged: visible=[door_id, lock_type, location], editable=[lock_type]

---

## 📝 Testing Strategy

### Unit Tests (By Design Concept)

**ObjectService Tests** (DOOR_MODULE_DESIGN.md objects)
```typescript
// tests/unit/ObjectService.test.ts
test('createObjectType creates Door type')
test('getObjectAttributes returns 14 attributes for Door')
test('createObjectInstance creates door D-001')
test('setAttributeValue stores door_id')
```

**PermissionService Tests** (ARCHITECTURE.md permission model)
```typescript
// tests/unit/PermissionService.test.ts
test('mergePermissionRules UNIONs visible attributes')
test('mergePermissionRules INTERSECTs editable attributes')
test('checkPermission validates multi-group users')
```

**FormService Tests** (DYNAMIC_FORM_GENERATION.md)
```typescript
// tests/unit/FormService.test.ts
test('generateFormSchema returns correct fields for locksmith')
test('generateFormSchema hides fields for other roles')
test('field dependencies show/hide correctly')
test('multi-group merging works')
```

### Integration Tests

**API Tests** (ARCHITECTURE.md API Contracts)
```typescript
// tests/integration/api.test.ts
test('POST /api/objects/types creates object')
test('GET /api/objects/types returns types')
test('GET /api/tasks/{taskId}/form returns form schema')
```

**Database Tests**
```typescript
// tests/integration/database.test.ts
test('OMS schema has 11 tables')
test('Door object type with 60+ attributes')
test('Relationships created correctly')
```

---

## 🔄 Development Workflow

### Phase 1 (NOW) ← You are here
- ✅ Project structure
- ✅ OMS schema (11 tables)
- ✅ Door objects seeded
- ✅ API endpoints (CRUD)
- ✅ Tests & CI/CD

### Phase 2 (NEXT)
**Design:** IMPLEMENTATION_ROADMAP.md Phase 2  
**Code Work:**
- Extract legacy door data
- Transform to OMS schema
- Migrate to PostgreSQL
- Validation scripts

### Phase 3
**Design:** DYNAMIC_FORM_GENERATION.md  
**Code Work:**
- FormService.generateFormSchema() → Full implementation
- Form validation
- Camunda integration
- Field dependencies

### Phase 4
**Design:** ARCHITECTURE.md (Tier 2 & 3 UIs)  
**Code Work:**
- Tier 2 Portal (React) - user tasks
- Tier 3 Portal (React) - object management
- Authentication integration

### Phase 5
**Design:** IMPLEMENTATION_ROADMAP.md Phase 5  
**Code Work:**
- Performance testing
- Security audit
- Production deployment
- Legacy decommission

---

## 📚 Code Navigation

**"I want to understand how X works"**

| Question | Location |
|----------|----------|
| How are objects defined? | `database/migrations/002_seed_door_objects.sql` |
| How are permissions checked? | `backend/src/services/PermissionService.ts` |
| How are forms generated? | `backend/src/services/FormService.ts` |
| How is data validated? | `backend/src/services/FormService.ts` + `attribute_validators` table |
| How are changes logged? | `backend/src/middleware/auditLogger.ts` |
| What's the API structure? | `backend/src/routes/` + `docs/API.md` |
| How do tests work? | `tests/unit/` + `tests/integration/` |

---

## 🎯 Next Steps

1. **Understand Design**
   - Read ARCHITECTURE.md (system overview)
   - Read DOOR_MODULE_DESIGN.md (objects & attributes)
   - Read DYNAMIC_FORM_GENERATION.md (how forms work)

2. **Understand Code**
   - Schema: `database/migrations/001_create_oms_schema.sql`
   - Services: `backend/src/services/`
   - Routes: `backend/src/routes/`
   - Tests: `tests/`

3. **Run Locally**
   - Follow [DEVELOPMENT.md](./DEVELOPMENT.md)
   - Start Docker services
   - Run migrations & seeds
   - Test API endpoints

4. **Contribute**
   - Follow [AGENT.md](./AGENT.md) workflow
   - Write tests first
   - Implement feature
   - Document changes

---

**Last updated:** 2026-02-20  
**Status:** Phase 1 Foundation Complete
