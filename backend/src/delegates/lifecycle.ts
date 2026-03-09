/**
 * Core Lifecycle Delegates
 *
 * P0 delegates for project initialization and phase transitions.
 * Referenced by: master-building-lifecycle.bpmn
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/** PLCS state mapping per lifecycle phase */
const PLCS_PHASE_MAP: Record<string, { plcsState: string; qualifier: string }> = {
  investigation: { plcsState: 'AS_REQUIRED', qualifier: 'TARGET' },
  pre_study:     { plcsState: 'AS_REQUIRED', qualifier: 'TARGET' },
  design:        { plcsState: 'AS_DESIGNED', qualifier: 'CALCULATED' },
  procurement:   { plcsState: 'AS_DESIGNED', qualifier: 'CALCULATED' },
  production:    { plcsState: 'AS_REALIZED', qualifier: 'MEASURED' },
  handover:      { plcsState: 'AS_IS', qualifier: 'MEASURED' },
  operations:    { plcsState: 'AS_IS', qualifier: 'MEASURED' },
  decommission:  { plcsState: 'AS_REMOVED', qualifier: 'MEASURED' },
};

/**
 * projectInitDelegate
 * Creates a new building project in OMS and initializes process variables.
 */
export const projectInitDelegate: CamundaDelegate = {
  name: 'projectInitDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, ownerGroupId } = execution.variables as {
      buildingId: number;
      ownerGroupId: number;
    };

    // Create building object instance if it doesn't exist
    const existing = await db.query(
      'SELECT id FROM object_instances WHERE id = $1',
      [buildingId]
    );

    let projectId: number;

    if (existing.rows.length === 0) {
      // Create new instance — object_type_id 1 = default building type
      const result = await db.query(
        `INSERT INTO object_instances (object_type_id, name, created_by)
         VALUES (1, $1, $2) RETURNING id`,
        [`Building ${buildingId}`, `system:${execution.processInstanceId}`]
      );
      projectId = result.rows[0].id;
    } else {
      projectId = existing.rows[0].id;
    }

    // Set initial lifecycle phase
    await db.query(
      `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
       SELECT $1, id, 'investigation', 'TARGET'
       FROM object_attributes WHERE sys_name = 'lifecycle_phase'
       ON CONFLICT (object_instance_id, object_attribute_id) DO UPDATE SET value = 'investigation', value_qualifier = 'TARGET'`,
      [projectId]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, $2, 'PROJECT_INIT', $3, NOW())`,
      [projectId, 'system', JSON.stringify({ processInstanceId: execution.processInstanceId, ownerGroupId })]
    );

    return {
      success: true,
      variables: {
        projectId: pvar(projectId, 'Long'),
        lifecyclePhase: pvar('investigation', 'String'),
      },
    };
  },
};

/**
 * lifecycleTransitionDelegate
 * Transitions the building to a new PLCS lifecycle phase.
 * Called 7 times in master process (one per phase gate).
 */
export const lifecycleTransitionDelegate: CamundaDelegate = {
  name: 'lifecycleTransitionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, targetPhase } = execution.variables as {
      buildingId: number;
      targetPhase: string;
    };

    const mapping = PLCS_PHASE_MAP[targetPhase];
    if (!mapping) {
      return { success: false, error: `Unknown phase: ${targetPhase}` };
    }

    // Get current phase for audit
    const current = await db.query(
      `SELECT av.value FROM attribute_values av
       JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE av.object_instance_id = $1 AND oa.sys_name = 'lifecycle_phase'`,
      [buildingId]
    );
    const oldPhase = current.rows[0]?.value || 'unknown';

    // Update lifecycle phase attribute
    await db.query(
      `UPDATE attribute_values av SET value = $1, value_qualifier = $2
       FROM object_attributes oa
       WHERE av.object_attribute_id = oa.id
         AND av.object_instance_id = $3
         AND oa.sys_name = 'lifecycle_phase'`,
      [targetPhase, mapping.qualifier, buildingId]
    );

    // Update building_portfolio if it exists
    await db.query(
      `UPDATE building_portfolio SET lifecycle_phase = $1, updated_at = NOW()
       WHERE building_instance_id = $2`,
      [targetPhase, buildingId]
    );

    // Record transition timestamp
    await db.query(
      `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
       SELECT $1, id, NOW()::text, $2
       FROM object_attributes WHERE sys_name = 'phase_transition_date'
       ON CONFLICT (object_instance_id, object_attribute_id) DO UPDATE SET value = NOW()::text, value_qualifier = $2`,
      [buildingId, mapping.qualifier]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, old_value, new_value, changed_at)
       VALUES ($1, 'system', 'LIFECYCLE_TRANSITION', $2, $3, NOW())`,
      [buildingId, oldPhase, targetPhase]
    );

    return {
      success: true,
      variables: {
        lifecyclePhase: pvar(targetPhase, 'String'),
        plcsState: pvar(mapping.plcsState, 'String'),
      },
    };
  },
};

/**
 * escalationDelegate
 * Sends escalation notification when a phase timer fires.
 */
export const escalationDelegate: CamundaDelegate = {
  name: 'escalationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, phaseName, escalationLevel } = execution.variables as {
      buildingId: number;
      phaseName: string;
      escalationLevel?: string;
    };

    const level = parseInt(escalationLevel || '1', 10);

    // Get notification targets: owners and project managers
    const groups = ['owners', 'project_managers'];
    if (level > 1) {
      groups.push('facility_managers');
    }

    // Query users in those groups (from permissions table)
    const targets = await db.query(
      `SELECT DISTINCT user_group FROM permissions WHERE user_group = ANY($1)`,
      [groups]
    );

    // In production: send email/in-app notification
    // For now: log the escalation
    console.log(`[ESCALATION] Building ${buildingId}, phase "${phaseName}", level ${level}, targets: ${targets.rows.map(r => r.user_group).join(', ')}`);

    // Audit log
    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'PHASE_ESCALATION', $2, NOW())`,
      [buildingId, JSON.stringify({ phaseName, level, groups })]
    );

    return {
      success: true,
      variables: {
        escalationSent: pvar(true, 'Boolean'),
        escalationTargets: pvar(groups, 'Json'),
      },
    };
  },
};
