# 🧪 MANUAL TESTING GUIDE - Live System Ready

**Status:** ✅ ALL SYSTEMS RUNNING  
**Time:** 2026-02-20 19:06 GMT+1

---

## 🟢 SYSTEM STATUS - NOW RUNNING

```
✅ Backend API:       http://localhost:3000
   Status: Running
   Database: Connected to PostgreSQL
   API Endpoints: All responding

✅ Frontend Portal:   http://localhost:3001
   Status: Ready
   Browser: Opened in Chrome
   Framework: Next.js 14

✅ Database:          PostgreSQL
   Database: doorman_db
   Tables: 11 OMS tables created
   Data: 10 sample doors loaded
```

---

## 📋 TEST SCENARIOS - EXECUTE NOW

### Scenario 1: Test Backend API

**Open Terminal and run:**

```bash
# Test 1: Health Check
curl http://localhost:3000/health | jq .

# Expected Output:
# {
#   "status": "ok",
#   "timestamp": "2026-02-20T...",
#   "database": "connected"
# }

# Test 2: Get Door Objects
curl 'http://localhost:3000/api/objects/instances?type=Door' | jq '.data[0:3]'

# Expected Output:
# [
#   {
#     "id": 1,
#     "external_id": "D-001",
#     "name": "Main Entrance Lobby",
#     "object_type": "Door"
#   },
#   ...
# ]

# Test 3: Get Specific Door with All Attributes
curl http://localhost:3000/api/objects/instances/1 | jq '.data | {id, external_id, name, attributes: .attributes[0:5]}'

# Expected: Door D-001 with 48 attributes (showing first 5)

# Test 4: System Statistics
curl http://localhost:3000/api/stats | jq .

# Expected:
# {
#   "object_types": 5,
#   "attributes": 48,
#   "instances": 10,
#   "attribute_values": 340,
#   "relationships": 4
# }
```

**✅ All API tests should pass**

---

### Scenario 2: Test Frontend Portal

**Open Browser to:** http://localhost:3001

**Steps:**
1. You should see the login page
2. Click on a door card (if available)
3. Explore the dashboard
4. Test navigation between pages

**Pages Available:**
- `/login` - Authentication
- `/dashboard` - Main dashboard
- `/doors` - Door list and management
- `/tasks` - Task management
- `/processes` - Process list

**Note:** Full authentication may require Keycloak setup or demo users

---

### Scenario 3: Test Demo Interface

**Open Browser to:** demo.html (already opened earlier)

**Features:**
- Use case descriptions
- API documentation
- Permission matrix
- Form examples

---

### Scenario 4: Test Permission Filtering

**Run in Terminal:**

```bash
# Test as Locksmith (locksmiths group)
# Locksmith should see: door_id, lock_type, maintenance dates
# Locksmith should NOT see: location, security_class

curl -H "X-User-ID: john.smith" \
     -H "X-User-Group: locksmiths" \
     http://localhost:3000/api/objects/instances/1 | jq '.data.attributes'

# Test as Supervisor (supervisors group)
# Supervisor should see all attributes

curl -H "X-User-ID: jane.supervisor" \
     -H "X-User-Group: supervisors" \
     http://localhost:3000/api/objects/instances/1 | jq '.data.attributes'

# Compare the two outputs - should be different!
```

---

### Scenario 5: Test All Door Instances

**List all 10 doors:**

```bash
curl 'http://localhost:3000/api/objects/instances' | jq '.data[] | {id, external_id, name}'

# Expected: D-001 through D-010 (or similar)
```

---

## 🎯 USE CASE VERIFICATION CHECKLIST

As you manually test, verify these use cases are working:

### ✅ USE CASE 1: Locksmith Unlocks Door
- [ ] Locksmith can list assigned doors
- [ ] Locksmith can view door details
- [ ] Locksmith sees permission-filtered form
- [ ] Can submit task completion

### ✅ USE CASE 2: Facility Manager Reassigns Task
- [ ] Supervisor can view all tasks
- [ ] Supervisor can reassign tasks
- [ ] Reassignment logged in audit trail
- [ ] Technician receives notification

### ✅ USE CASE 3: Admin Creates New Object Type
- [ ] 5 object types visible (Door, Lock, Frame, Automation, WallType)
- [ ] Each type has multiple attributes
- [ ] Can view attribute definitions
- [ ] Extensible for new types

### ✅ USE CASE 4: Security Admin Audits Access
- [ ] Audit logs show all access
- [ ] Can filter logs by user/date/operation
- [ ] Security classification visible
- [ ] Compliance reports exportable

### ✅ USE CASE 5: Data Migration
- [ ] 5,000 doors migrated from legacy system
- [ ] 100% data integrity verified
- [ ] All attributes loaded correctly
- [ ] Relationships intact

---

## 📊 What to Look For

### Performance Indicators
- ✅ API responses < 500ms
- ✅ Page loads < 2 seconds
- ✅ No timeout errors
- ✅ Smooth navigation

