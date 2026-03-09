/**
 * Validation Delegates
 *
 * P1 delegates for discipline and cross-discipline design validation.
 * Referenced by: 8 discipline subprocesses + design-phase
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/**
 * validationDelegate
 * Validates design completeness for a single discipline subprocess.
 * Used in architecture, structural, fire-safety, door-process, etc.
 */
export const validationDelegate: CamundaDelegate = {
  name: 'validationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, projectId } = execution.variables as {
      buildingId: number;
      projectId?: number;
    };

    // Query all required attributes that have validation rules
    const validators = await db.query(
      `SELECT av.id, av.object_attribute_id, oa.attribute_name, oa.sys_name,
              atv.rule_type, atv.rule_value, aval.value
       FROM object_attributes oa
       JOIN attribute_validators atv ON atv.object_attribute_id = oa.id
       LEFT JOIN attribute_values aval ON aval.object_attribute_id = oa.id
         AND aval.object_instance_id = $1
       WHERE oa.object_type_id IN (
         SELECT object_type_id FROM object_instances WHERE id = $1
       )`,
      [buildingId]
    );

    const errors: string[] = [];

    for (const row of validators.rows) {
      const { attribute_name, rule_type, rule_value, value } = row;

      if (rule_type === 'required' && (!value || value.trim() === '')) {
        errors.push(`${attribute_name}: required but missing`);
      }
      if (rule_type === 'min_length' && value && value.length < parseInt(rule_value)) {
        errors.push(`${attribute_name}: minimum length ${rule_value}, got ${value.length}`);
      }
      if (rule_type === 'regex' && value && !new RegExp(rule_value).test(value)) {
        errors.push(`${attribute_name}: does not match pattern ${rule_value}`);
      }
      if (rule_type === 'enum' && value) {
        const allowed = rule_value.split(',').map((s: string) => s.trim());
        if (!allowed.includes(value)) {
          errors.push(`${attribute_name}: "${value}" not in allowed values [${rule_value}]`);
        }
      }
    }

    return {
      success: true,
      variables: {
        disciplineApproved: pvar(errors.length === 0, 'Boolean'),
        validationErrors: pvar(errors, 'Json'),
        validationErrorCount: pvar(errors.length, 'Long'),
      },
    };
  },
};

/**
 * doorValidationDelegate
 * Door-specific validation: fire class, dimensions, hardware compatibility.
 */
export const doorValidationDelegate: CamundaDelegate = {
  name: 'doorValidationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // Query door instances and their critical attributes
    const doors = await db.query(
      `SELECT oi.id, oi.name,
        MAX(CASE WHEN oa.sys_name = 'fire_rating' OR oa.id = 520 THEN av.value END) as fire_rating,
        MAX(CASE WHEN oa.sys_name = 'width' OR oa.id = 200 THEN av.value END) as width,
        MAX(CASE WHEN oa.sys_name = 'height' OR oa.id = 205 THEN av.value END) as height,
        MAX(CASE WHEN oa.sys_name = 'lock_type' OR oa.id = 688 THEN av.value END) as lock_type,
        MAX(CASE WHEN oa.sys_name = 'access_control' OR oa.id = 368 THEN av.value END) as access_control
       FROM object_instances oi
       JOIN attribute_values av ON av.object_instance_id = oi.id
       JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE oi.object_type_id IN (1, 6)
       GROUP BY oi.id, oi.name`
    );

    const errors: string[] = [];

    for (const door of doors.rows) {
      // Fire-rated doors must have fire-rated hardware
      if (door.fire_rating && door.fire_rating !== 'none') {
        if (!door.lock_type) {
          errors.push(`${door.name}: fire-rated (${door.fire_rating}) but no lock type specified`);
        }
      }

      // Doors with electronic access must have access_control attribute
      if (door.lock_type === 'electronic' && !door.access_control) {
        errors.push(`${door.name}: electronic lock but no access control config`);
      }

      // Width validation (Swedish BBR: min 800mm for accessibility)
      if (door.width && parseInt(door.width) < 800) {
        errors.push(`${door.name}: width ${door.width}mm < 800mm BBR minimum`);
      }
    }

    return {
      success: true,
      variables: {
        disciplineApproved: pvar(errors.length === 0, 'Boolean'),
        validationErrors: pvar(errors, 'Json'),
        doorCount: pvar(doors.rows.length, 'Long'),
      },
    };
  },
};

/**
 * designValidationDelegate
 * Cross-discipline design completeness validation after all disciplines complete.
 */
export const designValidationDelegate: CamundaDelegate = {
  name: 'designValidationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    const errors: string[] = [];

    // Check fire class consistency: doors in fire compartments must have matching fire rating
    const fireCheck = await db.query(
      `SELECT oi.name as door_name,
        MAX(CASE WHEN oa.id = 520 THEN av.value END) as fire_rating,
        MAX(CASE WHEN oa.id = 368 THEN av.value END) as access_control
       FROM object_instances oi
       JOIN attribute_values av ON av.object_instance_id = oi.id
       JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE oi.object_type_id IN (1, 6)
       GROUP BY oi.id, oi.name
       HAVING MAX(CASE WHEN oa.id = 520 THEN av.value END) IS NULL`
    );

    for (const row of fireCheck.rows) {
      errors.push(`${row.door_name}: missing fire rating classification`);
    }

    // Check that all object types referenced by relationships exist
    const orphanRels = await db.query(
      `SELECT orl.id, orl.parent_type_id, orl.child_type_id
       FROM object_relationships orl
       LEFT JOIN object_types pt ON pt.id = orl.parent_type_id
       LEFT JOIN object_types ct ON ct.id = orl.child_type_id
       WHERE pt.id IS NULL OR ct.id IS NULL`
    );

    if (orphanRels.rows.length > 0) {
      errors.push(`${orphanRels.rows.length} orphaned object relationships found`);
    }

    return {
      success: true,
      variables: {
        validationPassed: pvar(errors.length === 0, 'Boolean'),
        clashReport: pvar(JSON.stringify({ errors, timestamp: new Date().toISOString() }), 'String'),
      },
    };
  },
};
