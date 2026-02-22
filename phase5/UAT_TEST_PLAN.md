# UAT Test Plan - Doorman System

**Test Execution Date:** Week 1 of Phase 5  
**Test Environment:** UAT (mirrors production)  
**Testers:** 4 users (1 locksmith, 1 supervisor, 1 maintenance tech, 1 admin)  
**Total Test Cases:** 45  
**Expected Duration:** 40 hours (5 days)

## Test Categories

- **Happy Path (20 cases):** Core workflows for each persona
- **Error Scenarios (15 cases):** Validation, auth, network errors
- **Edge Cases (10 cases):** Concurrent access, boundary conditions

---

## HAPPY PATH TESTS (20 Cases)

### Locksmith Workflows (5 Cases)

#### TC-001: Login & Dashboard Access
**Precondition:** User `john.locksmith@doorman.local` exists  
**Steps:**
1. Navigate to login page
2. Enter username: `john.locksmith@doorman.local`
3. Enter password: `locksmith123`
4. Click "Login"
5. Verify dashboard loads

**Expected Result:**
- ✅ Dashboard displays
- ✅ User name "John Locksmith" shown in header
- ✅ Locksmiths group displayed in user menu
- ✅ Task list shows only tasks assigned to locksmiths
- ✅ Nav menu shows: Doors, Processes, Tasks

**Test Data:**
```json
{
  "username": "john.locksmith@doorman.local",
  "password": "locksmith123",
  "group": "locksmiths",
  "permissions": ["door_unlock", "door_inspect"]
}
```

---

#### TC-002: View Available Tasks
**Precondition:** Logged in as locksmith; 3+ door-unlock tasks created in Camunda

**Steps:**
1. From dashboard, view "Your Tasks" section
2. Verify task list displays
3. Click on first task to view details
4. Verify form displays with permission-filtered fields

**Expected Result:**
- ✅ Task list shows 3+ "Select Door" tasks
- ✅ Each task has: ID, status, priority, assignment
- ✅ Task detail shows form with fields:
  - door_id (required, text)
  - access_reason (required, enum: emergency/scheduled/maintenance)
  - priority_level (optional, enum: low/medium/high)
- ✅ Fields are editable (locksmith has WRITE permission)
- ✅ Audit trail shows this is a read event

**Data:**
- Task IDs: task-door-unlock-001, task-door-unlock-002, task-door-unlock-003
- Status: ACTIVE, PENDING, IN_PROGRESS

---

#### TC-003: Complete Door Unlock Task
**Precondition:** TC-002 passed; task in progress state

**Steps:**
1. Fill form:
   - door_id: "D-001"
   - access_reason: "emergency"
   - priority_level: "high"
2. Click "Submit" button
3. Verify success message
4. Verify task status changes to COMPLETED
5. View audit log entry

**Expected Result:**
- ✅ Form validates successfully
- ✅ Success notification: "Task submitted successfully"
- ✅ Task status → COMPLETED
- ✅ Next task available (Inspect task)
- ✅ Audit log entry created:
  - User: john.locksmith
  - Action: form_submitted
  - Task: door-unlock
  - Door: D-001
  - Timestamp: current time

**Database Check:**
```sql
SELECT * FROM audit_log 
WHERE user_id = (SELECT id FROM users WHERE email = 'john.locksmith@doorman.local')
ORDER BY timestamp DESC LIMIT 1;
-- Should show form_submitted for door D-001
```

---

#### TC-004: Search & Filter Doors (Read Permission)
**Precondition:** Logged in as locksmith; 100+ doors in database

**Steps:**
1. Navigate to Doors page
2. Search for "D-001"
3. Verify search results show doors starting with "D-001"
4. Click door to view details
5. Verify locksmith can READ all attributes but WRITE none

**Expected Result:**
- ✅ Search returns 5-10 doors matching "D-001"
- ✅ Door detail displays all attributes as read-only:
  - door_id
  - fire_class
  - security_class
  - lock_type
  - location
  - installed_date
  - last_maintenance
- ✅ No Edit button shown (no WRITE permission)
- ✅ View is consistent across all 100+ doors

**Permission Check:**
- Locksmith has: READ on door attributes
- Locksmith does NOT have: WRITE, DELETE

---

#### TC-005: View Audit Trail on Door
**Precondition:** Door D-001 has 10+ audit entries; logged in as locksmith

