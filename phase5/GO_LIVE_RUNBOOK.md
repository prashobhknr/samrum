# Go-Live Runbook - Doorman System

**Date:** 2026-02-20 (Scheduled for Saturday, [TBD])  
**Cutover Window:** 02:00 - 06:00 CET (4-hour window)  
**Environment:** Production  
**Team Size:** 7 people

---

## Pre-Go-Live Checklist (1 Week Before)

### Environment Preparation

- [ ] Production database provisioned (RDS/managed PostgreSQL)
- [ ] Production backend server(s) ready (3+ instances)
- [ ] Production frontend CDN configured
- [ ] Load balancer configured and tested
- [ ] SSL/TLS certificates installed and validated
- [ ] Domain DNS configured (doorman.example.com)
- [ ] Monitoring and alerting systems ready
- [ ] Backup systems tested
- [ ] Disaster recovery plan documented
- [ ] Access controls configured (VPN, IP whitelist)

### Data Preparation

- [ ] Production database schema created (all migrations run)
- [ ] 5000+ doors extracted from legacy Samrum
- [ ] Data transformation scripts validated
- [ ] Data migration script tested on backup
- [ ] Data validation checks prepared
- [ ] Rollback procedure tested
- [ ] Final data export from Samrum scheduled

### Application Deployment

- [ ] Docker images built and tested
- [ ] Images pushed to production registry
- [ ] Backend deployment script tested
- [ ] Frontend deployment script tested
- [ ] Camunda processes imported
- [ ] API endpoints responding
- [ ] Frontend loads and authenticates
- [ ] Health checks passing

### User Preparation

- [ ] 4 user groups created in LDAP/Keycloak
- [ ] 8 test users created (2 per group)
- [ ] User documentation distributed
- [ ] Training completed for all 4 groups
- [ ] Help desk trained on common issues
- [ ] Support contact info published

### Communication

- [ ] Go-live date/time announced to organization
- [ ] Stakeholder approval obtained
- [ ] Legacy system shutdown scheduled
- [ ] Off-call developers notified (for on-call)
- [ ] Escalation contacts confirmed
- [ ] Status page URL published

### Testing & Validation

- [ ] Full UAT passed (45/45 test cases)
- [ ] Performance baseline achieved
- [ ] Security audit completed
- [ ] Production-like test in staging
- [ ] Smoke test script prepared
- [ ] Data validation queries prepared
- [ ] Rollback test completed

---

## Go-Live Day Timeline

### 01:30 - Team Assembly

**Location:** Command center (virtual or physical)  
**Participants:**
- [ ] Project Manager (lead)
- [ ] Database Lead
- [ ] Backend Lead
- [ ] Frontend Lead
- [ ] DevOps/SRE (infrastructure)
- [ ] QA Lead (testing)
- [ ] Business Analyst (communication)

**Actions:**
1. [ ] All participants logged in to Slack/Teams
2. [ ] Zoom call established and recording started
3. [ ] Runbook shared and reviewed
4. [ ] Roles and responsibilities confirmed
5. [ ] Escalation contacts verified
6. [ ] Success criteria reviewed

**Checklist:**
```
[ ] Backup of legacy system completed
[ ] Production access credentials verified
[ ] All systems responding
[ ] Rollback procedures accessible
[ ] Monitoring dashboards open
```

---

### 02:00 - Cutover Start

**Duration:** 2 hours (02:00 - 04:00)

#### Phase 1: Pre-Flight Checks (15 minutes, 02:00 - 02:15)

**Database Lead:**
```sql
-- Verify production database connectivity
SELECT version();

-- Confirm all tables created
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 11 tables

-- Verify no data in tables yet
SELECT COUNT(*) FROM object_instances;
-- Expected: 0 rows
```

**Backend Lead:**
```bash
# Verify backend connectivity
curl -X GET http://backend:3001/api/health
# Expected: { "status": "ok" }

# Check logs for errors
docker logs doorman-backend | tail -20
# Expected: No errors

# Verify database connection in backend
curl -X GET http://backend:3001/api/admin/db-status
# Expected: Connected
```

**Frontend Lead:**
```bash
# Verify frontend loading
curl -X GET https://doorman.example.com/
# Expected: 200 OK, HTML loads

# Check error logs
docker logs doorman-frontend | tail -20
# Expected: No errors
```

**DevOps Lead:**
```bash
# Verify monitoring systems
# - Prometheus scraping metrics
# - Grafana dashboards loading
# - Loki receiving logs

# Check backup systems
aws s3 ls s3://doorman-backups/
# Expected: Recent backups present

# Test disaster recovery failover
# (In staging environment)
```

