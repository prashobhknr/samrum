/**
 * Notification & Report Delegates
 *
 * Cross-cutting delegates for notifications, reports, and procurement.
 * Referenced by: multiple processes
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/**
 * notificationDelegate
 * Sends notifications to user groups (email/in-app).
 * Used in procurement, emergency, change management, etc.
 */
export const notificationDelegate: CamundaDelegate = {
  name: 'notificationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, targetGroups, notificationType, message } = execution.variables as {
      buildingId: number;
      targetGroups: string[];
      notificationType: string;
      message?: string;
    };

    // In production: integrate with email/push service
    // Stub: log notification and write audit entry
    const groups = Array.isArray(targetGroups) ? targetGroups : [targetGroups];

    console.log(`[NOTIFICATION] type=${notificationType}, building=${buildingId}, groups=${groups.join(',')}, msg=${message || '(auto)'}`);

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'NOTIFICATION_SENT', $2, NOW())`,
      [buildingId, JSON.stringify({ type: notificationType, groups, message })]
    );

    return {
      success: true,
      variables: {
        notificationSent: pvar(true, 'Boolean'),
        notificationTimestamp: pvar(new Date().toISOString(), 'String'),
      },
    };
  },
};

/**
 * reportCompileDelegate
 * Compiles phase reports (investigation, pre-study).
 */
export const reportCompileDelegate: CamundaDelegate = {
  name: 'reportCompileDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, reportType } = execution.variables as {
      buildingId: number;
      reportType?: string;
    };

    // Gather all attribute values for the building
    const data = await db.query(
      `SELECT oa.attribute_name, oa.sys_name, av.value, av.value_qualifier
       FROM attribute_values av
       JOIN object_attributes oa ON av.object_attribute_id = oa.id
       WHERE av.object_instance_id = $1
       ORDER BY oa.attribute_name`,
      [buildingId]
    );

    const report = {
      buildingId,
      reportType: reportType || execution.processDefinitionKey,
      generatedAt: new Date().toISOString(),
      attributeCount: data.rows.length,
      attributes: data.rows,
    };

    return {
      success: true,
      variables: {
        reportGenerated: pvar(true, 'Boolean'),
        reportData: pvar(JSON.stringify(report), 'String'),
      },
    };
  },
};

/**
 * tenderPublishDelegate
 * Publishes tender documents to procurement platform.
 */
export const tenderPublishDelegate: CamundaDelegate = {
  name: 'tenderPublishDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, tenderDocumentIds } = execution.variables as {
      buildingId: number;
      tenderDocumentIds?: number[];
    };

    // In production: publish to e-tendering platform (e.g., Mercell, TendSign)
    console.log(`[TENDER] Publishing tender for building ${buildingId}`);

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'TENDER_PUBLISHED', $2, NOW())`,
      [buildingId, JSON.stringify({ documentIds: tenderDocumentIds, publishedAt: new Date().toISOString() })]
    );

    return {
      success: true,
      variables: {
        tenderPublished: pvar(true, 'Boolean'),
        tenderPublishDate: pvar(new Date().toISOString(), 'String'),
      },
    };
  },
};

/**
 * bidRegistrationDelegate
 * Registers received bids in the procurement phase.
 */
export const bidRegistrationDelegate: CamundaDelegate = {
  name: 'bidRegistrationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    // Stub: bids are registered via user tasks in procurement-phase
    return {
      success: true,
      variables: {
        bidsRegistered: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * contractorOnboardDelegate
 * Creates contractor user groups after contract award.
 */
export const contractorOnboardDelegate: CamundaDelegate = {
  name: 'contractorOnboardDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, contractorName, contractorType } = execution.variables as {
      buildingId: number;
      contractorName?: string;
      contractorType?: string;
    };

    // In production: create user group, assign permissions
    const groupName = `contractor_${contractorType || 'general'}_${buildingId}`;

    console.log(`[ONBOARD] Creating contractor group: ${groupName} for ${contractorName || 'unknown'}`);

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'CONTRACTOR_ONBOARDED', $2, NOW())`,
      [buildingId, JSON.stringify({ groupName, contractorName, contractorType })]
    );

    return {
      success: true,
      variables: {
        contractorGroupName: pvar(groupName, 'String'),
        contractorOnboarded: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * warrantyActivationDelegate
 * Activates warranty period after handover.
 */
export const warrantyActivationDelegate: CamundaDelegate = {
  name: 'warrantyActivationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, warrantyStartDate } = execution.variables as {
      buildingId: number;
      warrantyStartDate?: string;
    };

    const startDate = warrantyStartDate || new Date().toISOString().split('T')[0];

    // Set warranty attributes on building
    await db.query(
      `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
       SELECT $1, id, $2, 'MEASURED'
       FROM object_attributes WHERE sys_name = 'warranty_start_date'
       ON CONFLICT (object_instance_id, object_attribute_id)
       DO UPDATE SET value = $2, value_qualifier = 'MEASURED'`,
      [buildingId, startDate]
    );

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'WARRANTY_ACTIVATED', $2, NOW())`,
      [buildingId, JSON.stringify({ startDate })]
    );

    return {
      success: true,
      variables: {
        warrantyStartDate: pvar(startDate, 'String'),
        warrantyActivated: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * aimPopulationDelegate
 * Transfers PIM to AIM per ISO 19650 during handover.
 */
export const aimPopulationDelegate: CamundaDelegate = {
  name: 'aimPopulationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // Update all attribute qualifiers from design (CALCULATED/TARGET) to operational (MEASURED)
    const updated = await db.query(
      `UPDATE attribute_values SET value_qualifier = 'MEASURED'
       WHERE object_instance_id IN (
         SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1
         UNION SELECT $1
       ) AND value_qualifier IN ('CALCULATED', 'TARGET')
       RETURNING id`,
      [buildingId]
    );

    // Check completeness
    const total = await db.query(
      `SELECT COUNT(*) as total FROM attribute_values
       WHERE object_instance_id IN (
         SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1
         UNION SELECT $1
       )`,
      [buildingId]
    );

    const nonNull = await db.query(
      `SELECT COUNT(*) as filled FROM attribute_values
       WHERE object_instance_id IN (
         SELECT child_instance_id FROM object_instance_relationships WHERE parent_instance_id = $1
         UNION SELECT $1
       ) AND value IS NOT NULL AND value != ''`,
      [buildingId]
    );

    const completeness = parseInt(total.rows[0].total) > 0
      ? parseInt(nonNull.rows[0].filled) / parseInt(total.rows[0].total)
      : 0;

    return {
      success: true,
      variables: {
        aimValidated: pvar(completeness >= 0.9, 'Boolean'),
        aimCompletenessScore: pvar(Math.round(completeness * 100) / 100, 'Double'),
        aimTransferredAttributes: pvar(updated.rows.length, 'Long'),
      },
    };
  },
};
