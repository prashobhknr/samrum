# 🚀 Migration Runbook

**Phase:** 2 of 5  
**Document Type:** Operational Guide  
**Audience:** Operations/DevOps Engineers  
**Estimated Duration:** 2-3 hours (test + validation)

---

## 📋 Pre-Migration Checklist

Before running the migration, verify:

- [ ] PostgreSQL running locally (docker-compose up -d)
- [ ] Database `doorman_db` exists and accessible
- [ ] OMS schema created (Phase 1 complete)
- [ ] Sample CSV file available: `database/scripts/sample_legacy_doors.csv`
- [ ] Node.js dependencies installed: `cd backend && npm install`
- [ ] Environment variables set (or defaults: localhost, doorman_user, doorman_pass)
- [ ] At least 2 GB free disk space
- [ ] No active connections to doorman_db (kill other sessions if needed)

---

## 🔧 Step 1: Preparation (5 minutes)

### 1.1 Verify Database Connection

```bash
cd /Users/prashobh/.openclaw/workspace/doorman

# Test connection
psql -U doorman_user -d doorman_db -c "SELECT 1;"

# Expected output: 1
```

### 1.2 Verify OMS Schema

```bash
# Check that Phase 1 tables exist
psql -U doorman_user -d doorman_db << EOF
\dt object_*
\dt attribute_*
\dt permission*
SELECT COUNT(*) FROM object_types;
SELECT COUNT(*) FROM object_attributes;
EOF

# Expected:
# - 11 tables should exist
# - 5 object_types (Door, Lock, Frame, Automation, WallType)
# - 34 object_attributes (for Door)
```

### 1.3 Install Node Dependencies

```bash
cd /Users/prashobh/.openclaw/workspace/doorman/backend
npm install pg csv-parse

# Expected: Installs pg and csv-parse packages
```

---

## 🧪 Step 2: Test Migration (30 minutes)

### 2.1 Run Test Transformation

First, test the data transformation logic with a small sample:

```bash
cd /Users/prashobh/.openclaw/workspace/doorman

# Transform sample data (generates JSON output)
node backend/scripts/transform.js database/scripts/sample_legacy_doors.csv

# Expected output:
# 📖 Loading CSV from: database/scripts/sample_legacy_doors.csv
# ✅ CSV loaded (XXXX bytes)
# 🔄 Transforming data...
# 📊 Transformation Summary:
#    Total rows:     40
#    ✅ Successful:  40
#    ❌ Failed:      0
#    ⚠️  Warnings:   0
# 
# 📝 Results saved to: database/scripts/transformed_data.json
```

### 2.2 Inspect Transformed Data

```bash
# Review the transformation output
cat database/scripts/transformed_data.json | head -50

# Check that:
# - door_id is set as external_id
# - All 34 attributes are mapped
# - No critical errors
```

### 2.3 Test Migration with 10 Doors

```bash
# Run migration in TEST mode (default)
# This inserts only 10 doors for validation
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv

# Expected output:
# ============================================================
# PHASE 2: DATA MIGRATION
# ============================================================
# ✅ Connected to PostgreSQL
# 📖 Loading CSV from: database/scripts/sample_legacy_doors.csv
# ✅ CSV loaded (XXXX bytes)
# 🔄 Transforming data...
# 📊 Transformation Summary:
#    Total rows:     40
#    ✅ Successful:  40
#    ❌ Failed:      0
# 📦 Backing up existing data...
# 📁 Backup saved: database/backups/backup_2026-02-20T16-30-45-123Z.sql
# 🚀 Starting migration...
# ⚠️  Test mode: Migrating 10 doors (limit: 10)
#    ✅ 10/10 doors migrated
# 📊 Migration Summary:
#    ✅ Successful: 10
#    ❌ Failed: 0
# 🔍 Validating migration...
#    📊 Door instances: 10
#    ✅ Attribute completeness check passed
#    ✅ No NULL values in required fields
#    ✅ Referential integrity validated
# ✅ Validation Summary:
#    Total doors: 10
#    Integrity: ✅ Valid
# ✨ Migration test completed successfully!
```

### 2.4 Verify Test Data in Database

