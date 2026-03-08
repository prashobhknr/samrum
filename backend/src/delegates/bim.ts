/**
 * BIM/IFC Delegates
 *
 * Delegates for IFC model processing, clash detection, and OMS sync.
 * Referenced by: portfolio/bim-coordination.bpmn
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/** IFC entity type → OMS object type mapping */
const IFC_TYPE_MAP: Record<string, number> = {
  IfcDoor: 6,        // ID tillträdesobjekt
  IfcSpace: 9,       // Rum
  IfcWall: 3,        // Wall Type (assumed)
  IfcWindow: 4,      // Window (assumed)
  IfcSlab: 5,        // Slab (assumed)
};

/** IFC property → OMS attribute ID mapping */
const IFC_ATTR_MAP: Record<string, Record<string, number>> = {
  IfcDoor: { width: 200, height: 205, fire_rating: 520, name: 199 },
  IfcSpace: { room_name: 718, floor: 725, area: 200, name: 199 },
};

/**
 * ifcImportDelegate
 * Handles initial IFC file registration and storage.
 */
export const ifcImportDelegate: CamundaDelegate = {
  name: 'ifcImportDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, modelName, ifcFilePath, ifcSchema } = execution.variables as {
      buildingId: number;
      modelName: string;
      ifcFilePath?: string;
      ifcSchema?: string;
    };

    // Auto-version
    const vr = await db.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as nv FROM bim_models WHERE building_instance_id = $1',
      [buildingId]
    );

    const result = await db.query(
      `INSERT INTO bim_models (building_instance_id, model_name, ifc_schema, version, file_path, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, 'system') RETURNING *`,
      [buildingId, modelName, ifcSchema || 'IFC4', vr.rows[0].nv, ifcFilePath || null]
    );

    const model = result.rows[0];

    return {
      success: true,
      variables: {
        bimModelId: pvar(model.id, 'Long'),
        bimModelVersion: pvar(model.version, 'Long'),
      },
    };
  },
};

/**
 * ifcParseDelegate
 * Parses IFC file and extracts entities into bim_entity_mappings.
 * In production: calls an IFC parsing service (e.g., IfcOpenShell, xBIM).
 */
export const ifcParseDelegate: CamundaDelegate = {
  name: 'ifcParseDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { bimModelId } = execution.variables as { bimModelId: number };

    // Update model status to parsing
    await db.query(
      "UPDATE bim_models SET status = 'parsing' WHERE id = $1",
      [bimModelId]
    );

    // In production: call IFC parsing service and get entity list
    // Stub: mark as parsed with 0 entities (real parsing happens externally)
    await db.query(
      "UPDATE bim_models SET status = 'parsed', parsed_entity_count = 0 WHERE id = $1",
      [bimModelId]
    );

    return {
      success: true,
      variables: {
        parseCompleted: pvar(true, 'Boolean'),
        parsedEntityCount: pvar(0, 'Long'),
      },
    };
  },
};

/**
 * bimValidationDelegate
 * Validates parsed IFC model against schema rules.
 */
export const bimValidationDelegate: CamundaDelegate = {
  name: 'bimValidationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { bimModelId } = execution.variables as { bimModelId: number };

    const model = await db.query('SELECT * FROM bim_models WHERE id = $1', [bimModelId]);
    if (model.rows.length === 0) {
      return { success: false, error: `BIM model ${bimModelId} not found` };
    }

    const issues: string[] = [];

    // Check entity mappings exist
    const entityCount = await db.query(
      'SELECT COUNT(*) as count FROM bim_entity_mappings WHERE bim_model_id = $1',
      [bimModelId]
    );

    if (parseInt(entityCount.rows[0].count) === 0) {
      issues.push('No entities found in parsed model');
    }

    // Check for unmapped entity types
    const unmapped = await db.query(
      `SELECT DISTINCT ifc_entity_type, COUNT(*) as count
       FROM bim_entity_mappings
       WHERE bim_model_id = $1 AND oms_object_instance_id IS NULL
       GROUP BY ifc_entity_type`,
      [bimModelId]
    );

    for (const row of unmapped.rows) {
      issues.push(`${row.count} unmapped ${row.ifc_entity_type} entities`);
    }

    const status = issues.length === 0 ? 'validated' : 'validation_warning';
    await db.query(
      'UPDATE bim_models SET status = $1, validation_issues = $2 WHERE id = $3',
      [status, JSON.stringify(issues), bimModelId]
    );

    return {
      success: true,
      variables: {
        bimValidationPassed: pvar(issues.length === 0, 'Boolean'),
        bimValidationIssues: pvar(issues, 'Json'),
      },
    };
  },
};

