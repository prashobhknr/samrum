# 🤖 AGENT.md - Development Workflow for Agents & Contributors

This document explains how to work on the Doorman project, especially for AI agents assisting with development.

---

## 📖 Understanding the Project

### Start Here (In Order)

1. **Design Documents** (in parent directory)
   - `ARCHITECTURE.md` - System design, database, permissions
   - `DOOR_MODULE_DESIGN.md` - Door objects, attributes, relationships
   - `DYNAMIC_FORM_GENERATION.md` - How dynamic forms work
   - `IMPLEMENTATION_ROADMAP.md` - Phases 1-5 plan
   - `ENHANCED_USE_CASES.md` - 14 scenarios

2. **This Repo**
   - `README.md` - Project overview
   - `DEVELOPMENT.md` - Local setup
   - `docs/API.md` - Endpoint reference
   - `docs/DATABASE.md` - Schema explanation

3. **Code**
   - `src/` - Backend implementation
   - `database/` - Migrations & seeds
   - `tests/` - Test suite

### Context For Agents

**The Problem We're Solving:**
- Legacy system (Samrum) hardcodes object definitions in SAS code
- Hard to extend (adding new object type = code change)
- No version control on processes (Bizagi files, not BPMN)
- Manual permission management (scattered in code)

**Our Solution:**
- BPMN processes (version-controlled, standardized)
- Object Management System (database-driven)
- Dynamic forms (zero code changes for UI updates)
- Permission rules in database (no hardcoding)

**Why This Matters:**
- Adding new door attribute = 1 SQL insert (not code change)
- Changing permission = 1 SQL update (not code change)
- New process = import BPMN file (not new project)

---

## 🔄 Git Workflow

### Branch Strategy

```
main (production-ready code)
  ├── develop (integration branch)
  │   ├── feature/oms-crud (developer branch)
  │   ├── feature/form-generation
  │   └── feature/permission-rules
  └── hotfix/database-migration-bug
```

### Commit Messages

```
Format: [PHASE-#] [TYPE] description

Types: feat, fix, docs, refactor, test, chore

Examples:
  [PHASE-1] feat: implement object CRUD endpoints
  [PHASE-3] fix: form generation for multi-group users
  [PHASE-1] docs: add database schema explanation
  [PHASE-1] test: add unit tests for ObjectService
```

### Pull Request Checklist

- [ ] Branch off `develop`
- [ ] All tests passing (`npm test`)
- [ ] Code coverage >80%
- [ ] Updated relevant documentation
- [ ] Commit message follows format
- [ ] No console.logs or debug code
- [ ] TypeScript compiles without warnings

---

## 🏗️ Architecture Overview (For Development)

### Layer 1: Routes (Express endpoints)
```typescript
// src/routes/objects.ts
router.get('/types', controller.getObjectTypes);
router.post('/types', controller.createObjectType);
```

### Layer 2: Controllers (Request handlers)
```typescript
// src/controllers/objectController.ts
export async function getObjectTypes(req, res) {
  const types = await objectService.getAllTypes();
  res.json(types);
}
```

### Layer 3: Services (Business logic)
```typescript
// src/services/objectService.ts
export async function getAllTypes() {
  return db.query('SELECT * FROM object_types');
}
```

### Layer 4: Database (PostgreSQL)
```sql
-- database/migrations/001_create_oms_schema.sql
CREATE TABLE object_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  ...
);
```

### Data Flow
```
Request → Route → Controller → Service → Database → Response
```

---

## 🔑 Key Concepts (Read These!)

### 1. Object Management System (OMS)

Everything is an object with attributes:

```
Door object_type_id=1
  ├─ door_id (attribute_id=1): text
  ├─ lock_type (attribute_id=2): enum
  ├─ location (attribute_id=3): text
  └─ security_class (attribute_id=4): enum

Lock object_type_id=2
  ├─ lock_id (attribute_id=5): text
  ├─ lock_type (attribute_id=6): enum
  └─ ...
```

**Service:** `ObjectService` - Create types, add attributes, create instances

### 2. Permissions (Multi-Level)

```
Group: locksmiths
  └─ Door object type
      ├─ READ: door_id, lock_type, battery_status
      ├─ WRITE: lock_type, battery_status
      └─ Scope: ASSIGNED (only assigned doors)

Group: supervisors
  └─ Door object type
      ├─ READ: ALL attributes
      ├─ WRITE: ALL attributes
      └─ Scope: ALL
```

**Service:** `PermissionService` - Check permissions, merge rules for multi-group users

### 3. Dynamic Forms (Database-Driven)

