/**
 * Audit Write Delegate
 *
 * P0 delegate — used by 20+ service tasks across all processes.
 * Writes immutable audit log entries for process step tracking.
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

export const auditWriteDelegate: CamundaDelegate = {
  name: 'auditWriteDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, projectId } = execution.variables as {
      buildingId?: number;
      projectId?: number;
    };

    const objectInstanceId = buildingId || projectId;
    if (!objectInstanceId) {
      return { success: false, error: 'No buildingId or projectId in process variables' };
    }

    // Capture process context
    const auditEntry = {
      processInstanceId: execution.processInstanceId,
      processDefinitionKey: execution.processDefinitionKey,
      activityId: execution.activityId,
      taskId: execution.taskId || null,
      timestamp: new Date().toISOString(),
    };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        objectInstanceId,
        'system',
        `PROCESS_STEP:${execution.activityId}`,
        JSON.stringify(auditEntry),
      ]
    );

    return {
      success: true,
      variables: {
        lastAuditTimestamp: pvar(auditEntry.timestamp, 'String'),
      },
    };
  },
};
