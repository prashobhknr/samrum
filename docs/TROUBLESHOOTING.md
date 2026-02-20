# 🔧 Phase 2 Troubleshooting Guide

**Purpose:** Resolve common Phase 2 migration issues  
**Last Updated:** Phase 2

---

## ❌ Common Issues & Solutions

### 1. Database Connection Failures

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Cause:** PostgreSQL not running

**Solution:**
```bash
# Start database
docker-compose up -d postgres
docker-compose ps  # Verify running

# Wait 5 seconds for startup
sleep 5

# Test connection
psql -U doorman_user -d doorman_db -c "SELECT 1;"
```

---

### 2. Database Does Not Exist

**Error:** `FATAL: database 'doorman_db' does not exist`

**Cause:** Phase 1 initialization incomplete

**Solution:**
```bash
# Check if Docker container is running
docker-compose ps

# Create database and schema
docker-compose down && docker-compose up -d
sleep 10

# Run Phase 1 migrations
psql -U doorman_user -d doorman_db \
  -f database/migrations/001_create_oms_schema.sql

# Verify
psql -U doorman_user -d doorman_db -c "SELECT COUNT(*) FROM object_types;"
# Should return: 5
```

---

### 3. Authentication Failed

**Error:** `password authentication failed for user 'doorman_user'`

**Cause:** Wrong credentials or user doesn't exist

**Solution:**
```bash
# Check docker-compose.yml for correct credentials
cat docker-compose.yml | grep -A5 postgres

# Reset with correct credentials
PGPASSWORD=doorman_pass psql -U doorman_user -h localhost -d doorman_db -c "SELECT 1;"

# If still failing, recreate container
docker-compose down -v  # Remove volumes
docker-compose up -d postgres
psql -U postgres -h localhost << EOF
CREATE DATABASE doorman_db;
CREATE USER doorman_user WITH PASSWORD 'doorman_pass';
GRANT ALL ON DATABASE doorman_db TO doorman_user;
EOF
```

---

### 4. Transformation Fails - Invalid Enum

**Error:** `Invalid enum value for fire_class: INVALID_VALUE`

**Cause:** Legacy data contains invalid enum values

**Solution:**
```bash
# Check which values exist in CSV
grep -o 'fire_class[^,]*' database/scripts/sample_legacy_doors.csv | sort -u

# Compare with allowed values in schema
psql -U doorman_user -d doorman_db << EOF
SELECT enum_values FROM object_attributes WHERE attribute_name = 'fire_class';
EOF

# Fix CSV or update ATTRIBUTE_MAPPING in transform.js
# If CSV is wrong:
sed -i 's/INVALID_VALUE/EI30/g' database/scripts/sample_legacy_doors.csv

# Retry transformation
node backend/scripts/transform.js database/scripts/sample_legacy_doors.csv
```

---

### 5. Migration Fails - Duplicate Key Violation

**Error:** `duplicate key value violates unique constraint "object_instances_object_type_id_external_id_key"`

**Cause:** Doors already exist from previous run

**Solution:**
```bash
# Clear existing doors
psql -U doorman_user -d doorman_db << EOF
DELETE FROM attribute_values WHERE object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);
DELETE FROM object_instances WHERE object_type_id = 1;
EOF

# Verify cleared
psql -U doorman_user -d doorman_db \
  -c "SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1;"
# Should return: 0

# Retry migration
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv
```

---

### 6. Validation Fails - Missing Required Attributes

**Error:** `Missing required field: door_name`

**Cause:** CSV has NULL or empty required columns

**Solution:**
```bash
# Check which rows have missing required fields
awk -F',' '$2=="" {print NR": empty door_name"}' database/scripts/sample_legacy_doors.csv

# Fix CSV:
# Option 1: Add default values
# Option 2: Remove rows with missing values
# Option 3: Update ATTRIBUTE_MAPPING to not mark as required

# Verify CSV is valid
head -5 database/scripts/sample_legacy_doors.csv

# Retry
node backend/scripts/transform.js database/scripts/sample_legacy_doors.csv
```

---

### 7. Out of Disk Space

**Error:** `no space left on device` or `ENOSPC`

**Cause:** Too many backups or logs

**Solution:**
```bash
# Check disk space
df -h /

# Clean old backups
rm -f database/backups/backup_*.sql
ls -lah database/backups/

# Clear Docker logs
docker system prune --volumes

# Remove old migration logs
rm -f migration-logs/*.txt

# Try again
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv
```

---

### 8. Validation Queries Show NULL Values

**Error:** `Missing required attribute` warnings

**Cause:** CSV has empty or NULL values

**Solution:**
```bash
# Check CSV for empty cells
awk -F',' 'NF != NF_expected {print NR": wrong column count"}' \
  database/scripts/sample_legacy_doors.csv

# Inspect row with issue
sed -n '5p' database/scripts/sample_legacy_doors.csv

# Fix:
# 1. Ensure all columns have values (use defaults if needed)
# 2. Or update ATTRIBUTE_MAPPING to not require that field

# Verify
head -1 database/scripts/sample_legacy_doors.csv | wc -w
tail -1 database/scripts/sample_legacy_doors.csv | wc -w
# Should be same count

# Re-transform
node backend/scripts/transform.js database/scripts/sample_legacy_doors.csv

# Re-migrate
psql -U doorman_user -d doorman_db << EOF
DELETE FROM attribute_values WHERE object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);
DELETE FROM object_instances WHERE object_type_id = 1;
EOF

node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv
```