**Steps:**
1. Navigate to door D-001 detail page
2. Scroll to "Audit Trail" section
3. Verify entries are sorted by timestamp DESC
4. Click on entry to expand details
5. Verify locksmith can only see entries where they have READ access

**Expected Result:**
- ✅ 10+ audit entries displayed
- ✅ Each entry shows: timestamp, user, action, field changes
- ✅ Entries sorted newest first
- ✅ Locksmith sees only changes to fields they can read:
  - lock_type changes ✅
  - access_history entries ✅
  - Security logs (if READ permission) ✅
- ✅ Entries they can't read are filtered out

---

### Supervisor Workflows (5 Cases)

#### TC-006: Login as Supervisor
**Precondition:** User `jane.supervisor@doorman.local` exists

**Steps:**
1. Logout if necessary
2. Login as jane.supervisor@doorman.local / supervisor123
3. Verify dashboard loads

**Expected Result:**
- ✅ Dashboard shows "Jane Supervisor"
- ✅ Nav menu shows: Doors, Processes, Tasks, Reports
- ✅ Task list shows supervisor-specific tasks
- ✅ Can see tasks from multiple groups (supervisor role)

---

#### TC-007: Approve Door Unlock Task (Supervisor)
**Precondition:** Logged in as supervisor; door-unlock task in "Verify" stage (awaiting approval)

**Steps:**
1. View Tasks page
2. Find "Verify Door Unlock" task
3. Click task to view form
4. Form shows:
   - door_id (read-only): "D-001"
   - access_reason (read-only): "emergency"
   - verification_status (required): [Approved/Denied/Escalate]
   - notes (optional): text field
5. Select "Approved"
6. Enter notes: "Verified, door is secure"
7. Submit

**Expected Result:**
- ✅ Form displays with permission filtering (supervisor can WRITE verification_status)
- ✅ Form validation passes
- ✅ Task moves to COMPLETED
- ✅ Next task assigned to maintenance (Schedule Maintenance)
- ✅ Audit log: supervisor_approved, door D-001

---

#### TC-008: Create New Door (Supervisor Permission)
**Precondition:** Logged in as supervisor; has CREATE permission on doors

**Steps:**
1. Navigate to Doors page
2. Click "+ New Door" button
3. Fill form:
   - Door ID: "D-9999"
   - Name: "Test Door"
   - Fire Class: "EI60"
   - Security Class: "MEDIUM"
   - Lock Type: "MORTICE"
   - Location: "Building A, Floor 2"
4. Submit form
5. Verify door created and displayed in list

**Expected Result:**
- ✅ Form displays all required fields
- ✅ Form validates (door_id unique check)
- ✅ Success message: "Door created successfully"
- ✅ Door appears in list
- ✅ Audit log: created_door, D-9999, supervisor
- ✅ Door instance in database with all attributes

---

#### TC-009: Edit Door Attributes (Supervisor)
**Precondition:** Logged in as supervisor; door D-001 exists; supervisor has WRITE on door attributes

**Steps:**
1. Navigate to door D-001
2. Click "Edit" button
3. Change attributes:
   - fire_class: "EI30" → "EI90"
   - security_class: "MEDIUM" → "HIGH"
   - last_maintenance: [set to today]
4. Click "Save Changes"
5. Verify changes persisted
6. Check audit trail

**Expected Result:**
- ✅ Edit form loads with current values
- ✅ All editable fields are enabled
- ✅ Save button is active
- ✅ Success message: "Changes saved successfully"
- ✅ Door detail reflects new values
- ✅ Audit log entry:
  ```
  User: jane.supervisor
  Action: updated_attributes
  Door: D-001
  Changes: {
    "fire_class": { "old": "EI30", "new": "EI90" },
    "security_class": { "old": "MEDIUM", "new": "HIGH" },
    "last_maintenance": { "old": "2024-01-01", "new": "2026-02-20" }
  }
  ```

---

#### TC-010: View Reports (Supervisor)
**Precondition:** Logged in as supervisor; 100+ processes completed

**Steps:**
1. Navigate to Reports page (if available)
2. View process completion metrics
3. View door unlock success rate
4. View average task completion time
5. Filter by date range (last 30 days)

**Expected Result:**
- ✅ Dashboard displays key metrics:
  - Total processes: 500+
  - Completed: 450+
  - In progress: 30
  - Failed/escalated: 20
