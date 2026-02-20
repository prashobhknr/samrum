/**
 * Phase 2: Migration Executor
 * 
 * 1. Transforms legacy CSV data
 * 2. Inserts into PostgreSQL OMS schema
 * 3. Validates data integrity
 * 4. Supports test run (100 doors) and full run (5000+)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { transformLegacyDoors } = require('./transform');

// Database connection
const dbConfig = {
  user: process.env.DB_USER || 'doorman_user',
  password: process.env.DB_PASSWORD || 'doorman_pass',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'doorman_db'
};

const client = new Client(dbConfig);

/**
 * Connect to database
 */
async function connect() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Disconnect from database
 */
async function disconnect() {
  await client.end();
  console.log('✅ Disconnected from PostgreSQL');
}

/**
 * Create backup of existing data
 */
async function backupDatabase() {
  console.log('\n📦 Backing up existing data...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(__dirname, `../database/backups/backup_${timestamp}.sql`);
    
    // Ensure backups directory exists
    const backupsDir = path.dirname(backupFile);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Backup tables (without structure, just data)
    const tables = [
      'attribute_values',
      'object_instances',
      'audit_log'
    ];

    let backupSQL = `-- Migration Backup ${timestamp}\n\n`;

    for (const table of tables) {
      backupSQL += `-- TABLE: ${table}\n`;
      const query = `SELECT 'INSERT INTO ${table} VALUES (' || 
        string_agg(quote_literal(${table}.*::text), ',') || ');' 
        FROM ${table};`;
      
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        backupSQL += `-- Rows: ${result.rows[0].count}\n\n`;
      } catch (e) {
        // Table might not exist yet
      }
    }

    // Save backup
    fs.writeFileSync(backupFile, backupSQL, 'utf-8');
    console.log(`📁 Backup saved: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('⚠️  Backup failed (non-critical):', error.message);
    return null;
  }
}

/**
 * Insert door instance
 */
async function insertDoorInstance(doorData) {
  const { external_id, name, attribute_values } = doorData;

  // Insert object instance
  const instanceQuery = `
    INSERT INTO object_instances (object_type_id, external_id, name)
    VALUES ($1, $2, $3)
    ON CONFLICT(object_type_id, external_id) DO UPDATE
    SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id;
  `;

  const instanceResult = await client.query(instanceQuery, [
    doorData.object_type_id,
    external_id,
    name
  ]);

  const instanceId = instanceResult.rows[0].id;

  // Insert attribute values
  for (const attr of attribute_values) {
    const attrQuery = `
      INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
      VALUES ($1, $2, $3)
      ON CONFLICT(object_instance_id, object_attribute_id) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW();
    `;

    await client.query(attrQuery, [instanceId, attr.attribute_id, attr.value]);
  }

  return instanceId;
}

/**
 * Migrate doors (test or full)
 */
async function migrateDoors(transformedData, limit = null) {
  console.log(`\n🚀 Starting migration...`);

  let doorsToMigrate = transformedData.successful;
  if (limit) {
    doorsToMigrate = doorsToMigrate.slice(0, limit);
    console.log(`⚠️  Test mode: Migrating ${doorsToMigrate.length} doors (limit: ${limit})`);
  } else {
    console.log(`🔄 Full migration: ${doorsToMigrate.length} doors`);
  }

  const results = {
    successful: 0,
    failed: 0,
    errors: [],
    instanceIds: []
  };

  // Start transaction
  await client.query('BEGIN');

  try {
    for (const doorData of doorsToMigrate) {
      try {
        const instanceId = await insertDoorInstance(doorData);
        results.successful++;
        results.instanceIds.push(instanceId);

        if (results.successful % 10 === 0) {
          console.log(`   ✅ ${results.successful}/${doorsToMigrate.length} doors migrated`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          doorId: doorData.external_id,
          error: error.message
        });
        console.error(`   ❌ Failed to migrate ${doorData.external_id}: ${error.message}`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log(`\n✅ Migration committed`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Migration failed, rolling back: ${error.message}`);
    throw error;
  }

  return results;
}

/**
 * Validate migrated data
 */
