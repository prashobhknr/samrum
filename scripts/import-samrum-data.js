#!/usr/bin/env node
/**
 * Import Samrum CSV data into PostgreSQL samrum_ tables.
 * Separator: semicolon (;). NULL literal in CSV = NULL in DB.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import pkg from 'pg';
const { Client } = pkg;

const CSV_DIR = '/Users/prashobh/Downloads/Visakh/Database Excel';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db'
});

/** Parse a semicolon-delimited CSV line, handling quoted fields */
function parseLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Convert a raw string to null if it equals 'NULL' or is empty */
function toNull(val) {
  if (val === undefined || val === null) return null;
  const s = val.trim();
  if (s === 'NULL' || s === '') return null;
  return s;
}

/** Convert to boolean: '1' / 'true' → true, else false */
function toBool(val) {
  const s = toNull(val);
  if (s === null) return false;
  return s === '1' || s.toLowerCase() === 'true';
}

/** Convert to integer or null */
function toInt(val) {
  const s = toNull(val);
  if (s === null) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** Read a CSV file, returning { headers, rows } where rows are raw string arrays */
async function readCsv(filename) {
  const filepath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  ⚠ File not found: ${filepath}`);
    return { headers: [], rows: [] };
  }

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(filepath) });
    const allLines = [];
    rl.on('line', line => allLines.push(line));
    rl.on('close', () => {
      if (allLines.length === 0) return resolve({ headers: [], rows: [] });
      // Strip BOM from first line
      allLines[0] = allLines[0].replace(/^\uFEFF/, '');
      const headers = parseLine(allLines[0]);
      const rows = allLines.slice(1).filter(l => l.trim()).map(parseLine);
      resolve({ headers, rows });
    });
    rl.on('error', reject);
  });
}

async function importStorageTypes() {
  console.log('Importing samrum_storage_types...');
  const { rows } = await readCsv('ST_StorageType.csv');
  let count = 0;
  for (const row of rows) {
    const id   = toInt(row[0]);
    const name = toNull(row[1]);
    if (id === null || name === null) continue;
    await client.query(
      'INSERT INTO samrum_storage_types (id, name) OVERRIDING SYSTEM VALUE VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name=$2',
      [id, name]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_storage_types_id_seq', (SELECT MAX(id) FROM samrum_storage_types))");
  console.log(`  ✓ ${count} storage types`);
}

async function importDataTypes() {
  console.log('Importing samrum_data_types...');
  const { rows } = await readCsv('DT_DataType.csv');
  // Headers: DT_ID;DT_Name;DT_AllowUserToCreateObjectType;DT_Complex;DT_ST_ID_StorageType;DT_Entity;...
  let count = 0;
  for (const row of rows) {
    const id              = toInt(row[0]);
    const name            = toNull(row[1]);
    const allowUser       = toBool(row[2]);
    const isComplex       = toBool(row[3]);
    const storageTypeId   = toInt(row[4]);
    const isEntity        = toBool(row[5]);
    if (id === null) continue;
    await client.query(
      `INSERT INTO samrum_data_types (id, name, allow_user_create, is_complex, storage_type_id, is_entity)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET name=$2, allow_user_create=$3, is_complex=$4, storage_type_id=$5, is_entity=$6`,
      [id, name, allowUser, isComplex, storageTypeId, isEntity]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_data_types_id_seq', (SELECT MAX(id) FROM samrum_data_types))");
  console.log(`  ✓ ${count} data types`);
}

async function importClassifications() {
  console.log('Importing samrum_classifications...');
  const { rows } = await readCsv('OTC_ObjectTypeClassification.csv');
  // Headers: OTC_ID;OTC_Name;OTC_Description;...
  let count = 0;
  for (const row of rows) {
    const id   = toInt(row[0]);
    const name = toNull(row[1]);
    const desc = toNull(row[2]);
    if (id === null) continue;
    await client.query(
      `INSERT INTO samrum_classifications (id, name, description)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET name=$2, description=$3`,
      [id, name, desc]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_classifications_id_seq', (SELECT MAX(id) FROM samrum_classifications))");
  console.log(`  ✓ ${count} classifications`);
}

async function importObjectTypes() {
  console.log('Importing samrum_object_types...');
  const { rows } = await readCsv('OT_ObjectType.csv');
  // Headers: OT_ID;OT_DT_ID_DataType;OT_NameSingular;OT_NamePlural;OT_DefaultAttributeCaption;OT_Description;OT_ObjectIsAbstract;OT_OTC_ID_Classification;OT_DatabaseId;OT_ExistsOnlyInParentScope;...
  let count = 0;
  for (const row of rows) {
    const id             = toInt(row[0]);
    const dataTypeId     = toInt(row[1]);
    const nameSingular   = toNull(row[2]);
    const namePlural     = toNull(row[3]);
    const defAttrCaption = toNull(row[4]);
    const description    = toNull(row[5]);
    const isAbstract     = toBool(row[6]);
    const classifId      = toInt(row[7]);
    const databaseId     = toNull(row[8]);
    const existsInParent = toBool(row[9]);
    if (id === null) continue;
    await client.query(
      `INSERT INTO samrum_object_types
         (id, data_type_id, name_singular, name_plural, default_attr_caption, description, is_abstract, classification_id, database_id, exists_only_in_parent_scope)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         data_type_id=$2, name_singular=$3, name_plural=$4, default_attr_caption=$5,
         description=$6, is_abstract=$7, classification_id=$8, database_id=$9, exists_only_in_parent_scope=$10`,
      [id, dataTypeId, nameSingular, namePlural, defAttrCaption, description, isAbstract, classifId, databaseId, existsInParent]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_object_types_id_seq', (SELECT MAX(id) FROM samrum_object_types))");
  console.log(`  ✓ ${count} object types`);
}

async function importModuleFolders() {
  console.log('Importing samrum_module_folders...');
  const { rows } = await readCsv('PMF_ProjectModuleFolder.csv');
  // Headers: PMF_ID;PMF_PMF_ID_ParentProjectModuleFolder;PMF_Name;PMF_Description;...
  let count = 0;
  // First pass: insert without parent_id to avoid FK issues
  for (const row of rows) {
    const id       = toInt(row[0]);
    const parentId = toInt(row[1]);
    const name     = toNull(row[2]);
    const desc     = toNull(row[3]);
    if (id === null) continue;
    await client.query(
      `INSERT INTO samrum_module_folders (id, parent_id, name, description)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET parent_id=$2, name=$3, description=$4`,
      [id, parentId, name, desc]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_module_folders_id_seq', (SELECT MAX(id) FROM samrum_module_folders))");
  console.log(`  ✓ ${count} module folders`);
}

async function importModules() {
  console.log('Importing samrum_modules...');
  const { rows } = await readCsv('PMO_ProjectModule.csv');
  // Headers: PMO_ID;PMO_Name;PMO_Description;PMO_AllowIncompleteVersions;CREATED_BY;CREATED_DATE;CHANGED_BY;CHANGED_DATE;timestamp;PMO_PMF_ID_ProjectModuleFolder
  let count = 0;
  for (const row of rows) {
    const id                    = toInt(row[0]);
    const name                  = toNull(row[1]);
    const description           = toNull(row[2]);
    const allowIncomplete       = toBool(row[3]);
    const folderId              = toInt(row[9]);
    if (id === null) continue;
    await client.query(
      `INSERT INTO samrum_modules (id, name, description, allow_incomplete_versions, folder_id)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, allow_incomplete_versions=$4, folder_id=$5`,
      [id, name, description, allowIncomplete, folderId]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_modules_id_seq', (SELECT MAX(id) FROM samrum_modules))");
  console.log(`  ✓ ${count} modules`);
}

async function importRelationships() {
  console.log('Importing samrum_relationships...');
  const { rows } = await readCsv('OTR_ObjectTypeRelationship.csv');
  // Headers: OTR_ID;OTR_CaptionSingular;OTR_CaptionPlural;OTR_OT_ID_ObjectType;OTR_OT_ID_RelatedObjectType;
  //          OTR_CanBeRelatedToMin;OTR_CanBeRelatedToMax;OTR_CanBeRelatedToMinErrorMessage;OTR_CanBeRelatedToMaxErrorMessage;
  //          OTR_CanBeRelatedByMax;OTR_ConstraintMinNumericValue;OTR_ConstraintMaxNumericValue;OTR_ConstraintMaxNrOfChars;
  //          OTR_ConstraintRegularExpression;OTR_NrOfDecimals;OTR_Sort;OTR_CopyAttribute;OTR_ExistsOnlyInParentScope;
  //          OTR_AllowInLists;OTR_ShowInListsDefault;OTR_IsRequirement;OTR_RequiredInLockedVersion;OTR_SysCaption;
  //          CREATED_BY;CREATED_DATE;CHANGED_BY;CHANGED_DATE;timestamp;OTR_Guid;OTR_RealSort
  let count = 0;
  let skipped = 0;
  for (const row of rows) {
    const id             = toInt(row[0]);
    const capSingular    = toNull(row[1]);
    const capPlural      = toNull(row[2]);
    const fromTypeId     = toInt(row[3]);
    const toTypeId       = toInt(row[4]);
    const minRelations   = toInt(row[5]) ?? 0;
    const maxRelations   = toInt(row[6]);
    const sortOrder      = toInt(row[15]) ?? 0;
    const allowInLists   = toBool(row[18]);
    const showInLists    = toBool(row[19]);
    const isRequirement  = toBool(row[20]);
    const sysCaption     = toNull(row[22]);
    const guidRaw        = toNull(row[28]);
    // Validate UUID format
    const guid = guidRaw && /^[0-9a-fA-F-]{36}$/.test(guidRaw) ? guidRaw : null;

    if (id === null) continue;

    // Skip if from_type_id or to_type_id don't exist (FK integrity)
    if (fromTypeId !== null || toTypeId !== null) {
      // Check existence
      let fromOk = fromTypeId === null;
      let toOk   = toTypeId   === null;
      if (!fromOk) {
        const r = await client.query('SELECT 1 FROM samrum_object_types WHERE id=$1', [fromTypeId]);
        fromOk = r.rows.length > 0;
      }
      if (!toOk) {
        const r = await client.query('SELECT 1 FROM samrum_object_types WHERE id=$1', [toTypeId]);
        toOk = r.rows.length > 0;
      }
      if (!fromOk || !toOk) {
        skipped++;
        continue;
      }
    }

    await client.query(
      `INSERT INTO samrum_relationships
         (id, caption_singular, caption_plural, from_type_id, to_type_id, min_relations, max_relations,
          sort_order, allow_in_lists, show_in_lists_default, is_requirement, sys_caption, guid)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         caption_singular=$2, caption_plural=$3, from_type_id=$4, to_type_id=$5,
         min_relations=$6, max_relations=$7, sort_order=$8, allow_in_lists=$9,
         show_in_lists_default=$10, is_requirement=$11, sys_caption=$12, guid=$13`,
      [id, capSingular, capPlural, fromTypeId, toTypeId, minRelations, maxRelations,
       sortOrder, allowInLists, showInLists, isRequirement, sysCaption, guid]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_relationships_id_seq', (SELECT MAX(id) FROM samrum_relationships))");
  console.log(`  ✓ ${count} relationships (${skipped} skipped - FK missing)`);
}

async function importModuleObjectTypes() {
  console.log('Importing samrum_module_object_types...');
  const { rows } = await readCsv('OTM_ProjectModuleObjectType.csv');
  // Headers: OTM_ID;OTM_OT_ID_ObjectType;OTM_PMO_ID_Module;OTM_AllowEdit;OTM_ShowObjectTypeAsRoot;OTM_AllowInsert;...;OTM_IsMainObjectType
  let count = 0;
  let skipped = 0;
  for (const row of rows) {
    const id             = toInt(row[0]);
    const objectTypeId   = toInt(row[1]);
    const moduleId       = toInt(row[2]);
    const allowEdit      = toBool(row[3]);
    const showAsRoot     = toBool(row[4]);
    const allowInsert    = toBool(row[5]);
    const isMainOT       = toBool(row[11]);
    if (id === null) continue;

    // Check FK references
    let modOk = true, otOk = true;
    if (moduleId !== null) {
      const r = await client.query('SELECT 1 FROM samrum_modules WHERE id=$1', [moduleId]);
      modOk = r.rows.length > 0;
    }
    if (objectTypeId !== null) {
      const r = await client.query('SELECT 1 FROM samrum_object_types WHERE id=$1', [objectTypeId]);
      otOk = r.rows.length > 0;
    }
    if (!modOk || !otOk) { skipped++; continue; }

    await client.query(
      `INSERT INTO samrum_module_object_types (id, module_id, object_type_id, allow_edit, show_as_root, allow_insert, is_main_object_type)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET module_id=$2, object_type_id=$3, allow_edit=$4, show_as_root=$5, allow_insert=$6, is_main_object_type=$7`,
      [id, moduleId, objectTypeId, allowEdit, showAsRoot, allowInsert, isMainOT]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_module_object_types_id_seq', (SELECT MAX(id) FROM samrum_module_object_types))");
  console.log(`  ✓ ${count} module object types (${skipped} skipped)`);
}

async function importModuleRelationships() {
  console.log('Importing samrum_module_relationships...');
  const { rows } = await readCsv('OTRM_ProjectModuleObjectTypeRelationship.csv');
  // Headers: OTRM_ID;OTRM_OTR_ID_ObjectTypeRelationship;OTRM_PMO_ID_Module;OTRM_ReadOnly;...
  let count = 0;
  let skipped = 0;
  for (const row of rows) {
    const id             = toInt(row[0]);
    const relationshipId = toInt(row[1]);
    const moduleId       = toInt(row[2]);
    const readOnly       = toBool(row[3]);
    const allowEdit      = !readOnly;
    if (id === null) continue;

    // Check FK references
    let modOk = true, relOk = true;
    if (moduleId !== null) {
      const r = await client.query('SELECT 1 FROM samrum_modules WHERE id=$1', [moduleId]);
      modOk = r.rows.length > 0;
    }
    if (relationshipId !== null) {
      const r = await client.query('SELECT 1 FROM samrum_relationships WHERE id=$1', [relationshipId]);
      relOk = r.rows.length > 0;
    }
    if (!modOk || !relOk) { skipped++; continue; }

    await client.query(
      `INSERT INTO samrum_module_relationships (id, module_id, relationship_id, allow_edit, read_only)
       OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET module_id=$2, relationship_id=$3, allow_edit=$4, read_only=$5`,
      [id, moduleId, relationshipId, allowEdit, readOnly]
    );
    count++;
  }
  await client.query("SELECT setval('samrum_module_relationships_id_seq', (SELECT MAX(id) FROM samrum_module_relationships))");
  console.log(`  ✓ ${count} module relationships (${skipped} skipped)`);
}

async function main() {
  console.log('=== Samrum CSV Import ===\n');
  await client.connect();
  console.log('Connected to PostgreSQL\n');

  try {
    await importStorageTypes();
    await importDataTypes();
    await importClassifications();
    await importObjectTypes();
    await importModuleFolders();
    await importModules();
    await importRelationships();
    await importModuleObjectTypes();
    await importModuleRelationships();

    console.log('\n=== Import Complete ===');

    // Summary counts
    const tables = [
      'samrum_storage_types',
      'samrum_data_types',
      'samrum_classifications',
      'samrum_object_types',
      'samrum_module_folders',
      'samrum_modules',
      'samrum_relationships',
      'samrum_module_object_types',
      'samrum_module_relationships',
    ];
    console.log('\nFinal row counts:');
    for (const tbl of tables) {
      const r = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`  ${tbl}: ${r.rows[0].count}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