**QA Lead:**
- [ ] Prepare smoke test checklist
- [ ] Open result tracking spreadsheet
- [ ] Verify test credentials for all 4 groups

---

#### Phase 2: Legacy System Shutdown (15 minutes, 02:15 - 02:30)

**Business Analyst:**
1. [ ] Send final notification to organization
   ```
   "Doorman cutover in progress. Legacy Samrum will be offline for 3.5 hours.
    Please save any open work. Support available during cutover window."
   ```

2. [ ] Confirm no active users in legacy system
   ```sql
   -- Check Samrum database for active sessions
   SELECT * FROM active_sessions WHERE logout_time IS NULL;
   -- Expected: 0 rows
   ```

3. [ ] Take final backup of legacy system
   ```bash
   mysqldump -u root -p samrum > /backups/samrum_final_$(date +%s).sql
   ```

4. [ ] Stop legacy system
   ```bash
   systemctl stop samrum-api
   systemctl stop samrum-web
   # Verify stopped
   systemctl status samrum-api samrum-web
   ```

5. [ ] Snapshot legacy database
   ```bash
   aws ec2 create-snapshot \
     --volume-id vol-samrum-data \
     --description "Samrum final snapshot before migration"
   ```

**Result:**
- [ ] Legacy system offline
- [ ] Final backups taken
- [ ] No way back to old system (intentional commitment)

---

#### Phase 3: Data Migration (60 minutes, 02:30 - 03:30)

**Database Lead + Backend Lead:**

**Step 1: Extract Data from Legacy System (10 min)**
```bash
# Export 5000+ doors from Samrum
cd /data-migration
./export-doors-from-samrum.sh > doors_export.json

# Verify export
wc -l doors_export.json
# Expected: 5001 lines (5000 doors + 1 header)

# Sample validation
head -5 doors_export.json | jq '.'
```

**Step 2: Transform Data (10 min)**
```bash
# Transform to OMS schema
node transform.js < doors_export.json > doors_oms.json

# Validate transformation
./validate-transform.sh doors_oms.json
# Expected: 100% success rate (5000/5000 doors)
```

**Step 3: Create Backup (10 min)**
```bash
# Create fresh backup before migration
pg_dump doorman_db > /backups/pre-migration_$(date +%s).sql

# Verify backup size
du -h /backups/pre-migration_*.sql
# Expected: 100MB+ (data from test migration)
```

**Step 4: Run Migration (20 min)**
```bash
# Execute migration script (with transaction, can rollback if needed)
cd /migration
psql doorman_db < migrate.sql

# Monitor progress
watch 'SELECT COUNT(*) FROM object_instances;'
# Should grow from 0 to 5000 over ~20 minutes
```

**Step 5: Validate Data (10 min)**
```sql
-- Run validation queries
SELECT COUNT(*) FROM object_instances;
-- Expected: 5000

SELECT COUNT(*) FROM attribute_values;
-- Expected: 340,000+ (340+ attributes per door)

SELECT object_type_id, COUNT(*) FROM object_instances 
GROUP BY object_type_id;
-- Expected: 5000 Door objects

-- Check for orphaned records
SELECT COUNT(*) FROM attribute_values 
WHERE object_instance_id NOT IN (SELECT id FROM object_instances);
-- Expected: 0

-- Verify audit trail
SELECT COUNT(*) FROM audit_log;
-- Expected: 5000+ entries (one per door created)
```

**Result:**
- [ ] 5000 doors migrated
- [ ] 340,000+ attributes loaded
- [ ] All validation checks passed
- [ ] Backup available for rollback

---

#### Phase 4: System Deployment (30 minutes, 03:30 - 04:00)

**Backend Lead:**
```bash
# 1. Deploy Camunda processes
cd /camunda
./deploy-processes.sh
# Expected: door-unlock.bpmn, door-maintenance.bpmn deployed

# 2. Configure task permission rules
psql doorman_db < /sql/seed-task-permissions.sql

# 3. Start backend service
docker pull doorman-backend:latest
docker service update --image doorman-backend:latest doorman_backend

# 4. Verify backend health
curl -X GET http://backend:3001/api/health
# Expected: { "status": "ok", "uptime": "2m" }

# 5. Check logs
docker logs doorman-backend --tail=50
# Expected: No error level logs
```

