/**
 * Register all 50 delegate handlers for the external task worker.
 * 
 * These are lightweight handlers that execute against the database.
 * Each handler follows the DelegateExecution → DelegateResult pattern.
 * 
 * For now, handlers log execution and return success with typed variables
 * that satisfy BPMN gateway conditions. As TypeScript delegates get compiled,
 * these will be replaced with the full implementations.
 */

import { registerDelegate, getDelegateCount } from './externalTaskWorker.mjs';

/** Helper to create a typed process variable */
function pvar(value, type) {
  return { value, type };
}

/**
 * Register a simple delegate that logs and returns standard variables.
 * @param {string} name - Topic name matching BPMN camunda:topic
 * @param {Record<string, {value: any, type: string}>} [extraVars] - Additional variables to set
 */
function registerSimple(name, extraVars = {}) {
  registerDelegate(name, async (execution, db) => {
    console.log(`  [${name}] processInstance=${execution.processInstanceId}, activity=${execution.activityId}`);

    // Write audit log if we have a db connection and a buildingId/projectId
    if (db) {
      const objectId = execution.variables?.buildingId || execution.variables?.projectId || 0;
      try {
        await db.query(
          `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, timestamp)
           VALUES ($1, 'system', $2, $3, NOW())`,
          [objectId, `DELEGATE:${name}`, JSON.stringify({
            processInstanceId: execution.processInstanceId,
            activityId: execution.activityId,
          })]
        );
      } catch {
        // Non-fatal: audit logging failure shouldn't block delegate execution
      }
    }

    return {
      success: true,
      variables: {
        lastDelegateExecuted: pvar(name, 'String'),
        delegateTimestamp: pvar(new Date().toISOString(), 'String'),
        ...extraVars,
      },
    };
  });
}

// ─── P0 — Core lifecycle ────────────────────────────────────────────────────
registerSimple('projectInitDelegate', {
  lifecyclePhase: pvar('investigation', 'String'),
  projectInitialized: pvar(true, 'Boolean'),
});

registerSimple('lifecycleTransitionDelegate', {
  phaseTransitionComplete: pvar(true, 'Boolean'),
});

registerSimple('escalationDelegate', {
  escalationSent: pvar(true, 'Boolean'),
});

// ─── P0 — Audit ─────────────────────────────────────────────────────────────
registerSimple('auditWriteDelegate', {
  auditWritten: pvar(true, 'Boolean'),
});

registerSimple('auditLogDelegate', {
  auditWritten: pvar(true, 'Boolean'),
});

// ─── P1 — Validation ────────────────────────────────────────────────────────
registerSimple('validationDelegate', {
  disciplineApproved: pvar(true, 'Boolean'),
  validationErrorCount: pvar(0, 'Long'),
});

registerSimple('doorValidationDelegate', {
  disciplineApproved: pvar(true, 'Boolean'),
  validationErrorCount: pvar(0, 'Long'),
});

registerSimple('designValidationDelegate', {
  disciplineApproved: pvar(true, 'Boolean'),
  validationPassed: pvar(true, 'Boolean'),
  validationErrorCount: pvar(0, 'Long'),
});

// ─── P1 — Operations ────────────────────────────────────────────────────────
registerSimple('maintenanceQueryDelegate', {
  dueMaintenanceCount: pvar(0, 'Long'),
});

registerSimple('maintenanceDateDelegate');

registerSimple('inspectionQueryDelegate', {
  inspectionCount: pvar(0, 'Long'),
});

registerSimple('energyDataCollectionDelegate', {
  energyDataCollected: pvar(true, 'Boolean'),
});

registerSimple('accessProvisionDelegate', {
  accessProvisioned: pvar(true, 'Boolean'),
});

registerSimple('archiveDelegate', {
  archived: pvar(true, 'Boolean'),
});

// ─── P1 — Notifications & reports ───────────────────────────────────────────
registerSimple('notificationDelegate', {
  notificationSent: pvar(true, 'Boolean'),
});

registerSimple('reportCompileDelegate', {
  reportGenerated: pvar(true, 'Boolean'),
});

registerSimple('tenderPublishDelegate', {
  tenderPublished: pvar(true, 'Boolean'),
});

registerSimple('bidRegistrationDelegate', {
  bidRegistered: pvar(true, 'Boolean'),
});

registerSimple('contractorOnboardDelegate', {
  contractorOnboarded: pvar(true, 'Boolean'),
});

