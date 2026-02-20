# 🚀 Phase 3: Dynamic Form Generation & Camunda Integration - STARTED

**Phase:** 3 of 5  
**Status:** 🟢 FOUNDATION LAID  
**Start Date:** 2026-02-20  
**Estimated Duration:** 4 weeks  
**Branch:** feature/phase-3-dynamic-forms

---

## 📋 What's Done (Foundation)

### ✅ Core Services Implemented

#### 1. FormService (backend/src/services/formService.ts)
**Purpose:** Generate permission-aware dynamic forms

**Key Methods:**
- `generateFormForTask(taskId, doorInstanceId, userGroup)` → Returns JSON form schema
- `validateFormSubmission()` → Validates form data before saving
- `saveFormSubmission()` → Persists form data to database

**Algorithm:**
1. Load task permission rules (what fields the task exposes)
2. Load user's base permissions (what they can access)
3. Load door instance data (current values)
4. For each attribute: determine visible, editable, required status
5. Return complete form JSON with metadata

---

#### 2. PermissionService (backend/src/services/permissionService.ts)
**Purpose:** Check and evaluate permissions

**Key Methods:**
- `canPerform(userGroups, objectTypeId, attributeId, operation)` → Boolean
- `getReadableAttributes(userGroups, objectTypeId)` → List of attribute IDs
- `getWritableAttributes(userGroups, objectTypeId)` → List of attribute IDs
- `getTaskRules(processKey, taskName, userGroup)` → Task permission rules

**Supports:**
- Multi-group permission merging (user in multiple groups)
- Scope-based filtering (ALL, OWN, ASSIGNED)
- Task-level visibility rules

---

### ✅ API Routes Implemented

#### 3. Forms API (backend/src/api/forms.ts)
Three endpoints for form management:

```typescript
// GET /api/forms/task/:taskId?doorInstanceId=1&userGroup=locksmiths
// Generate form for a task with permission filtering
// Returns: FormSchema with visible/editable/required fields

// POST /api/forms/validate
// Validate form submission before saving
// Body: { taskId, doorInstanceId, userGroup, formData }
// Returns: { valid: boolean, errors: [], warnings: [] }

// POST /api/forms/submit
// Save form submission (update door attributes)
// Body: { taskId, doorInstanceId, userGroup, formData }
// Returns: { success: boolean, updatedFields: number }
```

---

#### 4. Objects API (backend/src/api/objects.ts)
Six endpoints for door management:

```typescript
// GET /api/objects/types
// List all object types (Door, Lock, Frame, Automation, WallType)

// GET /api/objects/types/:id
// Get object type with all attribute definitions

// GET /api/objects/instances?type=1&limit=50&offset=0&search=D-001
// List door instances with pagination and search

// GET /api/objects/instances/:id
// Get single door with all current attribute values

// POST /api/objects/instances
// Create new door instance with attributes

// PUT /api/objects/instances/:id
// Update door instance and attributes
```

---

## 📊 What's Still Needed

### Phase 3 Remaining Tasks (Weeks 2-4)

#### Task 3.1: Complete API Testing
- [ ] Unit tests for FormService
- [ ] Unit tests for PermissionService
- [ ] Integration tests for all API endpoints
- [ ] Jest test suite setup
- [ ] Mock database for tests

#### Task 3.2: Camunda Integration
- [ ] Create door-unlock.bpmn process file
- [ ] Create door-maintenance.bpmn process file
- [ ] Deploy BPMN files to Camunda (local or SaaS)
- [ ] Add form field bindings to BPMN tasks
- [ ] Create Camunda task listeners

#### Task 3.3: Permission Rules Configuration
- [ ] Populate `task_permission_rules` table (SQL migrations)
- [ ] Populate `task_object_mappings` table (SQL migrations)
- [ ] Test permission filtering with different user groups
- [ ] Document all task-role-field visibility rules

#### Task 3.4: Documentation
- [ ] Create OpenAPI/Swagger specification
- [ ] Generate API documentation (html)
- [ ] Create Postman collection with examples
- [ ] Write usage guide for form generation
- [ ] Document permission model

#### Task 3.5: Field Dependencies (Optional)
- [ ] Implement conditional field visibility
- [ ] Support field dependencies (show field X if field Y = value Z)
- [ ] Store in `field_dependencies` table

---

## 🔧 Database Setup for Phase 3

### Tables to Populate

#### 1. task_permission_rules (Critical)
Maps task → user group → visible/editable/required attributes

```sql
INSERT INTO task_permission_rules 
  (process_definition_key, task_name, user_group_id, 
   visible_attributes, editable_attributes, required_attributes, form_header_text)
VALUES
  ('door-unlock', 'Inspect Door', 'locksmiths', 
   '[1, 6, 3, 4, 5]', '[]', '[1]', 'Inspect the door and lock - read-only'),
   
  ('door-unlock', 'Perform Unlock', 'locksmiths',
   '[1, 6, 3, 33]', '[33]', '[1, 33]', 'Mark door as unlocked'),
   
  ('door-unlock', 'Verify Status', 'supervisors',
   '[1, 2, 3, 4, ..., 34]', '[33]', '[1, 33]', 'Final verification - all information visible');
```

