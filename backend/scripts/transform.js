/**
 * Phase 2: Data Transformation Layer
 * 
 * Converts legacy Samrum door data → OMS schema
 * - Parse CSV input
 * - Map legacy fields → OMS attributes
 * - Handle conversions (NULLs, defaults, type casts)
 * - Generate OMS-formatted objects
 * - Validate transformed data
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// OMS Attribute Mapping: legacy_field -> OMS attribute_id
const ATTRIBUTE_MAPPING = {
  door_id: { id: 1, type: 'text', required: true },
  door_name: { id: 2, type: 'text', required: true },
  location: { id: 3, type: 'text', required: false },
  fire_class: { id: 4, type: 'enum', required: true, enum: ['EI30', 'EI60', 'EI90', 'EI120'] },
  security_class: { id: 5, type: 'enum', required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] },
  lock_type: { id: 6, type: 'enum', required: false, enum: ['mortise', 'rim', 'electronic', 'smart'] },
  automation_model: { id: 7, type: 'text', required: false },
  wall_type: { id: 8, type: 'enum', required: false, enum: ['exterior_brick', 'exterior_concrete', 'interior_drywall', 'interior_concrete', 'industrial_steel', 'industrial_concrete', 'stainless_steel'] },
  building_code: { id: 9, type: 'text', required: false },
  floor_number: { id: 10, type: 'number', required: false },
  wing_section: { id: 11, type: 'text', required: false },
  width_mm: { id: 12, type: 'number', required: false },
  height_mm: { id: 13, type: 'number', required: false },
  thickness_mm: { id: 14, type: 'number', required: false },
  material: { id: 15, type: 'enum', required: false, enum: ['steel', 'wood_veneered', 'glass_aluminium', 'wood_composite', 'steel_reinforced'] },
  frame_type: { id: 16, type: 'enum', required: false, enum: ['steel_frame', 'wood_frame', 'aluminium_frame', 'steel_reinforced'] },
  hinges_count: { id: 17, type: 'number', required: false },
  door_swing: { id: 18, type: 'enum', required: false, enum: ['left', 'right', 'single', 'both'] },
  has_closer: { id: 19, type: 'boolean', required: false },
  has_panic_bar: { id: 20, type: 'boolean', required: false },
  has_visual_alarm: { id: 21, type: 'boolean', required: false },
  has_acoustic_alarm: { id: 22, type: 'boolean', required: false },
  installation_date: { id: 23, type: 'date', required: false },
  last_maintenance_date: { id: 24, type: 'date', required: false },
  maintenance_interval_months: { id: 25, type: 'number', required: false },
  warranty_expiry_date: { id: 26, type: 'date', required: false },
  manufacturer: { id: 27, type: 'text', required: false },
  model_number: { id: 28, type: 'text', required: false },
  batch_number: { id: 29, type: 'text', required: false },
  serial_number: { id: 30, type: 'text', required: false },
  weight_kg: { id: 31, type: 'number', required: false },
  cost_eur: { id: 32, type: 'number', required: false },
  status: { id: 33, type: 'enum', required: false, enum: ['operational', 'maintenance', 'broken', 'decommissioned'] },
  notes: { id: 34, type: 'text', required: false }
};

// Object type IDs (from OMS schema)
const OBJECT_TYPES = {
  DOOR: 1,
  LOCK: 2,
  FRAME: 3,
  AUTOMATION: 4,
  WALL_TYPE: 5
};

/**
 * Convert legacy field value to OMS format
 */
function convertValue(fieldName, value, mapping) {
  if (!value || value === '') {
    return null;
  }

  const { type } = mapping;

  try {
    switch (type) {
      case 'number':
        return parseFloat(value).toString();
      case 'boolean':
        return (value.toLowerCase() === 'true' || value === '1') ? 'true' : 'false';
      case 'date':
        // Validate date format YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          console.warn(`Invalid date format for ${fieldName}: ${value}`);
          return null;
        }
        return value;
      case 'enum':
        // Validate against enum values
        if (!mapping.enum.includes(value)) {
          console.warn(`Invalid enum value for ${fieldName}: ${value}, using first enum value as default`);
          return mapping.enum[0];
        }
        return value;
      case 'text':
      default:
        return value.toString();
    }
  } catch (error) {
    console.warn(`Error converting ${fieldName}=${value}: ${error.message}`);
    return null;
  }
}

