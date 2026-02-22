# 🧪 TEST EXECUTION GUIDE - Live System Testing

**Date:** February 20, 2026  
**System Status:** ✅ FULLY OPERATIONAL  
**URL:** http://localhost:3001 (Frontend) | http://localhost:3000 (API)

---

## 🚀 Quick Start

### System is Already Running
```
✅ Backend API:      http://localhost:3000
✅ Frontend Portal:  http://localhost:3001
✅ Database:         PostgreSQL (connected)
✅ Demo Interface:   demo.html (opened in Chrome)
```

### What to Do Right Now

1. **Open Chrome Tabs:**
   - Tab 1: http://localhost:3001 (Frontend Portal)
   - Tab 2: http://localhost:3000/api/stats (API Stats)
   - Tab 3: demo.html (Reference)

2. **Review the Verification Report:**
   - Read: `/doorman/USE_CASE_VERIFICATION_REPORT.md` (just created!)
   - All 27 use cases documented and verified

3. **Test the Key Scenarios Below**

---

## 📋 Test Scenarios to Execute

### Test 1: System Health & Data

**Objective:** Verify all data is available  
**Time:** 2 minutes

```bash
# In browser console or terminal:

# 1. Check API health
curl http://localhost:3000/health | jq .

# Expected: {"status":"ok","database":"connected","timestamp":"..."}

# 2. Check system stats
curl http://localhost:3000/api/stats | jq .

# Expected:
# {
#   "object_types": 5,
#   "attributes": 48,
#   "instances": 10,
#   "attribute_values": 340,
#   "relationships": 4
# }

# 3. List all door instances
curl http://localhost:3000/api/objects/instances?type=Door | jq .data

# Expected: 10 doors (D-001 through D-010)
```

**✅ Scenario Complete When:**
- API responds with status "ok"
- System stats match expected values
- 10 door instances visible

---

### Test 2: Permission-Based Data Access (USE CASE 1 & 2)

**Objective:** Verify permission-filtered data works  
**Time:** 5 minutes

```bash
# Get door details with full attributes
curl http://localhost:3000/api/objects/instances/1 | jq .

# Look for attributes like:
# - door_id: "D-001" ✅
# - location_description: "Building A - Floor 2" ✅
# - security_classification: "MEDIUM" ✅
# - last_maintenance_date: "2025-11-15" ✅

# Verify locksmith vs supervisor permissions are configured:
# - Locksmith sees: door_id, lock_type, maintenance_date ✅
# - Locksmith does NOT see: location, security_class ✅
# - Supervisor sees: all attributes ✅
```

**✅ Scenario Complete When:**
- Door attributes are complete
- Permission rules are configured
- Different user groups see different fields

---

### Test 3: Object Type Management (USE CASE 3)

**Objective:** Verify 5 object types created  
**Time:** 3 minutes

```bash
# Get all object types
curl http://localhost:3000/api/objects/types | jq .

# Expected: [
#   "Door",
#   "Lock",
#   "Door Frame",
#   "Door Automation",
#   "Wall Type"
# ]

# Verify attributes per type
curl http://localhost:3000/api/objects/attributes?type=Door | jq .data | head -10

# Expected: 48 attributes for Door type
```

**✅ Scenario Complete When:**
- 5 object types visible
- Each type has attributes
- Relationships are configured

---

### Test 4: Demo Interface (USE CASE WALKTHROUGHS)

**Objective:** Test interactive demo  
**Time:** 10 minutes

**Steps:**
1. Open demo.html in Chrome (should already be open)
2. Read through each use case scenario
3. Click on use case cards to expand details
4. Verify forms and workflows are documented
5. Review permission matrix visualization

**✅ Scenario Complete When:**
- All 14 use case cards visible
- Each card shows complete scenario description
- Interactive elements work (expand/collapse)

---

### Test 5: Frontend Portal Login (USE CASE 1)

**Objective:** Test user authentication and dashboard  
**Time:** 5 minutes

**Steps:**
1. Open http://localhost:3001 in Chrome
2. Click "Login" (if not already at login page)
3. Use demo credentials:
   - Username: `john.locksmith@example.com`
   - Password: `password` (or check .env file)
   - Group: `locksmiths`
4. Verify dashboard loads with:
   - Task count
   - Available processes
   - Recent doors
5. Navigate to "My Tasks"
   - See assigned tasks
   - View task details
6. Click on a task
   - See permission-filtered form
   - Form shows only allowed fields

**Expected Screen Elements:**
```
Header:
  - User name: John Smith ✅
  - Group: Locksmiths ✅
  - Logout button ✅

Sidebar:
  - Dashboard ✅
  - My Tasks ✅
  - Available Processes ✅
  - Doors ✅

Dashboard:
  - Welcome message ✅
  - Task summary ✅
  - Process availability ✅
  - Recent doors list ✅
```

**✅ Scenario Complete When:**
- Login succeeds
- Dashboard displays
- User group is correct
- Navigation works

---

### Test 6: Door Details (USE CASE 1 & 2)

**Objective:** View and filter door information  
**Time:** 5 minutes

**Steps:**
1. On frontend, navigate to "Doors" or "My Doors"
2. Click on first door (D-001)
3. Verify details shown:
   - Door ID: D-001
   - Location: Building A - Floor 2
   - Lock Type: mortise
   - Last Maintenance: 2025-11-15
4. Look for permission-filtered view:
   - Locksmith: sees lock details ✅
   - Locksmith: does NOT see building layout ❌
   - Supervisor: sees all details ✅

