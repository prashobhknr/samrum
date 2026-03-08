/**
 * Camunda 7 Delegate Registry
 *
 * Central registry of all 50 delegate implementations referenced by BPMN service tasks.
 * Maps delegate expression names (e.g., "${lifecycleTransitionDelegate}") to implementations.
 *
 * Usage:
 *   import { getDelegateRegistry, executeDelegate } from './delegates';
 *   const result = await executeDelegate('lifecycleTransitionDelegate', execution, db);
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult } from './types';

// Core lifecycle (P0)
import { projectInitDelegate, lifecycleTransitionDelegate, escalationDelegate } from './lifecycle';

// Audit (P0)
import { auditWriteDelegate } from './audit';

// Validation (P1)
import { validationDelegate, doorValidationDelegate, designValidationDelegate } from './validation';

// Operations (P1-P2)
import {
  maintenanceQueryDelegate, maintenanceDateDelegate,
  inspectionQueryDelegate, energyDataCollectionDelegate,
  accessProvisionDelegate, archiveDelegate,
} from './operations';

// BIM/IFC (P1-P2)
import {
  ifcImportDelegate, ifcParseDelegate, bimValidationDelegate,
  clashDetectionDelegate, bimSyncDelegate,
} from './bim';

// Notifications & reports (P1-P2)
import {
  notificationDelegate, reportCompileDelegate,
  tenderPublishDelegate, bidRegistrationDelegate,
  contractorOnboardDelegate, warrantyActivationDelegate,
  aimPopulationDelegate,
} from './notification';

// Portfolio (P1-P2)
import {
  buildingInstanceDelegate, processSpawnDelegate,
  bulkMaintenanceDelegate, portfolioReportDelegate,
  portfolioBenchmarkDelegate,
} from './portfolio';

// Climate & sustainability (P2)
import {
  climateDataCollectionDelegate, climateAnalysisDelegate,
  climateReportDelegate, ghgCalculationDelegate,
  waterDataCollectionDelegate, esgReportDelegate,
} from './climate';

// Specialized: budget, insurance, renovation, CPM, POE, document (P2-P3)
import {
  costAnalysisDelegate, budgetUpdateDelegate,
  insuranceSubmitDelegate,
  projectInitiationDelegate, doormanAttributeUpdateDelegate,
  renovationAuditDelegate, renovationScopeValidatorDelegate,
  cpmScheduleDelegate, resourceMonitorDelegate, delayDetectionDelegate,
  surveyCollectionDelegate, performanceDataDelegate,
  documentRegistrationDelegate, auditLogDelegate,
} from './specialized';

/** All registered delegates */
const DELEGATE_REGISTRY: Record<string, CamundaDelegate> = {};

function register(delegate: CamundaDelegate) {
  DELEGATE_REGISTRY[delegate.name] = delegate;
}

// ─── P0 — Core ──────────────────────────────────────────────────────────────
register(projectInitDelegate);
register(lifecycleTransitionDelegate);
register(auditWriteDelegate);

// ─── P1 — Validation & key operations ───────────────────────────────────────
register(validationDelegate);
register(doorValidationDelegate);
register(designValidationDelegate);
register(notificationDelegate);
register(accessProvisionDelegate);
register(aimPopulationDelegate);
register(maintenanceQueryDelegate);
register(bimSyncDelegate);

// ─── P1 — Portfolio ─────────────────────────────────────────────────────────
register(buildingInstanceDelegate);
register(processSpawnDelegate);

// ─── P2 — Phase-specific ────────────────────────────────────────────────────
register(escalationDelegate);
register(reportCompileDelegate);
register(tenderPublishDelegate);
register(bidRegistrationDelegate);
register(contractorOnboardDelegate);
register(warrantyActivationDelegate);
register(maintenanceDateDelegate);
register(inspectionQueryDelegate);
register(energyDataCollectionDelegate);

// ─── P2 — BIM pipeline ─────────────────────────────────────────────────────
register(ifcImportDelegate);
register(ifcParseDelegate);
register(bimValidationDelegate);
register(clashDetectionDelegate);

// ─── P2 — Portfolio ─────────────────────────────────────────────────────────
register(bulkMaintenanceDelegate);
register(portfolioReportDelegate);
register(portfolioBenchmarkDelegate);

// ─── P2 — Climate & sustainability ──────────────────────────────────────────
register(climateDataCollectionDelegate);
register(climateAnalysisDelegate);
register(climateReportDelegate);
register(ghgCalculationDelegate);
register(waterDataCollectionDelegate);
register(esgReportDelegate);

// ─── P2 — Budget, insurance, renovation ─────────────────────────────────────
register(costAnalysisDelegate);
register(budgetUpdateDelegate);
register(insuranceSubmitDelegate);
register(projectInitiationDelegate);
register(doormanAttributeUpdateDelegate);
register(renovationAuditDelegate);
register(renovationScopeValidatorDelegate);

// ─── P2 — CPM scheduling ───────────────────────────────────────────────────
register(cpmScheduleDelegate);
register(resourceMonitorDelegate);
register(delayDetectionDelegate);

// ─── P2 — POE ───────────────────────────────────────────────────────────────
register(surveyCollectionDelegate);
register(performanceDataDelegate);

// ─── P2 — Document ──────────────────────────────────────────────────────────
register(documentRegistrationDelegate);

// ─── P3 — Archive & alternate audit ─────────────────────────────────────────
register(archiveDelegate);
register(auditLogDelegate);

/** Get the full delegate registry */
export function getDelegateRegistry(): Record<string, CamundaDelegate> {
  return { ...DELEGATE_REGISTRY };
}

/** Get a single delegate by name */
export function getDelegate(name: string): CamundaDelegate | undefined {
  return DELEGATE_REGISTRY[name];
}

/** Execute a delegate by name */
export async function executeDelegate(
  name: string,
  execution: DelegateExecution,
  db: Client
): Promise<DelegateResult> {
  const delegate = DELEGATE_REGISTRY[name];
  if (!delegate) {
    return { success: false, error: `Unknown delegate: ${name}` };
  }

  try {
    return await delegate.execute(execution, db);
  } catch (error) {
    return {
      success: false,
      error: `Delegate ${name} failed: ${(error as Error).message}`,
    };
  }
}

/** List all registered delegate names */
export function listDelegates(): { name: string; registered: boolean }[] {
  return Object.keys(DELEGATE_REGISTRY).map(name => ({ name, registered: true }));
}

// Re-export types
export type { CamundaDelegate, DelegateExecution, DelegateResult, ProcessVariable } from './types';
