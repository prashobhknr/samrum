/**
 * Camunda 7 Delegate Types for Doorman
 *
 * These types model the Camunda external task worker / JavaDelegate pattern
 * adapted for the Node.js Doorman backend.
 */

import { Client } from 'pg';

/** Process variable value with type info */
export interface ProcessVariable {
  value: unknown;
  type: string; // 'String' | 'Long' | 'Boolean' | 'Double' | 'Json'
}

/** Execution context passed to each delegate */
export interface DelegateExecution {
  processInstanceId: string;
  processDefinitionKey: string;
  activityId: string;
  taskId?: string;
  variables: Record<string, unknown>;
  tenantId?: string;
}

/** Result returned by a delegate */
export interface DelegateResult {
  variables?: Record<string, ProcessVariable>;
  success: boolean;
  error?: string;
}

/** Base delegate interface */
export interface CamundaDelegate {
  name: string;
  execute(execution: DelegateExecution, db: Client): Promise<DelegateResult>;
}

/** Helper to create a typed process variable */
export function pvar(value: unknown, type: string): ProcessVariable {
  return { value, type };
}