**Frontend Lead:**
```bash
# 1. Deploy frontend
docker pull doorman-frontend:latest
docker service update --image doorman-frontend:latest doorman_frontend

# 2. Verify frontend
curl -X GET https://doorman.example.com/
# Expected: 200 OK

# 3. Check assets loaded
curl -X GET https://doorman.example.com/_next/static/
# Expected: 200 OK (static assets)

# 4. Verify login page
curl -s -X GET https://doorman.example.com/login | grep -q "email"
# Expected: Login form present
```

**Result:**
- [ ] Backend responding
- [ ] Camunda processes deployed
- [ ] Frontend loaded and interactive
- [ ] Login page accessible

---

### 04:00 - Go-Live Validation (1 hour)

#### Smoke Test - Tier 1: System Availability

**QA Lead:**
```bash
# 1. Backend API health
curl -X GET http://backend:3001/api/health
# Expected: ✅ 200 OK

# 2. Database connectivity
curl -X GET http://backend:3001/api/admin/db-check
# Expected: ✅ Connected

# 3. Camunda connectivity
curl -X GET http://camunda:8080/engine-rest/deployment
# Expected: ✅ 200 OK

# 4. Frontend accessibility
curl -X GET https://doorman.example.com/
# Expected: ✅ 200 OK

# 5. Monitoring systems
# - Prometheus: ✅ Metrics collected
# - Grafana: ✅ Dashboards loading
# - Loki: ✅ Logs aggregated
```

**Result:** ✅ System online, all components operational

---

#### Smoke Test - Tier 2: Authentication

**QA Lead - Test each user role:**

**Locksmith Test:**
```bash
curl -X POST http://backend:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.locksmith@doorman.local",
    "password": "locksmith123"
  }'
# Expected: ✅ { "token": "..." }

# Access locksmith tasks
curl -X GET http://backend:3001/api/tasks?group=locksmiths \
  -H "Authorization: Bearer TOKEN"
# Expected: ✅ Tasks visible
```

**Supervisor Test:**
```bash
curl -X POST http://backend:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.supervisor@doorman.local",
    "password": "supervisor123"
  }'
# Expected: ✅ { "token": "..." }
```

**Maintenance Test:**
```bash
curl -X POST http://backend:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mike.maintenance@doorman.local",
    "password": "maintenance123"
  }'
# Expected: ✅ { "token": "..." }
```

**Admin Test:**
```bash
curl -X POST http://backend:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@doorman.local",
    "password": "admin123"
  }'
# Expected: ✅ { "token": "..." }
```

**Result:** ✅ All user groups can authenticate

---

#### Smoke Test - Tier 3: Data Access

**QA Lead:**

```bash
# 1. List doors
curl -X GET "http://backend:3001/api/objects?type=door&limit=10" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
# Expected: ✅ 10 doors returned, 5000+ total

# 2. Get single door
curl -X GET "http://backend:3001/api/objects/door/D-001" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
# Expected: ✅ Door D-001 with all attributes

# 3. Generate form for task
curl -X POST "http://backend:3001/api/forms/generate" \
  -H "Authorization: Bearer LOCKSMITH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "door-unlock-select",
    "userId": "john.locksmith@doorman.local"
  }'
# Expected: ✅ Form with permission-filtered fields

# 4. Submit form
curl -X POST "http://backend:3001/api/forms/submit" \
  -H "Authorization: Bearer LOCKSMITH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "door-unlock-select",
    "formData": {
      "door_id": "D-001",
      "access_reason": "test"
    }
  }'
# Expected: ✅ { "submissionId": "..." }

# 5. Check audit log
curl -X GET "http://backend:3001/api/audit-log?limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Expected: ✅ Recent entries showing form submission
```

**Result:** ✅ All 5000 doors accessible, forms submitting, audit trail working

---

#### Frontend Smoke Test

**QA Lead - Via Browser:**

1. [ ] Login as john.locksmith@doorman.local
   - [ ] Dashboard loads
   - [ ] Can view available tasks
   - [ ] Task list shows door-unlock tasks

2. [ ] Navigate to Doors page
   - [ ] Door list loads (first 10 of 5000)
   - [ ] Search works
   - [ ] Can click door to view detail

3. [ ] View door detail (e.g., D-001)
   - [ ] All attributes display
   - [ ] Relationships shown
   - [ ] Audit trail visible
   - [ ] No Edit button (locksmith no WRITE permission)

4. [ ] Login as jane.supervisor@doorman.local
   - [ ] Dashboard loads
   - [ ] Can view supervisor tasks
   - [ ] Processes list shows

5. [ ] Go to Processes page
   - [ ] Process list loads
   - [ ] Can filter by status
   - [ ] Progress indicators show