#### 2. task_object_mappings (Critical)
Links Camunda tasks to OMS objects

```sql
INSERT INTO task_object_mappings 
  (process_definition_key, task_name, object_type_id, process_variable_name)
VALUES
  ('door-unlock', 'Inspect Door', 1, 'doorInstance'),
  ('door-unlock', 'Perform Unlock', 1, 'doorInstance'),
  ('door-unlock', 'Verify Status', 1, 'doorInstance');
```

#### 3. permissions (Already Populated in Phase 2)
User group → attribute → operation

---

## 🧪 Testing Foundation

### Sample Data Available
- **10 doors migrated from Phase 2:** D-001 through D-010
- **All 34 attributes populated**
- **Ready for testing with real process workflows**

### How to Test FormService

```typescript
// Example: Get form for locksmith inspecting door D-001
const form = await formService.generateFormForTask(
  'door-unlock_inspect-door',
  1,  // door instance ID
  'locksmiths'
);

// Expected output:
// - 5 visible fields: door_id, lock_type, location, fire_class, security_class
// - All fields read-only (editable: false)
// - Only door_id required (required: true)
```

### How to Test API

```bash
# Generate form for locksmith
curl "http://localhost:3000/api/forms/task/door-unlock_inspect-door?doorInstanceId=1&userGroup=locksmiths"

# Get list of doors
curl "http://localhost:3000/api/objects/instances?limit=10"

# Get single door with attributes
curl "http://localhost:3000/api/objects/instances/1"
```

---

## 📈 Progress Tracking

### Files Created This Session
```
backend/src/services/formService.ts         (FormService - 300+ lines)
backend/src/services/permissionService.ts   (PermissionService - 200+ lines)
backend/src/api/forms.ts                    (Forms API - 250+ lines)
backend/src/api/objects.ts                  (Objects API - 350+ lines)
PHASE_3_START.md                            (This document)
```

### Git Status
```
Branch: feature/phase-3-dynamic-forms
Files: 5 new TypeScript files (1100+ LOC)
Ready to: Commit and continue with testing
```

---

## 🎯 Next Steps (Priority Order)

### Week 1 (Now)
- [x] Create FormService core logic
- [x] Create PermissionService core logic
- [x] Create Forms API routes
- [x] Create Objects API routes
- [ ] **Setup Jest testing framework**
- [ ] **Write unit tests for FormService**

### Week 2
- [ ] Write integration tests for API endpoints
- [ ] Test with Phase 2 data (10 doors)
- [ ] Create BPMN process files
- [ ] Populate task_permission_rules table

### Week 3
- [ ] Deploy BPMN to Camunda
- [ ] Create Camunda task listeners
- [ ] Test end-to-end: form generation → submit → Camunda task
- [ ] Document API with OpenAPI/Swagger

### Week 4
- [ ] Create Postman collection
- [ ] Final testing and bug fixes
- [ ] Complete documentation
- [ ] Merge to main and prepare Phase 4

---

## 📚 Architecture Summary

### Three-Layer Design

```
┌─────────────────────────────────────┐
│         API Routes                  │
│   /api/forms/* /api/objects/*       │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│         Services                    │
│   FormService PermissionService     │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│       PostgreSQL Database           │
│   object_instances, attribute_values│
│   permissions, task_permission_rules│
└─────────────────────────────────────┘
```

### Key Logic Flow

**For Form Generation:**
```
1. Load task rules (visible/editable/required)
2. Get user permissions (READ/WRITE)
3. Merge task rules + user permissions
4. Load current door data
5. Return form JSON with metadata
```

**For Form Submission:**
```
1. Validate against form schema
2. Check required fields present
3. Check user can edit those fields
4. Check type conversions valid
5. Save to attribute_values table
```

---

## ✨ Why This Matters

**Phase 3 is the heart of the system.**

- **Permission-Aware Forms:** Shows different fields to different roles
- **Type-Safe Validation:** Prevents invalid data from being saved
- **Audit Trail:** All form submissions tracked in audit_log
- **Process Integration:** Camunda tasks know which fields to show
- **Scalable:** Add new tasks/forms without code changes (pure configuration)

---

## 🚀 Ready to Continue?

Phase 3 foundation is solid. Next steps:

1. **Run tests** to verify FormService and API logic
2. **Populate database** with task permission rules
3. **Create BPMN files** for actual processes
4. **Test end-to-end** with Camunda integration

---

**Status:** ✅ READY TO CONTINUE  
**Blockers:** None  
**Next Session:** Testing + BPMN creation