registerSimple('warrantyActivationDelegate', {
  warrantyActivated: pvar(true, 'Boolean'),
});

registerSimple('aimPopulationDelegate', {
  aimPopulated: pvar(true, 'Boolean'),
});

// ─── P1 — Portfolio ─────────────────────────────────────────────────────────
registerSimple('buildingInstanceDelegate', {
  buildingInstanceCreated: pvar(true, 'Boolean'),
});

registerSimple('processSpawnDelegate', {
  processSpawned: pvar(true, 'Boolean'),
});

registerSimple('bulkMaintenanceDelegate', {
  bulkMaintenanceComplete: pvar(true, 'Boolean'),
});

registerSimple('portfolioReportDelegate', {
  reportGenerated: pvar(true, 'Boolean'),
});

registerSimple('portfolioBenchmarkDelegate', {
  benchmarkComplete: pvar(true, 'Boolean'),
});

// ─── P2 — BIM pipeline ──────────────────────────────────────────────────────
registerSimple('ifcImportDelegate', {
  ifcImported: pvar(true, 'Boolean'),
});

registerSimple('ifcParseDelegate', {
  ifcParsed: pvar(true, 'Boolean'),
});

registerSimple('bimValidationDelegate', {
  modelValid: pvar(true, 'Boolean'),
  validationErrorCount: pvar(0, 'Long'),
});

registerSimple('clashDetectionDelegate', {
  clashCount: pvar(0, 'Long'),
  clashesDetected: pvar(false, 'Boolean'),
});

registerSimple('bimSyncDelegate', {
  bimSynced: pvar(true, 'Boolean'),
});

// ─── P2 — Climate & sustainability ──────────────────────────────────────────
registerSimple('climateDataCollectionDelegate', {
  climateDataCollected: pvar(true, 'Boolean'),
});

registerSimple('climateAnalysisDelegate', {
  climateAnalysisComplete: pvar(true, 'Boolean'),
});

registerSimple('climateReportDelegate', {
  climateReportGenerated: pvar(true, 'Boolean'),
});

registerSimple('ghgCalculationDelegate', {
  ghgCalculated: pvar(true, 'Boolean'),
});

registerSimple('waterDataCollectionDelegate', {
  waterDataCollected: pvar(true, 'Boolean'),
});

registerSimple('esgReportDelegate', {
  esgReportGenerated: pvar(true, 'Boolean'),
});

// ─── P2 — Budget, insurance, renovation ─────────────────────────────────────
registerSimple('costAnalysisDelegate', {
  costAnalysisComplete: pvar(true, 'Boolean'),
  deviationLevel: pvar('minor', 'String'),
});

registerSimple('budgetUpdateDelegate', {
  budgetUpdated: pvar(true, 'Boolean'),
});

registerSimple('insuranceSubmitDelegate', {
  insuranceSubmitted: pvar(true, 'Boolean'),
});

registerSimple('projectInitiationDelegate', {
  projectInitiated: pvar(true, 'Boolean'),
});

registerSimple('doormanAttributeUpdateDelegate', {
  attributesUpdated: pvar(true, 'Boolean'),
});

registerSimple('renovationAuditDelegate', {
  renovationAudited: pvar(true, 'Boolean'),
});

registerSimple('renovationScopeValidatorDelegate', {
  scopeValid: pvar(true, 'Boolean'),
  validationErrorCount: pvar(0, 'Long'),
});

// ─── P2 — CPM scheduling ───────────────────────────────────────────────────
registerSimple('cpmScheduleDelegate', {
  scheduleCalculated: pvar(true, 'Boolean'),
});

registerSimple('resourceMonitorDelegate', {
  resourcesOk: pvar(true, 'Boolean'),
});

registerSimple('delayDetectionDelegate', {
  delaysDetected: pvar(false, 'Boolean'),
});

// ─── P2 — POE ───────────────────────────────────────────────────────────────
registerSimple('surveyCollectionDelegate', {
  surveyCollected: pvar(true, 'Boolean'),
});

registerSimple('performanceDataDelegate', {
  performanceDataCollected: pvar(true, 'Boolean'),
});

// ─── P2 — Document ──────────────────────────────────────────────────────────
registerSimple('documentRegistrationDelegate', {
  documentRegistered: pvar(true, 'Boolean'),
});

console.log(`[Worker] Registered ${getDelegateCount()} delegate handlers`);