- ✅ Success rate: 90%+
- ✅ Avg task time: <2 hours
- ✅ By process type breakdown
- ✅ Filterable by date range

---

### Maintenance Tech Workflows (5 Cases)

#### TC-011: Login as Maintenance Tech
**Precondition:** User `mike.maintenance@doorman.local` exists

**Steps:**
1. Logout if necessary
2. Login as mike.maintenance@doorman.local / maintenance123
3. Verify dashboard

**Expected Result:**
- ✅ Dashboard shows "Mike Maintenance"
- ✅ Maintenance-specific tasks shown
- ✅ Can see scheduled maintenance tasks
- ✅ Can see door condition information (if READ permission)

---

#### TC-012: View Scheduled Maintenance Tasks
**Precondition:** Logged in as maintenance tech; 5+ scheduled maintenance tasks exist

**Steps:**
1. View Tasks page
2. Filter tasks by type: "door-maintenance"
3. Verify list shows:
   - Task ID
   - Door ID
   - Scheduled Date
   - Task Status
   - Priority
4. Click on task to view details

**Expected Result:**
- ✅ 5+ maintenance tasks displayed
- ✅ Sorted by scheduled date (ascending)
- ✅ Status shows: PENDING, ACTIVE, OVERDUE
- ✅ Task detail shows form with fields:
  - door_id (read-only)
  - maintenance_type: (enum: inspection/repair/replacement)
  - parts_needed: (optional, text)
  - estimated_hours: (number, optional)

---

#### TC-013: Complete Maintenance Task
**Precondition:** TC-012 passed; task in ACTIVE state

**Steps:**
1. Open maintenance task
2. Fill form:
   - maintenance_type: "inspection"
   - parts_needed: "Hinges need adjustment"
   - estimated_hours: "1.5"
   - completion_notes: "Inspection complete, hinges adjusted, lock tested"
3. Submit

**Expected Result:**
- ✅ Form validates
- ✅ Task → COMPLETED
- ✅ Door attributes updated if applicable
- ✅ Audit log entry created
- ✅ Supervisor notified (if configured)

---

#### TC-014: View Door Maintenance History
**Precondition:** Door D-001 has 5+ maintenance records

**Steps:**
1. Navigate to door D-001 detail
2. View "Maintenance History" section
3. Verify all records displayed with:
   - Date
   - Technician
   - Type
   - Description
   - Time spent

**Expected Result:**
- ✅ 5+ records shown, sorted by date DESC
- ✅ All maintenance records from past 2 years visible
- ✅ Total maintenance time calculated: 8.5 hours
- ✅ Next scheduled maintenance date shown

---

#### TC-015: Update Door Condition Status
**Precondition:** Logged in as maintenance; editing door D-001

**Steps:**
1. Go to door D-001 edit page
2. Update:
   - condition_status: "Good" → "Fair"
   - estimated_replacement_year: 2030 → 2028
3. Add maintenance note: "Hinges showing wear"
4. Save

**Expected Result:**
- ✅ Fields update in database
- ✅ Audit trail captures changes
- ✅ Supervisor may receive alert if condition degrades

---

### Admin Workflows (5 Cases)

#### TC-016: Admin Login
**Precondition:** User `admin@doorman.local` exists with admin role

**Steps:**
1. Login as admin@doorman.local / admin123
2. Verify dashboard loads

**Expected Result:**
- ✅ Dashboard shows "Admin"
- ✅ Nav menu shows: Users, Permissions, Processes, Doors, Reports, Settings
- ✅ Can access all areas

---

#### TC-017: Manage User Permissions
**Precondition:** Logged in as admin; user john.locksmith exists

**Steps:**
1. Navigate to Users page
2. Find john.locksmith
3. View permissions:
   - Current groups: locksmiths
   - Current permissions: door_unlock, door_inspect (READ on door, WRITE on lock_type)
4. Add to group: "supervisors"
5. Verify permissions merged correctly

**Expected Result:**
- ✅ User now in both groups: locksmiths, supervisors
- ✅ Permissions merged (UNION of visible, INTERSECTION of editable)
- ✅ John can now see supervisor tasks
- ✅ John can edit fields where BOTH groups have WRITE
- ✅ Audit log: admin_modified_permissions

---

#### TC-018: Configure Process Permissions
**Precondition:** Logged in as admin; door-unlock process exists

