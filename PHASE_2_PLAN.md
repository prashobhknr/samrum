# 📋 PHASE 2 Plan - Data Migration Implementation

**Phase:** 2 of 5  
**Duration:** 2 weeks  
**Status:** Ready to Start  
**Model:** Sonnet or Opus (for coding)  

---

## 🎯 Phase 2 Objective

Migrate 5,000+ legacy door objects from SQL Server (Samrum) to PostgreSQL (OMS).

**Input:** Legacy SQL Server database (Samrum_Master)  
**Output:** PostgreSQL populated with migrated door data, fully validated

---

## 📊 What Phase 2 Will Deliver

### 1. Data Extraction Scripts
- Query legacy SQL Server OT_ObjectType table (door objects)
- Extract door relationships (OTR_ObjectTypeRelationship)
- Export sample data (100 doors) for testing

### 2. Data Transformation Layer
- Map legacy schema → OMS schema
- Handle data type conversions
- Deal with NULLs and missing values
- Enrich data with defaults

### 3. Migration Executor
- Load transformed data into PostgreSQL
- Verify row counts match
- Handle duplicate detection
- Transaction management (rollback support)

### 4. Validation & Testing
- Data quality checks (NULLs, duplicates, referential integrity)
- Compare counts: legacy vs. migrated
- Spot-check 10 random records
- Generate validation report

### 5. Rollback Procedures
- Backup strategy
- Rollback scripts
- Recovery procedures
- Documentation

### 6. Documentation
- Migration runbook
- Troubleshooting guide
- Data quality report
- Performance metrics

---

## 🔧 Phase 2 Tasks (Detailed)

### Task 2.1: Legacy Data Extraction (3 days)

**What:** Query legacy SQL Server and extract door data

**Deliverables:**
```
database/scripts/
├── extract_legacy_doors.sql         # Query to extract doors
├── extract_legacy_locks.sql         # Query to extract locks
├── extract_legacy_relationships.sql # Query to extract relationships
└── sample_data_100_doors.csv        # Test data
```

**Sample Output Structure:**
```csv
door_id, door_name, location, fire_class, security_class, lock_type, ...
D-001, Main Entrance, Building A 2nd Floor, EI30, HIGH, mortise, ...
D-002, Side Door, Building B Ground, EI60, MEDIUM, electronic, ...
...
```

**Success Criteria:**
- [ ] Extract 100 doors for testing
- [ ] All attributes present (50+ columns)
- [ ] Handle legacy ID mapping
- [ ] Document any data quality issues

---

### Task 2.2: Data Transformation (3 days)

**What:** Build transformation layer to convert legacy → OMS

**Deliverables:**
```
backend/scripts/
├── transform.js              # Main transformation engine
├── mappers/
│   ├── doorMapper.js        # Door legacy → OMS
│   ├── lockMapper.js        # Lock legacy → OMS
│   ├── frameMapper.js       # Frame legacy → OMS
│   ├── automationMapper.js  # Automation legacy → OMS
│   └── typeMapper.js        # Wall type legacy → OMS
└── validators/
    └── dataValidator.ts     # Validate transformed data
```

**Transformation Logic:**
```typescript
// Example: Transform legacy door
{
  // LEGACY
  OT_ID: 116,
  OT_NameSingular: 'Door',
  external_id: 'D-001',
  // ... 50 attributes
}

// TRANSFORM TO OMS
{
  object_type_id: 1,           // Door
  external_id: 'D-001',
  attribute_values: [
    { attribute_id: 1, value: 'D-001' },          // door_id
    { attribute_id: 2, value: 'Main Entrance' },  // door_name
    { attribute_id: 3, value: 'Building A...' },  // location
    // ... 50 attributes
  ]
}
```

**Success Criteria:**
- [ ] Transform 100 test doors
- [ ] Handle NULL values gracefully
- [ ] Map all 50+ attributes correctly
- [ ] Generate transformation report
- [ ] Zero data loss

---

### Task 2.3: Migration Execution (2 days)

**What:** Load transformed data into PostgreSQL

**Deliverables:**
```
database/scripts/
├── migrate_doors.sql           # INSERT transformed door data
├── migrate_relationships.sql   # INSERT relationships
└── migration_log.sql           # Track migration progress
```

**Implementation:**
```typescript
async function migrate() {
  // 1. Backup existing data
  await backupDatabase();
  
  // 2. Transform legacy data
  const transformed = await transformLegacyData(100);
  
  // 3. Insert into OMS
  await insertDoors(transformed);
  await insertLocks(transformed);
  await insertRelationships(transformed);
  
  // 4. Validate
  await validateMigration();
  
  // 5. Full run (if validation passed)
  const fullData = await transformLegacyData(5000);
  await insertAllData(fullData);
}
```

**Success Criteria:**
- [ ] Test migration (100 doors) works
- [ ] Full migration (5000 doors) works
- [ ] Zero errors during insert
- [ ] All foreign keys valid
- [ ] Audit log populated

---

### Task 2.4: Validation & Quality Check (2 days)

**What:** Verify data integrity and completeness

**Deliverables:**
```
docs/
└── DATA_MIGRATION_REPORT.md

Validation queries:
- Count checks (100 doors → 100 instances)
- Attribute completeness (all 50+ present)
- Relationship integrity (no orphaned records)
- Duplicate detection
- Type conversion validation
```

**Validation Script:**
```sql
-- Count verification
SELECT COUNT(*) FROM object_instances WHERE object_type_id = 1;
-- Expected: 5000+ doors

-- Attribute completeness
SELECT COUNT(*) FROM attribute_values WHERE object_attribute_id = 1;
-- Expected: 5000+ (one door_id per door)

-- Relationship validation
SELECT COUNT(*) FROM object_relationships;
-- Expected: All relationships present

-- Data quality
SELECT * FROM object_instances WHERE name IS NULL;
-- Expected: 0 rows (all required fields filled)
```

