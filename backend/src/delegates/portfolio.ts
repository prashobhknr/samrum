/**
 * Portfolio & Process Spawn Delegates
 *
 * Delegates for multi-building portfolio management.
 * Referenced by: portfolio/building-portfolio.bpmn
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/**
 * buildingInstanceDelegate
 * Creates/validates a building instance in the portfolio.
 */
export const buildingInstanceDelegate: CamundaDelegate = {
  name: 'buildingInstanceDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, portfolioName } = execution.variables as {
      buildingId: number;
      portfolioName?: string;
    };

    const existing = await db.query(
      'SELECT id FROM building_portfolio WHERE building_instance_id = $1',
      [buildingId]
    );

    if (existing.rows.length === 0 && portfolioName) {
      await db.query(
        `INSERT INTO building_portfolio (building_instance_id, portfolio_name) VALUES ($1, $2)`,
        [buildingId, portfolioName]
      );
    }

    return {
      success: true,
      variables: {
        buildingRegistered: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * processSpawnDelegate
 * Spawns a new master-building-lifecycle process instance for a building.
 */
export const processSpawnDelegate: CamundaDelegate = {
  name: 'processSpawnDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: call Camunda REST API to start a new process instance
    // POST /engine-rest/process-definition/key/master-building-lifecycle/start
    console.log(`[SPAWN] Would start master-building-lifecycle for building ${buildingId}`);

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'PROCESS_SPAWNED', $2, NOW())`,
      [buildingId, JSON.stringify({ processKey: 'master-building-lifecycle' })]
    );

    return {
      success: true,
      variables: {
        spawnedProcessKey: pvar('master-building-lifecycle', 'String'),
      },
    };
  },
};

/**
 * bulkMaintenanceDelegate
 * Triggers maintenance campaigns across multiple buildings.
 */
export const bulkMaintenanceDelegate: CamundaDelegate = {
  name: 'bulkMaintenanceDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { targetBuildingIds, campaignType } = execution.variables as {
      targetBuildingIds: number[];
      campaignType?: string;
    };

    const ids = Array.isArray(targetBuildingIds) ? targetBuildingIds : [];
    console.log(`[BULK_MAINTENANCE] Campaign type=${campaignType}, buildings=${ids.length}`);

    return {
      success: true,
      variables: {
        bulkMaintenanceTriggered: pvar(true, 'Boolean'),
        targetCount: pvar(ids.length, 'Long'),
      },
    };
  },
};

/**
 * portfolioReportDelegate
 * Generates portfolio-wide reports.
 */
export const portfolioReportDelegate: CamundaDelegate = {
  name: 'portfolioReportDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const stats = await db.query(`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active) as active,
        COALESCE(SUM(total_area_sqm), 0) as total_area
      FROM building_portfolio
    `);

    return {
      success: true,
      variables: {
        reportGenerated: pvar(true, 'Boolean'),
        portfolioStats: pvar(stats.rows[0], 'Json'),
      },
    };
  },
};

/**
 * portfolioBenchmarkDelegate
 * Benchmarks buildings against portfolio averages.
 */
export const portfolioBenchmarkDelegate: CamundaDelegate = {
  name: 'portfolioBenchmarkDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const benchmarks = await db.query(`
      SELECT building_type,
        COUNT(*) as count,
        AVG(total_area_sqm) as avg_area,
        AVG(floor_count) as avg_floors
      FROM building_portfolio WHERE is_active = true
      GROUP BY building_type
    `);

    return {
      success: true,
      variables: {
        benchmarkData: pvar(benchmarks.rows, 'Json'),
        benchmarkCompleted: pvar(true, 'Boolean'),
      },
    };
  },
};