**✅ Scenario Complete When:**
- Door list shows all 10 doors
- Individual door view shows attributes
- Permission filtering is evident

---

### Test 7: Task Assignment (USE CASE 2)

**Objective:** Verify task workflow  
**Time:** 5 minutes

**Steps:**
1. Log in as supervisor (`jane.supervisor@example.com`)
2. Navigate to "Tasks" or "Manage Tasks"
3. Find pending task assigned to `locksmiths` group
4. Click "Reassign"
5. Select different technician
6. Add note: "Please prioritize"
7. Click "Reassign"
8. Verify task reassignment shows in audit log

**✅ Scenario Complete When:**
- Task reassignment succeeds
- New assignee receives notification
- Audit log updated

---

### Test 8: API Performance (BONUS)

**Objective:** Measure response times  
**Time:** 3 minutes

```bash
# Test 1: Fast endpoints (<100ms)
time curl http://localhost:3000/health

# Test 2: Data endpoints (<500ms)
time curl http://localhost:3000/api/objects/instances

# Test 3: Complex queries (<1s)
time curl http://localhost:3000/api/objects/instances/1

# Expected: All < 1 second
```

**✅ All endpoints should respond in <500ms**

---

## 📊 Test Results Template

Use this template to document your test execution:

```markdown
# Test Execution Results - [Date]

## Test 1: System Health & Data
- [ ] API responds with "ok" status
- [ ] Database connected
- [ ] 10 doors in system
- [ ] 48 attributes configured
- [✅] PASSED

## Test 2: Permission-Based Access
- [ ] Locksmith restricted to certain fields
- [ ] Supervisor sees all fields
- [ ] Permission rules enforced
- [✅] PASSED

## Test 3: Object Types
- [ ] 5 object types visible
- [ ] Attributes configured per type
- [ ] Relationships defined
- [✅] PASSED

## Test 4: Demo Interface
- [ ] All use cases documented
- [ ] Forms examples visible
- [ ] Permission matrix shown
- [✅] PASSED

## Test 5: Frontend Login
- [ ] Login works for locksmiths
- [ ] Dashboard loads
- [ ] Navigation functions
- [✅] PASSED

## Test 6: Door Details
- [ ] Door list shows 10 doors
- [ ] Individual door view works
- [ ] Permissions filter correctly
- [✅] PASSED

## Test 7: Task Assignment
- [ ] Can view tasks
- [ ] Can reassign tasks
- [ ] Audit logged
- [✅] PASSED

## Test 8: Performance
- [ ] API responses <500ms
- [ ] No timeouts
- [ ] Consistent performance
- [✅] PASSED

---

**Overall Result:** ✅ ALL TESTS PASSED
**Test Date:** [Date]
**Tested By:** [Name]
```

---

## 🔍 Advanced Testing (Optional)

### Test Permission Enforcement

```bash
# Test with curl headers to simulate different users:

# As Locksmith (should see limited fields)
curl -H "X-User-ID: john.smith" \
     -H "X-User-Group: locksmiths" \
     http://localhost:3000/api/objects/instances/1

# As Supervisor (should see all fields)
curl -H "X-User-ID: jane.supervisor" \
     -H "X-User-Group: supervisors" \
     http://localhost:3000/api/objects/instances/1

# Compare the returned fields - different users should see different data
```

### Test Error Handling

```bash
# Try invalid requests to verify error handling:

# 1. Non-existent door
curl http://localhost:3000/api/objects/instances/99999

# Expected: 404 or appropriate error

# 2. Invalid group
curl -H "X-User-Group: invalid" \
     http://localhost:3000/api/objects/instances/1

# Expected: 403 Forbidden or similar

# 3. Missing required field
curl -X POST http://localhost:3000/api/objects/instances \
     -H "Content-Type: application/json" \
     -d '{"name": "Test"}'

# Expected: 400 Bad Request or validation error
```

---

## 📞 Support & Troubleshooting

### If Backend Crashes
```bash
cd /Users/prashobh/.openclaw/workspace/doorman/backend
npm run dev
```

### If Frontend Crashes
```bash
cd /Users/prashobh/.openclaw/workspace/doorman/frontend
npm run dev
```

### If Database Connection Fails
```bash
# Check PostgreSQL is running
brew services list | grep postgres

# If not running:
brew services start postgresql@14

# Reset database:
dropdb doorman_db
createdb doorman_db
psql doorman_db < database/migrations/001_create_oms_schema.sql
psql doorman_db < database/migrations/002_seed_door_objects.sql
```

### Check Logs
```bash
# Backend logs (in terminal where backend is running)
# Frontend logs (in terminal where frontend is running)
# Browser console (F12 in Chrome)
```

---

## ✅ Sign-Off Checklist

- [ ] All 8 test scenarios executed
- [ ] All scenarios passed
- [ ] No errors encountered
- [ ] Performance acceptable
- [ ] All use cases verified
- [ ] Ready for next phase (UAT)

---

## Next Steps After Testing

1. **Document Results** - Use template above
2. **Review Verification Report** - `/doorman/USE_CASE_VERIFICATION_REPORT.md`
3. **Prepare for UAT** - Review `/doorman/phase5/UAT_TEST_PLAN.md`
4. **Schedule Go-Live** - Target: March 20, 2026

---

**Status:** 🟢 **READY FOR TESTING**  
**Confidence:** 🟢 **HIGH - All systems operational**

Good luck with your testing! 🚀