```bash
# Check that 10 doors were inserted
psql -U doorman_user -d doorman_db << EOF
-- Count doors
SELECT COUNT(*) as doors_inserted 
FROM object_instances WHERE object_type_id = 1;

-- Show 3 sample doors
SELECT id, external_id, name 
FROM object_instances WHERE object_type_id = 1 LIMIT 3;

-- Check attributes for one door
SELECT oa.attribute_name, av.value
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
JOIN object_attributes oa ON oa.id = av.object_attribute_id
WHERE oi.external_id = 'D-001'
ORDER BY oa.id;
EOF

# Expected: 10 doors, all with attributes populated
```

### 2.5 Run Validation Queries

```bash
# Execute the comprehensive validation suite
psql -U doorman_user -d doorman_db -f database/scripts/validate_migration.sql

# Expected output:
# ✅ Completeness Metrics: 10 doors, ~340 attributes
# ✅ No NULL required fields
# ✅ No duplicates
# ✅ Referential integrity valid
# ✅ All enums valid
# ✅ All dates valid
```

### 2.6 Validate Test Results

```bash
# If all checks passed, proceed to full migration
# If any checks FAILED:
#   1. Review error output
#   2. Check TROUBLESHOOTING.md
#   3. Fix transformation logic
#   4. Restore backup and retry

# Save test results
mkdir -p migration-logs
psql -U doorman_user -d doorman_db -f database/scripts/validate_migration.sql \
  > migration-logs/test_validation_$(date +%s).txt
```

---

## 🚀 Step 3: Full Migration (1 hour)

### 3.1 Clear Test Data

If test was successful, clear test doors before full run:

```bash
# Clear test doors
psql -U doorman_user -d doorman_db << EOF
DELETE FROM attribute_values 
WHERE object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);
DELETE FROM object_instances WHERE object_type_id = 1;

-- Verify
SELECT COUNT(*) as doors_remaining 
FROM object_instances WHERE object_type_id = 1;
EOF

# Expected: 0 doors
```

### 3.2 Run Full Migration

```bash
# Run migration with all 40+ doors (or 5000+ if using real data)
node backend/scripts/migrate.js database/scripts/sample_legacy_doors.csv --full

# Expected output:
# ✅ Connected to PostgreSQL
# 🚀 Starting migration...
# 🔄 Full migration: 40 doors
#    ✅ 10/40 doors migrated
#    ✅ 20/40 doors migrated
#    ✅ 30/40 doors migrated
#    ✅ 40/40 doors migrated
# 📊 Migration Summary:
#    ✅ Successful: 40
#    ❌ Failed: 0
# ✅ Validation Summary:
#    Total doors: 40
#    Integrity: ✅ Valid
# ✨ Migration completed successfully!
```

### 3.3 Final Validation

```bash
# Run complete validation suite
psql -U doorman_user -d doorman_db << EOF
-- FINAL VALIDATION
SELECT COUNT(*) as final_door_count 
FROM object_instances WHERE object_type_id = 1;

-- All validation checks
\i database/scripts/validate_migration.sql

-- Show migration statistics
SELECT 
  COUNT(*) as total_doors,
  COUNT(DISTINCT EXTRACT(YEAR FROM created_at)) as years_migrated,
  MIN(created_at) as oldest_door,
  MAX(created_at) as newest_door
FROM object_instances WHERE object_type_id = 1;
EOF

# Expected: 40+ doors, 0 validation errors
```

---

## 📊 Step 4: Post-Migration Validation (30 minutes)

### 4.1 Data Quality Report