**Steps:**
1. Navigate to Processes admin page
2. Select "door-unlock" process
3. View task permission rules:
   - "Select Door" task: visible to all, writable by locksmiths
   - "Inspect" task: visible to locksmiths/supervisors, writable by supervisors
   - "Verify" task: visible to supervisors/admin, writable by supervisors
4. Modify rule: "Inspect" task → add maintenance group as readable
5. Save

**Expected Result:**
- ✅ Permission rule updated in database
- ✅ Maintenance techs can now see "Inspect" task
- ✅ But cannot write (no WRITE permission)
- ✅ Audit log: updated_task_permission

---

#### TC-019: View System Audit Log
**Precondition:** Logged in as admin; 100+ audit entries exist

**Steps:**
1. Navigate to Admin → Audit Log
2. View entries with filtering:
   - Filter by user: jane.supervisor
   - Filter by action: form_submitted
   - Filter by date: last 7 days
3. View entry details
4. Export audit log as CSV

**Expected Result:**
- ✅ All filters work
- ✅ Show 20 entries matching criteria
- ✅ Entry detail includes: timestamp, user, action, resource, changes
- ✅ CSV export includes all columns
- ✅ 100+ total entries searchable

---

#### TC-020: Configure System Settings
**Precondition:** Logged in as admin

**Steps:**
1. Navigate to Settings
2. View configuration:
   - Session timeout: 60 minutes
   - Max login attempts: 5
   - Password expiry: 90 days
   - Audit retention: 2 years
3. Change: Session timeout → 120 minutes
4. Save

**Expected Result:**
- ✅ All settings display with current values
- ✅ Change persists
- ✅ New sessions use updated timeout
- ✅ Audit log: settings_changed

---

## ERROR SCENARIO TESTS (15 Cases)

### Authentication Errors (3 Cases)

#### TC-021: Invalid Login Credentials
**Steps:**
1. Navigate to login
2. Enter: username: john.locksmith@doorman.local, password: wrongpassword
3. Click Login

**Expected Result:**
- ✅ Error message: "Invalid username or password"
- ✅ User NOT logged in
- ✅ Redirected to login page
- ✅ No sensitive info leaked
- ✅ Login attempt logged (failed)

---

#### TC-022: Session Timeout
**Precondition:** Logged in; session timeout set to 5 minutes

**Steps:**
1. Login successfully
2. Wait 6 minutes without activity
3. Try to access any page (e.g., Doors)

**Expected Result:**
- ✅ Redirected to login page
- ✅ Message: "Your session has expired. Please log in again."
- ✅ Previous page not accessible
- ✅ Login required to continue

---

#### TC-023: Token Refresh on API Error
**Precondition:** Logged in; token approaching expiry

**Steps:**
1. Make API call (e.g., load doors)
2. System detects token near expiry
3. Silently refresh token
4. Retry API call