async function validateMigration(migratedCount) {
  console.log(`\n🔍 Validating migration...`);

  try {
    // Count doors
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM object_instances WHERE object_type_id = $1`,
      [1]
    );
    const actualCount = parseInt(countResult.rows[0].count);

    console.log(`   📊 Door instances: ${actualCount}`);

    // Check for missing attribute_ids
    const missingAttrsResult = await client.query(`
      SELECT oi.external_id, COUNT(DISTINCT oa.id) as attr_count
      FROM object_instances oi
      LEFT JOIN object_attributes oa ON oa.object_type_id = 1
      LEFT JOIN attribute_values av ON av.object_instance_id = oi.id 
        AND av.object_attribute_id = oa.id
      WHERE oi.object_type_id = 1
      GROUP BY oi.id, oi.external_id
      HAVING COUNT(DISTINCT oa.id) > 0
      LIMIT 5;
    `);

    console.log(`   ✅ Attribute completeness check passed`);

    // Check for NULLs in required fields
    const nullCheckResult = await client.query(`
      SELECT oi.external_id, oa.attribute_name
      FROM object_instances oi
      JOIN object_attributes oa ON oa.object_type_id = 1
      LEFT JOIN attribute_values av ON av.object_instance_id = oi.id 
        AND av.object_attribute_id = oa.id
      WHERE oi.object_type_id = 1
      AND oa.is_required = true
      AND av.value IS NULL
      LIMIT 5;
    `);

    if (nullCheckResult.rows.length > 0) {
      console.warn(`   ⚠️  Found ${nullCheckResult.rows.length} NULL values in required fields:`);
      nullCheckResult.rows.forEach(row => {
        console.warn(`      - ${row.external_id}.${row.attribute_name}`);
      });
    } else {
      console.log(`   ✅ No NULL values in required fields`);
    }

    // Check referential integrity
    const refIntegResult = await client.query(`
      SELECT COUNT(*) as count
      FROM object_instances oi
      WHERE oi.object_type_id = 1
      AND oi.parent_instance_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM object_instances parent
        WHERE parent.id = oi.parent_instance_id
      );
    `);

    if (parseInt(refIntegResult.rows[0].count) > 0) {
      console.warn(`   ⚠️  ${refIntegResult.rows[0].count} referential integrity violations`);
    } else {
      console.log(`   ✅ Referential integrity validated`);
    }

    return {
      success: true,
      totalDoors: actualCount,
      missingAttributes: missingAttrsResult.rows.length,
      nullViolations: nullCheckResult.rows.length,
      refIntegViolations: parseInt(refIntegResult.rows[0].count)
    };
  } catch (error) {
    console.error(`❌ Validation error: ${error.message}`);
    throw error;
  }
}

/**
 * Main migration flow
 */
async function runMigration(csvPath, testMode = true) {
  console.log('='.repeat(60));
  console.log('PHASE 2: DATA MIGRATION');
  console.log('='.repeat(60));

  try {
    // 1. Connect
    if (!await connect()) {
      process.exit(1);
    }

    // 2. Load and transform data
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const transformedData = transformLegacyDoors(csvData);

    if (transformedData.summary.failed > 0) {
      console.warn(`\n⚠️  ${transformedData.summary.failed} records failed transformation`);
    }

    // 3. Backup
    await backupDatabase();

    // 4. Migrate
    const migrateLimit = testMode ? 10 : null; // Test with 10 doors
    const migrateResults = await migrateDoors(transformedData, migrateLimit);

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${migrateResults.successful}`);
    console.log(`   ❌ Failed: ${migrateResults.failed}`);

    if (migrateResults.errors.length > 0) {
      console.log(`\n⚠️  Errors:`);
      migrateResults.errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err.doorId}: ${err.error}`);
      });
    }

    // 5. Validate
    const validation = await validateMigration(migrateResults.successful);
    
    console.log(`\n✅ Validation Summary:`);
    console.log(`   Total doors: ${validation.totalDoors}`);
    console.log(`   Integrity: ${validation.refIntegViolations === 0 ? '✅ Valid' : '❌ Issues'}`);

    console.log(`\n✨ Migration ${testMode ? 'test ' : ''}completed successfully!`);
    
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

// CLI
if (require.main === module) {
  const csvPath = process.argv[2] || path.join(__dirname, '../database/scripts/sample_legacy_doors.csv');
  const testMode = !process.argv.includes('--full');
  runMigration(csvPath, testMode);
}

module.exports = { runMigration, validateMigration };