6. [ ] Logout and login as admin
   - [ ] Can access admin functions
   - [ ] Audit log visible
   - [ ] Settings accessible

**Result:** ✅ Frontend fully operational, permission-based filtering working

---

### 04:30 - First Production Transactions

**Business Analyst:**
1. [ ] Manually create a test process
   - Start door-unlock process for D-001
   - Expected: ✅ Process instance created in Camunda

2. [ ] Complete a task
   - Locksmith selects door D-001
   - Form validates
   - Task marked completed
   - Next task (Inspect) assigned to supervisor

3. [ ] Verify end-to-end flow
   - Audit log shows all actions
   - Database has transaction records
   - No data corruption

4. [ ] User feedback call
   - Quick check-in with each user group
   - "Can you access the system?"
   - Note any immediate issues

**Result:** ✅ First production transactions successful

---

### 05:00 - Stabilization & Monitoring

**DevOps Lead:**
```bash
# 1. Check system metrics
# - CPU: < 30%
# - Memory: < 50%
# - Disk: < 70%
# - Database connections: Normal

# 2. Verify backups started
aws s3 ls s3://doorman-backups/ --recursive
# Expected: Hourly backups beginning

# 3. Check alert system
# - No critical alerts
# - Normal monitoring operational

# 4. Review logs for errors
docker logs doorman-backend | grep -i error | wc -l
# Expected: 0-5 (minor warnings acceptable)

# 5. Performance check
# - API response time: < 500ms
# - DB query time: < 100ms
# - Page load time: < 2s
```

**QA Lead:**
- [ ] Document results from all smoke tests
- [ ] Note any minor issues (to fix in next 24 hours)
- [ ] Confirm cutover success

**Business Analyst:**
- [ ] Send go-live success announcement
  ```
  "🎉 Doorman system is now LIVE!
   
   All 5,000+ doors migrated and operational.
   Users can now access the system at: doorman.example.com
   
   Support team is on standby for issues.
   Thank you for your patience!"
  ```

**Result:** ✅ System stable, first wave of users logging in

---

### 05:30 - Process Handoff to On-Call

**Project Manager:**
1. [ ] Brief on-call team
   - System is live
   - Monitoring alerts active
   - Rollback procedure available
   - Known issues (if any)

2. [ ] Transition responsibilities
   - Dev team: On-call for API issues
   - Frontend team: On-call for UI issues
   - DBA team: On-call for database issues
   - DevOps: On-call for infrastructure

3. [ ] Confirm on-call contacts verified
   - [ ] Phone numbers confirmed
   - [ ] Slack channels monitored
   - [ ] Escalation path understood

**Result:** ✅ Responsibility transferred to 24/7 on-call team

---

### 06:00 - Cutover Window Closes

**Project Manager:**
- [ ] Final all-hands status update
- [ ] Close command center call (but keep on standby)
- [ ] Schedule next sync (after 1 week of monitoring)
- [ ] Celebrate! 🎉

---

## Post-Cutover - First Week (Intensive Monitoring)

### Daily Activities

**Every Morning (08:00):**
```bash
# 1. Check overnight logs
docker logs doorman-backend --since "8 hours ago" | grep -i error
# Expected: Few/no errors

# 2. Review monitoring metrics
# - Check Grafana dashboards
# - Verify performance baseline maintained
# - Note any slow queries

# 3. User feedback
# - Check Slack for complaints/issues
# - Follow up on any bug reports
# - Help desk ticket review

# 4. Database health
SELECT COUNT(*) FROM audit_log;
-- Expected: Growing (more transactions = good)

SELECT COUNT(*) FROM object_instances WHERE deleted_at IS NULL;
-- Expected: 5000 (no doors deleted)

SELECT MAX(timestamp) FROM audit_log;
-- Expected: Current time (recent activity)
```

**Immediately upon Alert:**
- [ ] Severity 1 (critical): 15-minute response
- [ ] Severity 2 (high): 1-hour response
- [ ] Severity 3 (medium): 4-hour response
- [ ] Severity 4 (low): 24-hour response

### Common Issues & Responses

| Issue | Symptom | Response |
|-------|---------|----------|
| Database slow | API response >1s | Check for missing indexes, long-running queries |
| Memory leak | Memory grows over time | Restart service, check for unclosed connections |
| High error rate | >0.5% 5xx errors | Check logs, investigate root cause, hotfix if needed |
| User locked out | Can't login | Check LDAP/Keycloak, reset password |
| Data mismatch | Counts don't match | Run validation queries, check audit log |

### Success Metrics - First 24 Hours