```
Task: "Inspect Door" in process "door-unlock"
User: locksmith (group: locksmiths)

Query: SELECT * FROM task_permission_rules
       WHERE process_definition_key='door-unlock'
       AND task_name='Inspect Door'
       AND user_group_id='locksmiths'

Result: visible_attributes=[1,2,12,100], editable_attributes=[2,12,100]

Form renders: door_id (RO), lock_type (RW), notes (RW)
```

**Service:** `FormService` - Generate schemas at runtime

### 4. Audit Trail (Everything Logged)

```
action: 'ATTRIBUTE_UPDATED'
user: 'john.smith@example.com'
object_instance_id: 1
attribute_id: 2
old_value: 'mortise'
new_value: 'electronic'
timestamp: '2026-02-20T15:05:00Z'
```

**Storage:** `audit_log` table (immutable)

---

## 🛠️ Common Development Tasks

### Task 1: Add a New Object Type

**Scenario:** Need to add "Emergency Exit Door" object type

**Steps:**

1. Add migration:
```sql
-- database/migrations/003_add_emergency_exit_door.sql
INSERT INTO object_types (name, description)
VALUES ('Emergency Exit Door', 'Fire escape doors with special requirements');
```

2. Run migration:
```bash
npm run migrate:003
```

3. Test via API:
```bash
curl -X GET http://localhost:3000/api/objects/types
# Should see: Emergency Exit Door in results
```

### Task 2: Add Attribute to Object Type

**Scenario:** Door needs "fire_rating" attribute

**Steps:**

1. Add migration:
```sql
-- database/migrations/004_add_fire_rating_to_door.sql
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required)
VALUES (1, 'fire_rating', 'text', true);
```

2. Test via API:
```bash
curl -X GET http://localhost:3000/api/objects/types/1/attributes
# Should include fire_rating
```

3. Update form rules (Phase 3):
```sql
UPDATE task_permission_rules 
SET visible_attributes = array_append(visible_attributes, (SELECT id FROM object_attributes WHERE attribute_name='fire_rating'))
WHERE task_name='Inspect Door';
```

### Task 3: Create Permission Rule for New Task

**Scenario:** Supervisor needs special access to "Verify Status" task

**Steps:**

1. Add rule:
```sql
INSERT INTO task_permission_rules 
  (process_definition_key, task_name, user_group_id, visible_attributes, editable_attributes, required_attributes)
VALUES 
  ('door-unlock', 'Verify Status', 'supervisors', 
   '[1,2,3,4,5,50]',  -- all door attributes + approval_status
   '[1,2,3,4,5,50]',  -- can edit all
   '[1,2,50]');       -- must fill: door_id, lock_type, approval_status
```

2. Test form generation (Phase 3):
```bash
curl -X GET http://localhost:3000/api/tasks/task-001/form
# Verify supervisor sees all fields, others don't
```

### Task 4: Add Field Dependency

**Scenario:** If lock_type=electronic, show battery_status field

**Steps:**

1. Add dependency:
```sql
INSERT INTO field_dependencies 
  (source_attribute_id, source_value, dependent_attribute_id, dependency_type)
VALUES 
  (2, 'electronic', 11, 'SHOW');  -- lock_type=electronic → show battery_status
```

2. Backend test (Phase 3):
```typescript
const deps = await getFieldDependencies(2, 'electronic');
// Should return: { dependent_attribute_id: 11, type: 'SHOW' }
```

### Task 5: Write a Unit Test

**Scenario:** Test ObjectService.createObjectType()

**Steps:**

1. Create test file:
```typescript
// tests/unit/ObjectService.test.ts
import { ObjectService } from '../../src/services/ObjectService';

describe('ObjectService', () => {
  test('createObjectType should insert and return object', async () => {
    const result = await ObjectService.createObjectType({
      name: 'Test Object',
      description: 'Test Description'
    });
    
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('Test Object');
  });
});
```

2. Run test:
```bash
npm test -- ObjectService
```

---

## 🔍 Code Review Checklist

When reviewing PRs, check:

- [ ] **Tests passing**: `npm test` ✓
- [ ] **Coverage >80%**: `npm run test:coverage` ✓
- [ ] **No TypeScript errors**: `npx tsc --noEmit` ✓
- [ ] **Lint clean**: `npm run lint` ✓
- [ ] **Documentation updated**: README, API docs, DATABASE docs ✓
- [ ] **Commit messages follow format**: `[PHASE-#] [TYPE]` ✓
- [ ] **No console.logs**: Clean production code ✓
- [ ] **Error handling**: Try/catch, proper HTTP status codes ✓
- [ ] **SQL injection safe**: Using parameterized queries ✓
- [ ] **Audit logging**: Important actions logged ✓

---

## 📚 Where Things Live

| Thing | Location |
|-------|----------|
| Routes | `src/routes/*.ts` |
| Controllers | `src/controllers/*.ts` |
| Services | `src/services/*.ts` |
| Database queries | `src/database/*.ts` |
| Types/Interfaces | `src/types/*.ts` |
| Database migrations | `database/migrations/*.sql` |
| Test files | `tests/unit/*.ts`, `tests/integration/*.ts` |
| Docs | `docs/*.md` |

