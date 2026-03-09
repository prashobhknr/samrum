/**
 * Operations Delegates
 *
 * Delegates for maintenance, inspections, access, energy, and archive.
 * Referenced by: operations-phase subprocesses
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/**
 * maintenanceQueryDelegate
 * Queries objects due for maintenance based on last_maintenance_date.
 */
export const maintenanceQueryDelegate: CamundaDelegate = {
  name: 'maintenanceQueryDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // Find objects where maintenance is due (last_maintenance_date + interval < NOW)
    const dueObjects = await db.query(
      `SELECT oi.id, oi.name, oi.external_id, ot.name as type_name,
        MAX(CASE WHEN oa.sys_name = 'last_maintenance_date' THEN av.value END) as last_maintenance,
        MAX(CASE WHEN oa.sys_name = 'maintenance_interval_days' THEN av.value END) as interval_days
       FROM object_instances oi
       JOIN object_types ot ON oi.object_type_id = ot.id
       LEFT JOIN attribute_values av ON av.object_instance_id = oi.id
       LEFT JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE oi.object_type_id IN (
         SELECT DISTINCT object_type_id FROM object_instances
         WHERE id IN (SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1)
       )
       GROUP BY oi.id, oi.name, oi.external_id, ot.name
       HAVING MAX(CASE WHEN oa.sys_name = 'last_maintenance_date' THEN av.value END) IS NULL
          OR (MAX(CASE WHEN oa.sys_name = 'last_maintenance_date' THEN av.value END))::date
             + (COALESCE(MAX(CASE WHEN oa.sys_name = 'maintenance_interval_days' THEN av.value END), '365'))::int
             <= CURRENT_DATE
       ORDER BY ot.name, oi.name`,
      [buildingId]
    );

    return {
      success: true,
      variables: {
        dueMaintenanceObjects: pvar(dueObjects.rows, 'Json'),
        dueMaintenanceCount: pvar(dueObjects.rows.length, 'Long'),
      },
    };
  },
};

/**
 * maintenanceDateDelegate
 * Updates the last_maintenance_date after maintenance is performed.
 */
export const maintenanceDateDelegate: CamundaDelegate = {
  name: 'maintenanceDateDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { objectInstanceId } = execution.variables as { objectInstanceId: number };

    await db.query(
      `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
       SELECT $1, id, CURRENT_DATE::text, 'MEASURED'
       FROM object_attributes WHERE sys_name = 'last_maintenance_date'
       ON CONFLICT (object_instance_id, object_attribute_id)
       DO UPDATE SET value = CURRENT_DATE::text, value_qualifier = 'MEASURED'`,
      [objectInstanceId]
    );

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'MAINTENANCE_COMPLETED', $2, NOW())`,
      [objectInstanceId, new Date().toISOString()]
    );

    return {
      success: true,
      variables: {
        maintenanceCompleted: pvar(true, 'Boolean'),
        maintenanceDate: pvar(new Date().toISOString().split('T')[0], 'String'),
      },
    };
  },
};

/**
 * inspectionQueryDelegate
 * Queries objects due for annual inspection (OVK, fire, elevator, etc.).
 */
export const inspectionQueryDelegate: CamundaDelegate = {
  name: 'inspectionQueryDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, inspectionType } = execution.variables as {
      buildingId: number;
      inspectionType?: string;
    };

    // Query objects needing inspection based on type
    const typeFilter = inspectionType
      ? `AND ot.name ILIKE '%' || $2 || '%'`
      : '';

    const params: unknown[] = [buildingId];
    if (inspectionType) params.push(inspectionType);

    const result = await db.query(
      `SELECT oi.id, oi.name, oi.external_id, ot.name as type_name
       FROM object_instances oi
       JOIN object_types ot ON oi.object_type_id = ot.id
       WHERE oi.id IN (
         SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1
       ) ${typeFilter}
       ORDER BY ot.name, oi.name`,
      params
    );

    return {
      success: true,
      variables: {
        inspectionObjects: pvar(result.rows, 'Json'),
        inspectionCount: pvar(result.rows.length, 'Long'),
      },
    };
  },
};

/**
 * energyDataCollectionDelegate
 * Collects energy consumption data for the building.
 */
export const energyDataCollectionDelegate: CamundaDelegate = {
  name: 'energyDataCollectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: integrate with energy monitoring API (e.g., Metry, EnergyHub)
    // Stub: collect from attribute_values
    const energyData = await db.query(
      `SELECT oa.attribute_name, av.value, av.value_qualifier
       FROM attribute_values av
       JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE av.object_instance_id = $1
         AND oa.sys_name IN ('energy_kwh_total', 'energy_kwh_heating', 'energy_kwh_cooling',
                             'energy_kwh_electricity', 'water_m3_total')`,
      [buildingId]
    );

    return {
      success: true,
      variables: {
        energyData: pvar(energyData.rows, 'Json'),
        dataCollectedAt: pvar(new Date().toISOString(), 'String'),
      },
    };
  },
};

/**
 * accessProvisionDelegate
 * Provisions access cards/credentials in the access control system.
 */
export const accessProvisionDelegate: CamundaDelegate = {
  name: 'accessProvisionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, userId, accessLevel, doorIds } = execution.variables as {
      buildingId: number;
      userId?: string;
      accessLevel?: string;
      doorIds?: number[];
    };

    // In production: call external access control API (ASSA ABLOY, HID, etc.)
    // Stub: update door access attributes
    let provisioned = 0;

    if (doorIds && doorIds.length > 0) {
      for (const doorId of doorIds) {
        await db.query(
          `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
           SELECT $1, id, $2, 'MEASURED'
           FROM object_attributes WHERE id = 368
           ON CONFLICT (object_instance_id, object_attribute_id)
           DO UPDATE SET value = $2, value_qualifier = 'MEASURED'`,
          [doorId, accessLevel || 'standard']
        );
        provisioned++;
      }
    }

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, $2, 'ACCESS_PROVISIONED', $3, NOW())`,
      [buildingId, userId || 'system', JSON.stringify({ accessLevel, doorCount: provisioned })]
    );

    return {
      success: true,
      variables: {
        accessProvisioned: pvar(true, 'Boolean'),
        provisionedDoorCount: pvar(provisioned, 'Long'),
      },
    };
  },
};

/**
 * archiveDelegate
 * Archives building data during decommission phase.
 */
export const archiveDelegate: CamundaDelegate = {
  name: 'archiveDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // Mark all instances as archived
    const result = await db.query(
      `UPDATE object_instances SET is_locked = true
       WHERE id IN (
         SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1
         UNION SELECT $1
       )
       RETURNING id`,
      [buildingId]
    );

    // Deactivate in portfolio
    await db.query(
      `UPDATE building_portfolio SET is_active = false, lifecycle_phase = 'decommission', updated_at = NOW()
       WHERE building_instance_id = $1`,
      [buildingId]
    );

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'BUILDING_ARCHIVED', $2, NOW())`,
      [buildingId, JSON.stringify({ archivedInstances: result.rows.length })]
    );

    return {
      success: true,
      variables: {
        archiveCompleted: pvar(true, 'Boolean'),
        archivedInstanceCount: pvar(result.rows.length, 'Long'),
      },
    };
  },
};
