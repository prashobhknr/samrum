/**
 * Specialized Delegates
 *
 * Budget, insurance, renovation, CPM scheduling, POE, and document delegates.
 * Referenced by: budget-overrun, insurance-claim, renovation mini-project,
 *   contractor-scheduling, post-occupancy-evaluation, document-approval
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

// ─── Budget ──────────────────────────────────────────────────────────────────

export const costAnalysisDelegate: CamundaDelegate = {
  name: 'costAnalysisDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, currentCost, budgetedCost } = execution.variables as {
      buildingId: number;
      currentCost?: number;
      budgetedCost?: number;
    };

    const current = currentCost || 0;
    const budgeted = budgetedCost || 1;
    const overrunPct = ((current - budgeted) / budgeted) * 100;

    let severity: string;
    if (overrunPct < 5) severity = 'minor';
    else if (overrunPct < 15) severity = 'moderate';
    else severity = 'major';

    return {
      success: true,
      variables: {
        overrunPercentage: pvar(Math.round(overrunPct * 10) / 10, 'Double'),
        overrunSeverity: pvar(severity, 'String'),
      },
    };
  },
};

export const budgetUpdateDelegate: CamundaDelegate = {
  name: 'budgetUpdateDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, newBudget } = execution.variables as {
      buildingId: number;
      newBudget?: number;
    };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'BUDGET_UPDATED', $2, NOW())`,
      [buildingId, JSON.stringify({ newBudget })]
    );

    return {
      success: true,
      variables: { budgetUpdated: pvar(true, 'Boolean') },
    };
  },
};

// ─── Insurance ───────────────────────────────────────────────────────────────

export const insuranceSubmitDelegate: CamundaDelegate = {
  name: 'insuranceSubmitDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, claimDescription } = execution.variables as {
      buildingId: number;
      claimDescription?: string;
    };

    // In production: submit to insurance provider API
    const claimRef = `CLM-${Date.now().toString(36).toUpperCase()}`;
    console.log(`[INSURANCE] Submitted claim ${claimRef} for building ${buildingId}`);

    return {
      success: true,
      variables: {
        claimReference: pvar(claimRef, 'String'),
        claimSubmitted: pvar(true, 'Boolean'),
      },
    };
  },
};

// ─── Renovation ──────────────────────────────────────────────────────────────

export const projectInitiationDelegate: CamundaDelegate = {
  name: 'projectInitiationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, changeType } = execution.variables as {
      buildingId: number;
      changeType?: string;
    };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'CHANGE_INITIATED', $2, NOW())`,
      [buildingId, JSON.stringify({ changeType })]
    );

    return {
      success: true,
      variables: { changeInitiated: pvar(true, 'Boolean') },
    };
  },
};

export const doormanAttributeUpdateDelegate: CamundaDelegate = {
  name: 'doormanAttributeUpdateDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { objectInstanceId, attributeUpdates } = execution.variables as {
      objectInstanceId: number;
      attributeUpdates?: Record<string, string>;
    };

    let updated = 0;
    if (attributeUpdates && objectInstanceId) {
      for (const [attrId, value] of Object.entries(attributeUpdates)) {
        await db.query(
          `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value, value_qualifier)
           VALUES ($1, $2, $3, 'MEASURED')
           ON CONFLICT (object_instance_id, object_attribute_id)
           DO UPDATE SET value = $3, value_qualifier = 'MEASURED'`,
          [objectInstanceId, parseInt(attrId), value]
        );
        updated++;
      }
    }

    return {
      success: true,
      variables: {
        attributesUpdated: pvar(updated, 'Long'),
      },
    };
  },
};

export const renovationAuditDelegate: CamundaDelegate = {
  name: 'renovationAuditDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'RENOVATION_COMPLETE', $2, NOW())`,
      [buildingId, JSON.stringify({ processInstanceId: execution.processInstanceId })]
    );

    return {
      success: true,
      variables: { auditRecorded: pvar(true, 'Boolean') },
    };
  },
};

export const renovationScopeValidatorDelegate: CamundaDelegate = {
  name: 'renovationScopeValidatorDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { renovationScope } = execution.variables as { renovationScope?: string[] };

    const validScopes = ['architecture', 'structural', 'fire', 'doors', 'hvac', 'electrical', 'plumbing', 'access'];
    const scope = renovationScope || [];
    const invalid = scope.filter(s => !validScopes.includes(s));

    return {
      success: true,
      variables: {
        scopeValid: pvar(invalid.length === 0, 'Boolean'),
        invalidScopes: pvar(invalid, 'Json'),
      },
    };
  },
};

// ─── Contractor Scheduling (CPM) ────────────────────────────────────────────

export const cpmScheduleDelegate: CamundaDelegate = {
  name: 'cpmScheduleDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: integrate with scheduling tool (MS Project, Primavera)
    // Stub: create a basic schedule reference
    const scheduleRef = `CPM-${buildingId}-${Date.now().toString(36)}`;

    return {
      success: true,
      variables: {
        cpmScheduleId: pvar(scheduleRef, 'String'),
        scheduleGenerated: pvar(true, 'Boolean'),
      },
    };
  },
};

export const resourceMonitorDelegate: CamundaDelegate = {
  name: 'resourceMonitorDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    // Stub: report resource utilization
    return {
      success: true,
      variables: {
        resourceUtilization: pvar(0.75, 'Double'),
        resourceAlerts: pvar([], 'Json'),
      },
    };
  },
};

export const delayDetectionDelegate: CamundaDelegate = {
  name: 'delayDetectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    // Stub: detect schedule delays
    return {
      success: true,
      variables: {
        delaysDetected: pvar(false, 'Boolean'),
        delayDays: pvar(0, 'Long'),
        criticalPathImpacted: pvar(false, 'Boolean'),
      },
    };
  },
};

// ─── Post-Occupancy Evaluation ───────────────────────────────────────────────

export const surveyCollectionDelegate: CamundaDelegate = {
  name: 'surveyCollectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: send survey links, collect responses
    return {
      success: true,
      variables: {
        surveyDistributed: pvar(true, 'Boolean'),
        surveyResponseCount: pvar(0, 'Long'),
      },
    };
  },
};

export const performanceDataDelegate: CamundaDelegate = {
  name: 'performanceDataDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: collect technical performance metrics
    return {
      success: true,
      variables: {
        performanceData: pvar({
          energyEfficiency: null,
          hvacPerformance: null,
          lightingQuality: null,
        }, 'Json'),
        dataCollected: pvar(true, 'Boolean'),
      },
    };
  },
};

// ─── Document Management ─────────────────────────────────────────────────────

export const documentRegistrationDelegate: CamundaDelegate = {
  name: 'documentRegistrationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, documentTitle, documentType } = execution.variables as {
      buildingId: number;
      documentTitle?: string;
      documentType?: string;
    };

    const docRef = `DOC-${Date.now().toString(36).toUpperCase()}`;

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'DOCUMENT_REGISTERED', $2, NOW())`,
      [buildingId, JSON.stringify({ docRef, title: documentTitle, type: documentType })]
    );

    return {
      success: true,
      variables: {
        documentReference: pvar(docRef, 'String'),
        documentRegistered: pvar(true, 'Boolean'),
      },
    };
  },
};

// ─── Audit Log (alternate name used in some BPMNs) ──────────────────────────

export const auditLogDelegate: CamundaDelegate = {
  name: 'auditLogDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, projectId } = execution.variables as {
      buildingId?: number;
      projectId?: number;
    };

    const objectInstanceId = buildingId || projectId || 0;

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', $2, $3, NOW())`,
      [
        objectInstanceId,
        `PROCESS_STEP:${execution.activityId}`,
        JSON.stringify({ processInstanceId: execution.processInstanceId }),
      ]
    );

    return {
      success: true,
      variables: { auditLogged: pvar(true, 'Boolean') },
    };
  },
};