---

## 🚀 Phases Overview (For Prioritization)

**Phase 1 (DONE):** Foundation
- Project structure ✓
- OMS schema ✓
- Door objects seeded ✓
- API endpoints ✓

**Phase 2 (NEXT):** Data Migration
- Extract from legacy
- Transform data
- Load to OMS
- Validate

**Phase 3:** Form Generation
- Dynamic form schema generation
- Permission evaluation
- Field dependencies
- Camunda integration

**Phase 4:** UI Development
- Tier 2 portal (user tasks)
- Tier 3 portal (object management)
- Deployment

**Phase 5:** Testing & Launch
- UAT, performance, security
- Production deployment
- Legacy decommission

---

## 🐛 Debugging Tips

### "Connection refused" to PostgreSQL
```bash
# Check if postgres running
docker ps | grep postgres

# If not running
docker-compose up -d postgres

# Check logs
docker logs doorman-postgres-1
```

### "TypeScript compilation errors"
```bash
# Check what's wrong
npx tsc --noEmit

# Fix common issues
npm install  # missing dependencies
git clean -fd  # stale files
```

### "Tests failing"
```bash
# Run with verbose output
npm test -- --verbose

# Run specific test
npm test -- ObjectService

# Check coverage report
npm run test:coverage
```

### "API endpoint not responding"
```bash
# Check server logs
npm run dev  # watch mode

# Check endpoint exists
grep -r "'/api/objects/types'" src/routes/

# Test manually
curl http://localhost:3000/api/objects/types -v
```

---

## 📝 Documentation Guidelines

When writing code, document:

```typescript
/**
 * Create a new object type
 * @param name - Unique name for object type (e.g., "Door", "Lock")
 * @param description - Human-readable description
 * @returns Created ObjectType object with auto-generated ID
 * @throws DatabaseError if name already exists (UNIQUE constraint)
 */
export async function createObjectType(name: string, description: string) {
  // Implementation
}
```

For APIs, document:

```typescript
/**
 * POST /api/objects/types
 * 
 * Create a new object type in the OMS
 * 
 * Request:
 *   { "name": "Door", "description": "Physical door" }
 * 
 * Response (201):
 *   { "id": 1, "name": "Door", "description": "Physical door" }
 * 
 * Errors:
 *   409: Name already exists
 *   400: Invalid input
 *   500: Server error
 */
```

---

## 🎯 Success Criteria for Each Phase

### Phase 1 (Foundation) ✅
- [ ] Project structure matches design
- [ ] 11 OMS tables created
- [ ] Door objects seeded (Door, Lock, Frame, Automation, WallType)
- [ ] All 60+ door attributes present
- [ ] All relationships defined
- [ ] API endpoints working
- [ ] Tests passing (>80% coverage)
- [ ] Documentation complete

### Phase 2 (Migration)
- [ ] Legacy data extracted
- [ ] Transformation scripts built
- [ ] 5,000+ doors migrated
- [ ] Data quality validated
- [ ] Rollback tested

### Phase 3 (Forms)
- [ ] Form schema generation working
- [ ] Permission evaluation correct
- [ ] Field dependencies working
- [ ] Multi-group merging tested
- [ ] Camunda integration verified

### Phase 4 (UI)
- [ ] Tier 2 portal built
- [ ] Tier 3 portal built
- [ ] All tests passing
- [ ] Deployed to staging

### Phase 5 (Launch)
- [ ] UAT complete
- [ ] Performance acceptable
- [ ] Security audit passed
- [ ] Production deployed

---

## 🤝 How Agents Should Approach Work

1. **Read the design docs** (ARCHITECTURE.md, DOOR_MODULE_DESIGN.md)
2. **Understand the phase** (what needs to be built)
3. **Check existing code** (what's already done)
4. **Write tests first** (TDD approach)
5. **Implement feature** (follow layer pattern)
6. **Document changes** (code comments, API docs, README)
7. **Run full test suite** (`npm test`)
8. **Create PR with checklist** (link design docs, reference phase)

---

## 📞 Questions During Development?

- **"How do I X?"** → Check DEVELOPMENT.md
- **"What's the API?"** → Check docs/API.md
- **"How's the database structured?"** → Check docs/DATABASE.md
- **"Why are we doing this?"** → Check design docs (ARCHITECTURE.md, etc.)
- **"What's the overall plan?"** → Check IMPLEMENTATION_ROADMAP.md

---

**Happy building! 🚀**

Remember: Every line of code should either:
1. Implement the design
2. Write tests
3. Document decisions

Last updated: 2026-02-20