**Expected Result:**
- ✅ Token refreshed in background
- ✅ API call succeeds (user doesn't see error)
- ✅ New token stored in session
- ✅ User continues uninterrupted

---

### Validation Errors (4 Cases)

#### TC-024: Required Field Validation
**Precondition:** In door-unlock task form

**Steps:**
1. Leave door_id empty (required field)
2. Leave access_reason empty (required field)
3. Click Submit

**Expected Result:**
- ✅ Form does NOT submit
- ✅ Error messages shown:
  - door_id: "This field is required"
  - access_reason: "This field is required"
- ✅ Fields highlighted in red
- ✅ Focus moved to first error

---

#### TC-025: Invalid Enum Value
**Precondition:** In door edit form

**Steps:**
1. Try to enter invalid fire_class value (e.g., "EI99" via API)
2. Submit form

**Expected Result:**
- ✅ Server rejects: "Invalid enum value. Must be one of: EI30, EI60, EI90, EI120"
- ✅ Form NOT submitted
- ✅ User sees error message
- ✅ Can correct and retry

---

#### TC-026: Duplicate Door ID
**Precondition:** Door D-001 exists; creating new door

**Steps:**
1. Create new door form
2. Enter door_id: "D-001" (already exists)
3. Submit

**Expected Result:**
- ✅ Server validation fails: "Door ID already exists"
- ✅ Form not submitted
- ✅ Error message displays
- ✅ Suggestion to edit existing or use different ID

---

#### TC-027: Number Range Validation
**Precondition:** In maintenance form with estimated_hours field (0-100)

**Steps:**
1. Enter estimated_hours: "200"
2. Submit

**Expected Result:**
- ✅ Server rejects: "Must be between 0 and 100"
- ✅ Form not submitted
- ✅ Error shown to user

---

### Permission & Access Errors (4 Cases)

#### TC-028: Insufficient Permission - Read Denied
**Precondition:** Locked-in as locksmith (limited READ permissions on doors)

**Steps:**
1. Try to access admin door (with restricted visibility)
2. Navigate to door by direct URL

**Expected Result:**
- ✅ 403 Forbidden error
- ✅ Message: "You do not have permission to view this door"
- ✅ User redirected to Doors list
- ✅ Admin can view (has READ permission)

---

#### TC-029: Insufficient Permission - Write Denied
**Precondition:** Locksmith viewing door D-001; locksmith has READ but not WRITE

**Steps:**
1. Go to door D-001 edit page
2. Try to change fire_class
3. Submit

**Expected Result:**
- ✅ Edit button not shown (locksmith sees read-only view)
- ✅ If trying to edit via API, rejected: "Insufficient permission to modify door"
- ✅ Changes NOT persisted

---

#### TC-030: Task Visibility Based on Permission
**Precondition:** Locksmith logged in; "Verify" task (supervisor-only)

**Steps:**
1. Go to Tasks page
2. Look for "Verify Door Unlock" task

**Expected Result:**
- ✅ Task not listed (not visible to locksmith)
- ✅ If trying to access via direct URL, redirected with error
- ✅ Supervisor can see task

---

#### TC-031: Multi-Group Permission Merging
**Precondition:** User in 2 groups (locksmiths + supervisors)

**Steps:**
1. User has different permissions in each group
2. User tries to access resource
3. Verify permission logic:
   - Visible = UNION of groups' READ permissions
   - Editable = INTERSECTION of groups' WRITE permissions

**Expected Result:**
- ✅ User sees union of all resources from both groups
- ✅ Can edit only fields where BOTH groups have WRITE
- ✅ Can read fields where either group has READ

---

### Network & API Errors (4 Cases)

#### TC-032: Network Timeout - Automatic Retry
**Precondition:** Loading door list; API takes 10 seconds

**Steps:**
1. Load Doors page
2. Network connection slow/flaky
3. System retries 3 times
4. Connection recovers on retry 2

**Expected Result:**
- ✅ Loading spinner shown
- ✅ Automatic retry (exponential backoff)
- ✅ Data loads successfully on retry
- ✅ User sees no error
- ✅ No manual refresh needed

---

#### TC-033: Server Error 500
**Precondition:** API call returns 500 Internal Server Error

**Steps:**
1. Create new door (triggers server error)
2. Submit form

**Expected Result:**
- ✅ Error message: "Server error occurred. Please try again."
- ✅ Form not submitted
- ✅ User can retry
- ✅ Error logged on server for debugging

---

#### TC-034: API Rate Limiting (429 Too Many Requests)
**Precondition:** User makes 200 API calls in 1 minute (limit: 100/min)

**Steps:**
1. Rapid-fire API calls
2. Hit rate limit at call 101

**Expected Result:**
- ✅ 429 error returned
- ✅ Message: "Too many requests. Please try again in X seconds"
- ✅ Client backs off
- ✅ Retry after delay succeeds

---

#### TC-035: Database Connection Lost
**Precondition:** Logged in; database goes down mid-request

**Steps:**
1. Load doors page
2. Database connection lost
3. Retry request

**Expected Result:**
- ✅ Error message: "Database unavailable. Please try again."
- ✅ Page shows error state with retry button
- ✅ Admin alerted to database issue
- ✅ After DB recovery, page works again

---

## EDGE CASE TESTS (10 Cases)

#### TC-036: Concurrent Task Submission
**Precondition:** User submits same task form twice simultaneously

**Steps:**
1. Open task form
2. Rapidly click Submit button twice
3. Both requests sent to server

**Expected Result:**
- ✅ First submission processed
- ✅ Second submission rejected: "Task already completed"
- ✅ No duplicate records
- ✅ User sees error on second submission

---

#### TC-037: Large Data Set Performance (10,000+ doors)
**Precondition:** Database has 10,000 doors

**Steps:**
1. Load Doors list page
2. Paginate through all results
3. Search for specific door
4. Filter by attributes

**Expected Result:**
- ✅ Page loads in <2 seconds with pagination
- ✅ Each page shows 10 doors
- ✅ Search returns results in <1 second
- ✅ Filter works efficiently

---

#### TC-038: Audit Trail with 100,000+ Entries
**Precondition:** System has accumulated 100,000+ audit entries over 1 year

**Steps:**
1. Load audit log page
2. Filter by user/action/date
3. Export filtered results

**Expected Result:**
- ✅ Page loads in <2 seconds
- ✅ Filters work efficiently
- ✅ Export completes in <5 seconds
- ✅ No memory issues

---

#### TC-039: Attribute Value Edge Cases
**Precondition:** Editing door attributes

**Steps:**
1. Enter special characters in text fields:
   - Name: "Door #123 @ Building A & B"
   - Notes: "Access <restricted> [Security]"
2. Submit

**Expected Result:**
- ✅ Special characters properly escaped
- ✅ No injection attacks possible
- ✅ Data stored and retrieved correctly
- ✅ No XSS vulnerabilities

---

#### TC-040: Very Long Text Input
**Precondition:** In maintenance notes field (max 1000 chars)

**Steps:**
1. Paste 2000 characters of text
2. Try to submit

**Expected Result:**
- ✅ Input limited to 1000 characters
- ✅ User notified: "Maximum 1000 characters"
- ✅ Excess text not submitted

---

#### TC-041: Timezone Handling
**Precondition:** System records tasks/dates; testers in different timezones

**Steps:**
1. Tester in UTC+1 creates task
2. Tester in UTC-5 views audit log
3. Verify timestamps are consistent

**Expected Result:**
- ✅ All timestamps stored in UTC
- ✅ Displayed in user's local timezone
- ✅ UTC+1 sees: "2026-02-20 16:55 CET"
- ✅ UTC-5 sees: "2026-02-20 10:55 EST"
- ✅ Both refer to same instant

---

#### TC-042: Deleted Door Still Referenced
**Precondition:** Delete door D-999; task references deleted door

**Steps:**
1. Delete door D-999
2. View audit trail for that door

**Expected Result:**
- ✅ Door marked as deleted (soft delete)
- ✅ Audit trail still accessible
- ✅ Task shows reference to deleted door
- ✅ Historical data intact

---

#### TC-043: Circular References Prevention
**Precondition:** Creating door relationships

**Steps:**
1. Try to create circular reference:
   - Door A → Lock B
   - Lock B → Door A (circular)
2. System should prevent

**Expected Result:**
- ✅ Circular reference rejected
- ✅ Error message explains issue
- ✅ Database integrity maintained

---

#### TC-044: Multiple Process Instances for Same Door
**Precondition:** Door D-001 has 3 concurrent unlock processes

**Steps:**
1. Start process 1: door-unlock for D-001
2. Start process 2: door-unlock for D-001
3. Start process 3: door-unlock for D-001
4. Complete all processes sequentially

**Expected Result:**
- ✅ All 3 processes run independently
- ✅ No data corruption
- ✅ Audit trail shows all 3 processes
- ✅ Door state consistent

---

#### TC-045: Form Submission with Missing Optional Fields
**Precondition:** Form with optional fields

**Steps:**
1. Leave optional fields empty
2. Fill only required fields
3. Submit

**Expected Result:**
- ✅ Form submits successfully
- ✅ Optional fields stored as NULL in database
- ✅ No validation errors

---

## Test Execution Summary

| Category | Count | Status |
|----------|-------|--------|
| Happy Path | 20 | Ready |
| Error Scenarios | 15 | Ready |
| Edge Cases | 10 | Ready |
| **Total** | **45** | **Ready** |

## Success Criteria

- ✅ 45/45 test cases executed
- ✅ 43+/45 cases passing (2 failures acceptable with root cause doc)
- ✅ No critical bugs found
- ✅ All 4 user personas can complete core workflows
- ✅ Performance acceptable (page loads <2s, API <500ms)
- ✅ Permission system working correctly
- ✅ Audit trail complete and accurate
- ✅ Error messages clear and helpful
- ✅ No data loss or corruption

## UAT Sign-Off

When all 45 tests pass, obtain sign-off from:
- [ ] Locksmith representative
- [ ] Supervisor representative
- [ ] Maintenance tech representative
- [ ] Admin/IT representative
- [ ] Project manager

---

**Ready to execute! Document all results in UAT_TEST_RESULTS.md**