- ✅ System uptime: 99.9%+ (max 9 minutes downtime)
- ✅ Error rate: <0.1%
- ✅ API response time: <500ms p95
- ✅ User complaints: <5
- ✅ No critical bugs
- ✅ Backup system operational
- ✅ Monitoring/alerting working

### Success Metrics - First Week

- ✅ System uptime: 99.99%+
- ✅ Error rate: <0.05%
- ✅ User satisfaction: >4/5
- ✅ Help desk tickets: <10 total
- ✅ No data loss or corruption
- ✅ Performance stable
- ✅ Disaster recovery tested

---

## Emergency Rollback Procedure

**Only if system unrecoverable and cannot fix within 1 hour**

### Decision Point
- Only Project Manager + CTO can authorize rollback
- Decision must be made within first 2 hours of cutover

### Rollback Steps

1. **Stop new transactions** (5 min)
   ```bash
   # Put Doorman in maintenance mode
   docker update --env MAINTENANCE_MODE=true doorman_backend
   
   # Redirect users to legacy system message
   # "System temporarily in maintenance. Using legacy Samrum. Data synced."
   ```

2. **Restore database** (20-30 min)
   ```bash
   # Stop Doorman
   docker-compose down
   
   # Restore from pre-migration backup
   dropdb doorman_db
   createdb doorman_db
   psql doorman_db < /backups/pre-migration_[timestamp].sql
   
   # Verify restore
   SELECT COUNT(*) FROM object_instances;
   # Expected: 0 (no data migrated)
   ```

3. **Start legacy system** (10 min)
   ```bash
   systemctl start samrum-api
   systemctl start samrum-web
   
   # Verify operational
   curl http://samrum.example.com/health
   # Expected: 200 OK
   ```

4. **Notify users** (immediate)
   ```
   "⚠️ NOTICE: Doorman system experienced issues and has been reverted.
   
   The system has been rolled back to the legacy Samrum platform.
   All work is preserved in the legacy system.
   
   We will investigate the issue and reschedule the Doorman cutover.
   
   Support team: +46-XXX-XXXXX"
   ```

5. **Post-incident review**
   - Root cause analysis
   - Fix identified issues
   - Resched uling go-live (next week minimum)
   - Updated runbook based on learnings

**Expected Duration:** 45-60 minutes total

---

## Post-Go-Live Checklist (Week 1-4)

### Week 1: Intensive Monitoring
- [ ] 24/7 on-call team active
- [ ] Twice-daily status meetings
- [ ] Monitor all key metrics
- [ ] Fix critical bugs within 1 hour
- [ ] User feedback calls daily

### Week 2: Stabilization
- [ ] On-call team continues
- [ ] Daily status meetings (morning only)
- [ ] Performance optimization
- [ ] Update user documentation
- [ ] Plan knowledge transfer

### Week 3: Normal Operations
- [ ] On-call team to business hours
- [ ] Weekly status meetings
- [ ] All systems stable
- [ ] User training complete
- [ ] Knowledge transfer complete

### Week 4: Sign-Off
- [ ] Legacy system decommissioned (if approved)
- [ ] All stakeholders sign-off
- [ ] Project closure meeting
- [ ] Lessons learned documented
- [ ] Team celebration

---

## Go-Live Success Criteria

✅ **System Availability**
- Uptime: 99.9%+ in first 24 hours
- Error rate: <0.1%
- No critical bugs

✅ **Data Integrity**
- All 5000 doors accessible
- No data loss or corruption
- Audit trail complete
- Backups operational

✅ **User Experience**
- Users can log in and perform tasks
- Permission system working
- Forms submitting successfully
- Processes flowing correctly

✅ **Performance**
- API response time: <500ms
- Database query time: <100ms
- Page load time: <2s
- No timeouts or hangs

✅ **Team Readiness**
- On-call team trained and ready
- Support team capable
- Documentation available
- Communication channels clear

---

## Contact Information

**During Cutover (02:00 - 06:00):**
- Project Manager: [Phone]
- Database Lead: [Phone]
- Backend Lead: [Phone]
- DevOps Lead: [Phone]
- Emergency: 112 (if infrastructure down)

**Post-Cutover (24/7 for 1 week):**
- On-Call Phone: +46-XXX-XXXXX
- On-Call Slack: #doorman-incident
- Escalation: CTO (call only if on-call unavailable)

---

**GO-LIVE READINESS:** ✅ Ready for execution

**Next Steps:** 
1. Share runbook with all team members
2. Schedule walkthroughs for each role
3. Confirm team availability for Saturday 02:00-06:00
4. Test rollback procedure in staging