---

### 9. Transformation Shows Low Success Rate

**Error:** `Only 10/40 successful, 30 failed`

**Cause:** Systematic data quality issues

**Solution:**
```bash
# Check transformed_data.json for error patterns
cat database/scripts/transformed_data.json | jq '.failed[] | .errors' | sort | uniq -c

# Most common errors will show first
# Example: "Missing door_id" - check CSV doesn't have blank IDs

# Inspect failing rows
cat database/scripts/transformed_data.json | jq '.failed[] | {doorId, errors}' -c | head -10

# Fix root cause:
# 1. Update CSV data
# 2. Adjust transformation logic
# 3. Adjust validation rules

# Retry
node backend/scripts/transform.js database/scripts/sample_legacy_doors.csv
```

---

### 10. Database Locked - Cannot Delete

**Error:** `could not serialize access due to concurrent update`

**Cause:** Other processes accessing database

**Solution:**
```bash
# Kill conflicting connections
psql -U doorman_user -d doorman_db << EOF
-- Find active connections
SELECT pid, usename, application_name 
FROM pg_stat_activity 
WHERE datname = 'doorman_db' AND pid != pg_backend_pid();

-- Kill specific connection
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'doorman_db' 
AND application_name != 'psql'
AND pid != pg_backend_pid();
EOF

# Verify no active connections
psql -U doorman_user -d doorman_db -c \
  "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'doorman_db';"
# Should return: 1 (just psql)

# Retry migration
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv
```

---

## 🔍 Debugging Steps

### Step 1: Enable Verbose Logging

```bash
# Add logging to migration
DEBUG=* node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv

# Or capture to file
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv 2>&1 | tee migration_debug.log
```

### Step 2: Check Database State

```bash
# See current object instances
psql -U doorman_user -d doorman_db << EOF
SELECT id, external_id, name, created_at 
FROM object_instances WHERE object_type_id = 1 LIMIT 5;

-- Check attributes for one door
SELECT oa.attribute_name, av.value 
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
JOIN object_attributes oa ON oa.id = av.object_attribute_id
WHERE oi.external_id = 'D-001'
ORDER BY oa.id;

-- Check for errors in latest migration
SELECT COUNT(*) FROM object_instances WHERE updated_at > NOW() - INTERVAL '1 hour';
EOF
```

### Step 3: Validate CSV Format

```bash
# Check CSV syntax
file database/scripts/sample_legacy_doors.csv
wc -l database/scripts/sample_legacy_doors.csv

# Check for bad characters
file -i database/scripts/sample_legacy_doors.csv
# Should show: text/plain; charset=utf-8

# Validate CSV structure
head -1 database/scripts/sample_legacy_doors.csv | tr ',' '\n' | nl

# Count columns
awk -F',' 'NR==1 {print NF}' database/scripts/sample_legacy_doors.csv
# Compare with:
awk -F',' 'NR==2 {print NF}' database/scripts/sample_legacy_doors.csv
```

### Step 4: Test Transformation Step-by-Step

```bash
# Create minimal test CSV
cat > test_minimal.csv << EOF
door_id,door_name,fire_class,security_class
D-TEST-001,Test Door,EI30,MEDIUM
EOF

# Test transformation
node backend/scripts/transform.js test_minimal.csv

# If successful, add more columns incrementally
```

---

## 📋 Validation Checklist

Before reporting an issue:

- [ ] PostgreSQL running (`docker-compose ps`)
- [ ] Database connected (`psql -U doorman_user -d doorman_db -c "SELECT 1;"`)
- [ ] CSV file exists and is readable (`file database/scripts/sample_legacy_doors.csv`)
- [ ] CSV has valid format (right number of columns)
- [ ] Node.js installed (`node --version`)
- [ ] npm packages installed (`npm list pg csv-parse`)
- [ ] Phase 1 schema complete (`psql -U doorman_user -d doorman_db -c "SELECT COUNT(*) FROM object_attributes;"` should be > 0)

---

## 📞 Getting Help

If issue persists:

1. **Check logs:**
   ```bash
   cat migration-logs/*.txt
   cat database/backups/backup_*.sql
   ```

2. **Review git history:**
   ```bash
   git log --oneline -10
   git diff HEAD~1
   ```

3. **Restore backup:**
   ```bash
   # See ROLLBACK_PROCEDURES.md
   psql -U doorman_user -d doorman_db -f database/backups/backup_TIMESTAMP.sql
   ```

4. **Contact team:**
   - Check recent commits to understand what changed
   - Share error log and CSV sample
   - Include docker-compose logs: `docker-compose logs postgres`

---

**Common Resolution Time:** 5-15 minutes  
**Escalation Path:** Data Migration Team → Platform Engineering  
**Documentation:** Phase 2 Complete