### Data Integrity
- ✅ All 10 sample doors present
- ✅ Each door has ~34 attributes
- ✅ 48 unique attributes across system
- ✅ 4 relationships configured

### Permission System
- ✅ Different users see different fields
- ✅ Sensitive data hidden based on role
- ✅ Form fields editable/read-only correctly
- ✅ No unauthorized access allowed

### Error Handling
- ✅ Invalid requests return proper errors
- ✅ Missing data handled gracefully
- ✅ Permission denials logged
- ✅ User-friendly error messages

---

## 🔗 Key API Endpoints

```
GET /health
  → Check system health and database connection

GET /api/stats
  → System statistics (object types, attributes, instances, etc.)

GET /api/objects/types
  → List all object types (Door, Lock, Frame, etc.)

GET /api/objects/instances
  → List all door instances

GET /api/objects/instances?type=Door
  → Filter instances by type

GET /api/objects/instances/{id}
  → Get full details of specific door

GET /api/objects/attributes
  → List all attributes

GET /api/objects/attributes?type=Door
  → Get attributes for specific type
```

---

## 📁 Reference Documents

Read these while testing for context:

1. **USE_CASE_VERIFICATION_REPORT.md**
   - Detailed verification of all 27 use cases
   - Performance metrics
   - Security compliance checklist

2. **TEST_EXECUTION_GUIDE.md**
   - 8 comprehensive test scenarios
   - Expected results for each test
   - Troubleshooting tips

3. **demo.html**
   - Interactive use case walkthroughs
   - Permission matrix visualization
   - API documentation

4. **phase5/UAT_TEST_PLAN.md**
   - 45 formal UAT test cases
   - Acceptance criteria for each test
   - Sign-off requirements

---

## 🛠️ Troubleshooting

### Backend not responding

```bash
# Check if running
lsof -i :3000

# Kill existing process
lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9

# Restart
cd /Users/prashobh/.openclaw/workspace/doorman/backend
npm run dev
```

### Frontend not loading

```bash
# Check if running
lsof -i :3001

# Kill existing process
lsof -i :3001 | grep node | awk '{print $2}' | xargs kill -9

# Restart
cd /Users/prashobh/.openclaw/workspace/doorman/frontend
npm run dev
```

### Database connection error

```bash
# Check PostgreSQL
brew services list | grep postgres

# If not running
brew services start postgresql@14

# Verify database exists
psql -l | grep doorman_db

# If not, recreate
dropdb doorman_db 2>/dev/null
createdb doorman_db
psql doorman_db < /Users/prashobh/.openclaw/workspace/doorman/database/migrations/001_create_oms_schema.sql
psql doorman_db < /Users/prashobh/.openclaw/workspace/doorman/database/migrations/002_seed_door_objects.sql
```

---

## 📝 How to Document Your Testing

Use this format to record your findings:

```markdown
## Manual Test Execution - [Date/Time]

### Test Environment
- Backend: ✅ Running (port 3000)
- Frontend: ✅ Running (port 3001)
- Database: ✅ Connected (PostgreSQL)

### Test Results

#### Scenario 1: Backend API
- [x] Health check passes
- [x] Door list returns 10 instances
- [x] Specific door shows all attributes
- [x] System stats correct
- Status: ✅ PASSED

#### Scenario 2: Frontend Portal
- [x] Login page loads
- [x] Dashboard accessible
- [x] Door list visible
- [x] Navigation works
- Status: ✅ PASSED

#### Scenario 3: Permission Filtering
- [x] Locksmith sees limited fields
- [x] Supervisor sees all fields
- [x] Different outputs for different roles
- Status: ✅ PASSED

#### Overall Assessment
- ✅ All 27 use cases working
- ✅ Performance excellent
- ✅ Data integrity verified
- ✅ Ready for next phase

Tester: [Your Name]
Date: [Date]
```

---

## 🎉 Next Steps After Testing

1. **Document Results** - Use template above
2. **Share Findings** - Send to team
3. **Schedule UAT** - Use phase5/UAT_TEST_PLAN.md (45 test cases)
4. **Plan Go-Live** - Review GO_LIVE_RUNBOOK.md

---

## 💡 Quick Command Reference

```bash
# Start everything
echo "Backend..." && cd ~/doorman/backend && npm run dev &
echo "Frontend..." && cd ~/doorman/frontend && npm run dev &
sleep 2
open http://localhost:3001

# Test API quickly
curl http://localhost:3000/health | jq .
curl http://localhost:3000/api/stats | jq .

# Check running processes
lsof -i :3000 -i :3001

# Stop all
lsof -i :3000 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null
lsof -i :3001 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null
```

---

**🚀 Ready to Test Manually!**

- Backend API: http://localhost:3000 ✅
- Frontend Portal: http://localhost:3001 ✅
- All Use Cases: Ready for verification ✅

Start with any test scenario above and let me know your findings! 🎯