**Success Criteria:**
- [ ] Row counts match source
- [ ] All required attributes present
- [ ] No NULL primary keys
- [ ] Referential integrity validated
- [ ] Data quality report passed
- [ ] Stakeholder sign-off

---

### Task 2.5: Rollback & Recovery (1 day)

**What:** Document how to rollback if migration fails

**Deliverables:**
```
docs/
├── ROLLBACK_PROCEDURES.md
├── RECOVERY_PLAN.md
└── DISASTER_RECOVERY.md

Scripts:
database/scripts/
├── backup_pre_migration.sql
└── restore_backup.sql
```

**Rollback Scenario:**
```
If migration discovers critical issues:

1. STOP: All inserts
2. BACKUP: Current state
3. RESTORE: Previous working backup
4. ANALYZE: What went wrong
5. FIX: Transform logic or mappings
6. RETRY: Migration from step 1
```

**Success Criteria:**
- [ ] Backup procedures documented
- [ ] Rollback tested successfully
- [ ] Recovery time <30 minutes
- [ ] Zero data loss
- [ ] Team trained on procedures

---

### Task 2.6: Documentation (1 day)

**What:** Comprehensive Phase 2 documentation

**Deliverables:**
```
docs/
├── PHASE_2_SUMMARY.md          # What was done
├── MIGRATION_RUNBOOK.md        # How to run migration
├── DATA_QUALITY_REPORT.md      # Results & metrics
├── TROUBLESHOOTING.md          # Common issues
└── LESSONS_LEARNED.md          # What we learned
```

**Success Criteria:**
- [ ] Runbook is clear (ops can execute)
- [ ] All decisions documented
- [ ] Quality metrics captured
- [ ] Team can answer "how did you do it?"

---

## 📅 Phase 2 Timeline

```
Week 1:
  Day 1-2: Extraction (query legacy data)
  Day 3-4: Transformation (build mappers)
  Day 5: Testing & refinement

Week 2:
  Day 1-2: Full migration execution
  Day 3: Validation & quality checks
  Day 4: Rollback procedures
  Day 5: Documentation & sign-off
```

---

## 🛠️ Technologies for Phase 2

- **SQL:** Data extraction, validation
- **Node.js/TypeScript:** Transformation layer
- **PostgreSQL:** Target database
- **SQL Server:** Source database (read-only)
- **Docker:** Local testing environment

---

## 📊 Success Metrics

| Metric | Target | Validation |
|--------|--------|-----------|
| Doors Migrated | 5,000+ | COUNT(*) FROM object_instances |
| Data Completeness | 100% | All 50+ attributes present |
| Data Quality | 0 errors | No NULLs in required fields |
| Duplicate Detection | 0 | No duplicate door_ids |
| Referential Integrity | 100% valid | All foreign keys valid |
| Rollback Time | <30 min | Tested & documented |
| Documentation | Complete | Runbook + reports + lessons |

---

## 🚀 How to Execute Phase 2

### Option A: Spawn Sonnet Agent
```bash
# When ready, spawn Sonnet for coding work
sessions_spawn task:"Phase 2: Data migration from legacy to OMS" model:"sonnet"
```

**Sonnet is good for:**
- Data transformation logic
- SQL optimization
- Testing & validation
- Documentation writing

### Option B: Spawn Opus Agent
```bash
# For complex architecture decisions
sessions_spawn task:"Phase 2 with data mapping strategy" model:"opus"
```

**Opus is good for:**
- Complex data mapping decisions
- Edge case handling
- Performance optimization
- Strategy & planning

---

## 📋 Phase 2 Checklist

- [ ] Legacy database access verified
- [ ] Sample data (100 doors) extracted
- [ ] Transformation logic implemented
- [ ] Test migration successful (100 doors)
- [ ] Validation queries passing
- [ ] Full migration executed (5,000 doors)
- [ ] Data quality report passed
- [ ] Rollback procedures tested
- [ ] Documentation complete
- [ ] Stakeholder sign-off obtained
- [ ] Phase 3 ready to start

---

## 🎯 Phase 3 Preview (After Phase 2)

Once Phase 2 completes:
- Database populated with migrated data ✅
- Ready for Phase 3: Dynamic Form Generation
  - FormService implementation
  - Permission evaluation
  - Field dependencies
  - Camunda integration

---

## 💾 Git Workflow for Phase 2

```bash
# Create feature branch
git checkout -b feature/phase-2-migration

# Make changes
# ... implementation ...

# Commit regularly
git add .
git commit -m "[PHASE-2] feat: data extraction from legacy system"
git commit -m "[PHASE-2] feat: transformation logic implemented"
git commit -m "[PHASE-2] test: validation queries passing"

# Push to GitHub
git push -u origin feature/phase-2-migration

# Create Pull Request on GitHub
# Link to: IMPLEMENTATION_ROADMAP.md Phase 2
# Reviewers: Architecture lead + DBA
# Merge to develop after approval
```

---

**Ready to Start Phase 2?**

1. [ ] Review this plan
2. [ ] Set up access to legacy SQL Server database
3. [ ] Prepare sample data (100 doors)
4. [ ] Decide: Sonnet or Opus for coding
5. [ ] Create GitHub branch: feature/phase-2-migration
6. [ ] Spawn agent: `sessions_spawn task:"Phase 2..." model:"sonnet or opus"`

---

**Next:** Phase 2 Data Migration (Ready to execute!)
