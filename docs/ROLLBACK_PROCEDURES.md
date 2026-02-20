# 🔄 Migration Rollback Procedures

**Document:** Phase 2 Disaster Recovery  
**Purpose:** How to recover from migration failures  
**Tested:** Yes (part of Phase 2 validation)

---

## 📋 Overview

If the Phase 2 migration encounters critical issues:

1. **STOP** - Halt all further inserts
2. **BACKUP** - Save current state
3. **RESTORE** - Recover from pre-migration backup
4. **ANALYZE** - Determine root cause
5. **FIX** - Correct transformation logic or mappings
6. **RETRY** - Re-run migration with fixes

---

## 🚨 Failure Scenarios & Recovery

### Scenario 1: Data Quality Issues Detected (Mid-Migration)

**Symptoms:**
- Validation queries return errors (NULL required fields, invalid enums, duplicates)
- Data completeness < 95%
- Orphaned references detected

**Recovery Steps:**

```bash
# 1. STOP migration immediately (Ctrl+C)
# Migration already has transaction rollback built-in

# 2. Check current state
psql -U doorman_user -d doorman_db << EOF
SELECT COUNT(*) as doors FROM object_instances WHERE object_type_id = 1;
SELECT * FROM object_instances WHERE object_type_id = 1 LIMIT 1;
EOF

# 3. Restore from backup (if auto-backup exists)
ls -la database/backups/

# If backup exists:
psql -U doorman_user -d doorman_db -f database/backups/backup_TIMESTAMP.sql

# 4. Fix transformation logic
vim backend/scripts/transform.js
# Edit ATTRIBUTE_MAPPING or type conversion logic

# 5. Retry with corrected logic
node backend/scripts/migrate.js --full
```

---

### Scenario 2: Database Constraint Violation (FK Failure)

**Symptoms:**
```
ERROR: insert or update on table "attribute_values" violates foreign key constraint
```

**Recovery:**

```bash
# 1. Check which attribute IDs are causing issues
psql -U doorman_user -d doorman_db << EOF
-- Show which attributes don't exist
SELECT DISTINCT attribute_id FROM temp_transformed_data
WHERE attribute_id NOT IN (SELECT id FROM object_attributes);
EOF

# 2. Verify OMS schema is complete
psql -U doorman_user -d doorman_db << EOF
-- Check all required attributes exist
SELECT id, attribute_name, is_required FROM object_attributes 
WHERE object_type_id = 1 ORDER BY id;
EOF

# 3. If attributes are missing, run Phase 1 setup again
psql -U doorman_user -d doorman_db -f database/migrations/001_create_oms_schema.sql

# 4. Clear any partial migration data
psql -U doorman_user -d doorman_db << EOF
DELETE FROM attribute_values WHERE id IN (
  SELECT av.id FROM attribute_values av
  WHERE av.object_instance_id IN (
    SELECT id FROM object_instances WHERE created_at > NOW() - INTERVAL '1 hour'
  )
);
DELETE FROM object_instances WHERE object_type_id = 1 AND created_at > NOW() - INTERVAL '1 hour';
EOF

# 5. Retry migration
node backend/scripts/migrate.js --full
```

---

### Scenario 3: Duplicate Key Violation

**Symptoms:**
```
ERROR: duplicate key value violates unique constraint "object_instances_object_type_id_external_id_key"
```

**Recovery:**

```bash
# 1. Check for duplicates
psql -U doorman_user -d doorman_db << EOF
SELECT external_id, COUNT(*) 
FROM object_instances WHERE object_type_id = 1
GROUP BY external_id HAVING COUNT(*) > 1;
EOF

# 2. Remove duplicates (keep oldest)
psql -U doorman_user -d doorman_db << EOF
DELETE FROM object_instances oi
WHERE object_type_id = 1 
AND id NOT IN (
  SELECT MIN(id) FROM object_instances
  WHERE object_type_id = 1
  GROUP BY external_id
);
EOF

# 3. Clear migration metadata
psql -U doorman_user -d doorman_db << EOF
DELETE FROM audit_log WHERE action = 'MIGRATION' AND created_at > NOW() - INTERVAL '1 hour';
EOF

# 4. Retry
node backend/scripts/migrate.js --full
```