/**
 * clashDetectionDelegate
 * Runs clash detection between BIM entities.
 * In production: calls a clash detection service (e.g., Navisworks API, BIMcollab).
 */
export const clashDetectionDelegate: CamundaDelegate = {
  name: 'clashDetectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { bimModelId } = execution.variables as { bimModelId: number };

    // In production: invoke external clash detection
    // Stub: query existing clashes
    const clashes = await db.query(
      `SELECT status, COUNT(*) as count FROM bim_clash_results
       WHERE bim_model_id = $1 GROUP BY status`,
      [bimModelId]
    );

    const totalClashes = clashes.rows.reduce((sum: number, r: { count: string }) => sum + parseInt(r.count), 0);
    const unresolvedClashes = clashes.rows
      .filter((r: { status: string }) => r.status === 'new' || r.status === 'active')
      .reduce((sum: number, r: { count: string }) => sum + parseInt(r.count), 0);

    return {
      success: true,
      variables: {
        clashDetectionCompleted: pvar(true, 'Boolean'),
        totalClashes: pvar(totalClashes, 'Long'),
        unresolvedClashes: pvar(unresolvedClashes, 'Long'),
        clashSummary: pvar(clashes.rows, 'Json'),
      },
    };
  },
};

/**
 * bimSyncDelegate
 * Syncs IFC entity attributes to OMS attribute_values.
 * Called 3 times in bim-coordination: doors, rooms, fire elements.
 */
export const bimSyncDelegate: CamundaDelegate = {
  name: 'bimSyncDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { bimModelId, syncEntityType, attributeMapping } = execution.variables as {
      bimModelId: number;
      syncEntityType: string; // e.g. 'IfcDoor'
      attributeMapping?: string; // e.g. 'width:200,height:205,fire_rating:520'
    };

    // Parse attribute mapping
    const attrMap = attributeMapping
      ? Object.fromEntries(attributeMapping.split(',').map(pair => {
          const [ifcProp, omsAttrId] = pair.split(':');
          return [ifcProp.trim(), parseInt(omsAttrId.trim())];
        }))
      : IFC_ATTR_MAP[syncEntityType] || {};

    // Get entities to sync
    const entities = await db.query(
      `SELECT * FROM bim_entity_mappings
       WHERE bim_model_id = $1 AND ifc_entity_type = $2 AND sync_status != 'synced'`,
      [bimModelId, syncEntityType]
    );

    let synced = 0;
    let errors = 0;

    for (const entity of entities.rows) {
      if (!entity.oms_object_instance_id) {
        // Auto-create OMS instance if mapping exists
        const omsTypeId = IFC_TYPE_MAP[syncEntityType];
        if (omsTypeId) {
          const newInstance = await db.query(
            `INSERT INTO object_instances (object_type_id, name, external_id, created_by)
             VALUES ($1, $2, $3, 'bim_sync') RETURNING id`,
            [omsTypeId, entity.ifc_name || entity.ifc_global_id, entity.ifc_global_id]
          );

          await db.query(
            'UPDATE bim_entity_mappings SET oms_object_instance_id = $1 WHERE id = $2',
            [newInstance.rows[0].id, entity.id]
          );
          entity.oms_object_instance_id = newInstance.rows[0].id;
        }
      }

      if (entity.oms_object_instance_id && entity.ifc_properties) {
        const props = typeof entity.ifc_properties === 'string'
          ? JSON.parse(entity.ifc_properties)
          : entity.ifc_properties;

        for (const [ifcProp, omsAttrId] of Object.entries(attrMap)) {
          if (props[ifcProp] !== undefined) {
            await db.query(
              `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
               VALUES ($1, $2, $3, 'MEASURED')
               ON CONFLICT (object_instance_id, object_attribute_id)
               DO UPDATE SET value = $3, value_qualifier = 'MEASURED'`,
              [entity.oms_object_instance_id, omsAttrId, String(props[ifcProp])]
            );
          }
        }

        await db.query(
          "UPDATE bim_entity_mappings SET sync_status = 'synced', last_sync_at = NOW() WHERE id = $1",
          [entity.id]
        );
        synced++;
      } else {
        await db.query(
          "UPDATE bim_entity_mappings SET sync_status = 'error' WHERE id = $1",
          [entity.id]
        );
        errors++;
      }
    }

    return {
      success: true,
      variables: {
        syncCompleted: pvar(true, 'Boolean'),
        syncedCount: pvar(synced, 'Long'),
        syncErrorCount: pvar(errors, 'Long'),
        syncEntityType: pvar(syncEntityType, 'String'),
      },
    };
  },
};