/**
 * Transform single legacy door row to OMS object instance
 */
function transformDoor(legacyRow) {
  const errors = [];
  const warnings = [];
  const attributeValues = [];

  // Extract door_id (external_id)
  const doorId = legacyRow.door_id?.trim();
  if (!doorId) {
    errors.push('Missing door_id');
    return null;
  }

  // Transform each attribute
  for (const [legacyField, value] of Object.entries(legacyRow)) {
    const mapping = ATTRIBUTE_MAPPING[legacyField];
    
    if (!mapping) {
      warnings.push(`Unknown field: ${legacyField}`);
      continue;
    }

    const convertedValue = convertValue(legacyField, value, mapping);

    // Check required fields
    if (mapping.required && !convertedValue) {
      errors.push(`Missing required field: ${legacyField}`);
      continue;
    }

    // Only add attribute if it has a value
    if (convertedValue !== null) {
      attributeValues.push({
        attribute_id: mapping.id,
        attribute_name: legacyField,
        value: convertedValue
      });
    }
  }

  if (errors.length > 0) {
    return {
      error: true,
      doorId,
      errors,
      warnings
    };
  }

  // Build OMS door instance
  const doorName = legacyRow.door_name?.trim() || doorId;
  const omsObject = {
    object_type_id: OBJECT_TYPES.DOOR,
    external_id: doorId,
    name: doorName,
    attribute_values: attributeValues,
    validation: {
      errors: [],
      warnings
    }
  };

  return omsObject;
}

/**
 * Transform all legacy doors
 */
function transformLegacyDoors(csvData) {
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const results = {
    successful: [],
    failed: [],
    summary: {
      totalRows: records.length,
      successful: 0,
      failed: 0,
      warnings: 0
    }
  };

  for (const record of records) {
    const transformed = transformDoor(record);
    
    if (transformed === null || transformed.error) {
      results.failed.push(transformed);
      results.summary.failed++;
    } else {
      results.successful.push(transformed);
      results.summary.successful++;
      if (transformed.validation.warnings.length > 0) {
        results.summary.warnings++;
      }
    }
  }

  return results;
}

/**
 * Load and transform CSV file
 */
function loadAndTransform(csvPath) {
  console.log(`📖 Loading CSV from: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvData = fs.readFileSync(csvPath, 'utf-8');
  console.log(`✅ CSV loaded (${csvData.length} bytes)`);

  console.log(`🔄 Transforming data...`);
  const results = transformLegacyDoors(csvData);

  console.log(`\n📊 Transformation Summary:`);
  console.log(`   Total rows:     ${results.summary.totalRows}`);
  console.log(`   ✅ Successful:  ${results.summary.successful}`);
  console.log(`   ❌ Failed:      ${results.summary.failed}`);
  console.log(`   ⚠️  Warnings:   ${results.summary.warnings}`);

  if (results.failed.length > 0) {
    console.log(`\n⚠️  Failed Records:`);
    results.failed.forEach(record => {
      console.log(`   - ${record.doorId}: ${record.errors.join(', ')}`);
    });
  }

  return results;
}

/**
 * Export for use in migration script
 */
module.exports = {
  transformLegacyDoors,
  transformDoor,
  ATTRIBUTE_MAPPING,
  OBJECT_TYPES,
  loadAndTransform
};

// CLI Usage
if (require.main === module) {
  const csvPath = process.argv[2] || path.join(__dirname, '../database/scripts/sample_legacy_doors.csv');
  const results = loadAndTransform(csvPath);

  // Output JSON
  const outputPath = path.join(__dirname, '../database/scripts/transformed_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Results saved to: ${outputPath}`);

  process.exit(results.summary.failed > 0 ? 1 : 0);
}