---

### Scenario 4: Out of Disk Space

**Symptoms:**
```
ERROR: no space left on device
```

**Recovery:**

```bash
# 1. Check disk space
df -h /

# 2. Clear Docker volumes
docker system prune -a

# 3. Archive old backups
tar -czf database/backups/old_backups.tar.gz database/backups/*.sql
rm database/backups/*.sql

# 4. Restart database
docker-compose down
docker-compose up -d postgres

# 5. Verify database still intact
psql -U doorman_user -d doorman_db -c "SELECT COUNT(*) FROM object_types;"

# 6. Retry migration
node backend/scripts/migrate.js --full
```

---

## 🔙 Complete Rollback Procedure

If you need to revert ALL Phase 2 changes and start fresh:

### Step 1: Stop Current Operations
```bash
cd /Users/prashobh/.openclaw/workspace/doorman

# Kill any running migration processes
pkill -f "node backend/scripts/migrate.js" || true
```

### Step 2: Database Rollback
```bash
# Option A: Drop all Phase 2 data and restore schema
psql -U doorman_user -d doorman_db << EOF
-- Clear all migrated door data
DELETE FROM attribute_values 
WHERE object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);
DELETE FROM object_instances WHERE object_type_id = 1;

-- Verify rollback
SELECT COUNT(*) as remaining_doors FROM object_instances WHERE object_type_id = 1;
EOF

# Option B: Restore from backup
# (if pre-migration backup was saved)
ls -la database/backups/
psql -U doorman_user -d doorman_db -f database/backups/backup_before_migration.sql
```

### Step 3: Git Rollback
```bash
# Revert to before Phase 2 branch
git checkout master

# OR reset branch if needed
git reset --hard origin/master
```

### Step 4: Restart Fresh
```bash
# Recreate feature branch
git checkout -b feature/phase-2-migration

# Run Phase 1 setup again
docker-compose down
docker-compose up -d
psql -U doorman_user -d doorman_db -f database/migrations/001_create_oms_schema.sql
psql -U doorman_user -d doorman_db -f database/migrations/002_seed_door_objects.sql

# Verify clean state
node backend/scripts/migrate.js  # Test run with 10 doors
```

---

## ✅ Rollback Verification

After any rollback, verify the system is clean:

```bash
# 1. Check database state
psql -U doorman_user -d doorman_db << EOF
SELECT 
  (SELECT COUNT(*) FROM object_types) as types,
  (SELECT COUNT(*) FROM object_attributes) as attributes,
  (SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1) as doors,
  (SELECT COUNT(*) FROM attribute_values) as attribute_values;
EOF

# Expected for Phase 1 only:
# types | attributes | doors | attribute_values
# 5     | 34         | 0     | 0

# 2. Check git status
git status
git log --oneline -5

# 3. Restart services
docker-compose down
docker-compose up -d
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

---

## 📊 Backup & Recovery Locations

```
Backups:              database/backups/
Phase 2 Scripts:      backend/scripts/
Transformation Logic: backend/scripts/transform.js
Migration Executor:   backend/scripts/migrate.js
```

---

## 🔐 Recovery Time Objective (RTO)

| Scenario | Recovery Time | Data Loss |
|----------|-------------|-----------|
| Mid-migration failure | < 5 min | None (transaction rollback) |
| Post-migration issues | < 15 min | Can restore backup |
| Complete restart | < 30 min | None (full backup available) |

---

## 📞 When to Escalate

Contact platform team if:
- Database corruption detected (VACUUM ANALYZE fails)
- Multiple rollback attempts needed
- Unable to determine root cause
- Backup files are corrupted

---

## 📝 Post-Rollback Checklist

After rollback, before retry:

- [ ] Root cause identified and documented
- [ ] Fix applied (code or data)
- [ ] Transformation logic tested with sample data
- [ ] Backups verified and accessible
- [ ] Database health check passed
- [ ] Test migration (10 doors) successful
- [ ] All validation queries passing
- [ ] Team notified of retry plan

---

**Last Updated:** Phase 2  
**Tested:** Yes  
**Owner:** Data Migration Team