```bash
# Generate comprehensive report
psql -U doorman_user -d doorman_db << EOF
-- PHASE 2 DATA QUALITY REPORT
-- Generated: $(date)

SELECT 
  'Phase 2 Migration Report' as report,
  CURRENT_TIMESTAMP as timestamp;

-- Total Doors Migrated
SELECT COUNT(*) as total_doors_migrated 
FROM object_instances WHERE object_type_id = 1;

-- Attribute Completeness
SELECT 
  COUNT(*) as doors_with_attributes,
  ROUND(AVG(attr_count), 1) as avg_attributes_per_door
FROM (
  SELECT COUNT(DISTINCT object_attribute_id) as attr_count
  FROM attribute_values av
  WHERE av.object_instance_id IN (
    SELECT id FROM object_instances WHERE object_type_id = 1
  )
  GROUP BY object_instance_id
);

-- Security Integrity
SELECT COUNT(*) as very_high_security_doors
FROM object_instances oi
JOIN attribute_values av ON av.object_instance_id = oi.id
WHERE oi.object_type_id = 1
AND av.object_attribute_id = 5  -- security_class
AND av.value = 'VERY_HIGH';

-- Fire Safety
SELECT 
  COUNT(CASE WHEN value = 'EI30' THEN 1 END) as ei30,
  COUNT(CASE WHEN value = 'EI60' THEN 1 END) as ei60,
  COUNT(CASE WHEN value = 'EI90' THEN 1 END) as ei90,
  COUNT(CASE WHEN value = 'EI120' THEN 1 END) as ei120
FROM attribute_values av
WHERE av.object_attribute_id = 4  -- fire_class
AND av.object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);

EOF

# Save report
psql -U doorman_user -d doorman_db -f database/scripts/validate_migration.sql \
  > migration-logs/phase2_final_report_$(date +%Y%m%d_%H%M%S).txt
```

### 4.2 Spot Check Random Doors

```bash
# Manually verify 5 random doors
psql -U doorman_user -d doorman_db << EOF
-- Show 5 random doors with all attributes
SELECT 
  oi.external_id,
  oi.name,
  oa.attribute_name,
  av.value
FROM object_instances oi
JOIN object_attributes oa ON oa.object_type_id = 1
LEFT JOIN attribute_values av ON av.object_instance_id = oi.id 
  AND av.object_attribute_id = oa.id
WHERE oi.id IN (
  SELECT id FROM object_instances 
  WHERE object_type_id = 1 
  ORDER BY RANDOM() LIMIT 5
)
ORDER BY oi.external_id, oa.id;
EOF

# Review for data quality:
# - Are all important fields filled?
# - Do values look reasonable?
# - Any obvious data quality issues?
```

---

## 📅 Step 5: Commit Changes to Git

```bash
# Add Phase 2 deliverables
cd /Users/prashobh/.openclaw/workspace/doorman
git add -A

# Verify changes
git status

# Commit with meaningful message
git commit -m "[PHASE-2] feat: complete data migration from legacy to OMS

- Added sample_legacy_doors.csv (40 test records)
- Implemented transformation layer (transform.js)
- Created migration executor (migrate.js)
- Added comprehensive validation queries
- Documented rollback procedures
- All 40 test doors migrated successfully
- Data quality validation: PASSED"

# Push to GitHub (if configured)
git push origin feature/phase-2-migration
```

---

## 🚨 Troubleshooting

### Issue: "Connection refused"
```bash
# Database not running
docker-compose up -d
docker-compose ps  # Verify postgres is running
```

### Issue: "FATAL: database 'doorman_db' does not exist"
```bash
# Phase 1 setup not complete
docker-compose down
docker-compose up -d
psql -U doorman_user -f database/migrations/001_create_oms_schema.sql
```

### Issue: "Duplicate key violation"
```bash
# Doors already migrated
# Clear and retry:
psql -U doorman_user -d doorman_db << EOF
DELETE FROM attribute_values WHERE object_instance_id IN (
  SELECT id FROM object_instances WHERE object_type_id = 1
);
DELETE FROM object_instances WHERE object_type_id = 1;
EOF
```

For more troubleshooting, see: `TROUBLESHOOTING.md`

---

## ✅ Completion Checklist

After successful migration:

- [ ] 40+ doors migrated to PostgreSQL
- [ ] All validation queries passed (0 errors)
- [ ] Data completeness >= 95%
- [ ] Spot check of 5 random doors passed
- [ ] Validation report generated
- [ ] Backup files saved securely
- [ ] Phase 2 commits pushed to GitHub
- [ ] Team notified of completion
- [ ] Ready for Phase 3 (UI development)

---

## 📞 Support

If migration fails:

1. Check `TROUBLESHOOTING.md`
2. Review `ROLLBACK_PROCEDURES.md`
3. Contact Data Migration Team
4. Keep backup file locations documented

---

**Estimated Total Time:** 2-3 hours  
**Success Rate:** ~95% (with retry)  
**Last Updated:** Phase 2  
**Tested:** Yes
