/**
 * Indoor Climate & Sustainability Delegates
 *
 * Referenced by: operations/indoor-climate.bpmn, operations/sustainability-reporting.bpmn
 */

import { Client } from 'pg';
import { CamundaDelegate, DelegateExecution, DelegateResult, pvar } from './types';

/**
 * climateDataCollectionDelegate
 * Collects indoor climate sensor data (temperature, humidity, CO2, radon).
 */
export const climateDataCollectionDelegate: CamundaDelegate = {
  name: 'climateDataCollectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: query IoT sensor API (e.g., Airthings, Sensibo)
    // Stub: return placeholder data
    const sensorData = {
      temperature_c: 21.5,
      humidity_pct: 45,
      co2_ppm: 650,
      radon_bq: 80,
      collectedAt: new Date().toISOString(),
    };

    return {
      success: true,
      variables: {
        climateData: pvar(sensorData, 'Json'),
        dataCollected: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * climateAnalysisDelegate
 * Analyzes climate data against thresholds (AFS 2020:1, BBR).
 */
export const climateAnalysisDelegate: CamundaDelegate = {
  name: 'climateAnalysisDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { climateData } = execution.variables as { climateData: Record<string, number> };

    const data = typeof climateData === 'string' ? JSON.parse(climateData) : climateData || {};
    const alerts: string[] = [];
    let severity = 'normal';

    // Swedish thresholds
    if (data.radon_bq > 200) { alerts.push(`Radon ${data.radon_bq} Bq/m³ exceeds 200 limit`); severity = 'critical'; }
    else if (data.radon_bq > 100) { alerts.push(`Radon ${data.radon_bq} Bq/m³ approaching limit`); severity = 'warning'; }

    if (data.co2_ppm > 1500) { alerts.push(`CO2 ${data.co2_ppm} ppm exceeds 1500 limit`); severity = 'critical'; }
    else if (data.co2_ppm > 1000) { alerts.push(`CO2 ${data.co2_ppm} ppm elevated`); if (severity === 'normal') severity = 'warning'; }

    if (data.temperature_c > 26) { alerts.push(`Temperature ${data.temperature_c}°C exceeds comfort range`); if (severity === 'normal') severity = 'warning'; }
    if (data.temperature_c < 18) { alerts.push(`Temperature ${data.temperature_c}°C below comfort range`); if (severity === 'normal') severity = 'warning'; }

    return {
      success: true,
      variables: {
        climateSeverity: pvar(severity, 'String'),
        climateAlerts: pvar(alerts, 'Json'),
        thresholdExceeded: pvar(severity !== 'normal', 'Boolean'),
      },
    };
  },
};

/**
 * climateReportDelegate
 * Generates indoor climate compliance report.
 */
export const climateReportDelegate: CamundaDelegate = {
  name: 'climateReportDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, climateData, climateAlerts } = execution.variables as {
      buildingId: number;
      climateData?: unknown;
      climateAlerts?: string[];
    };

    const report = {
      buildingId,
      period: new Date().toISOString().substring(0, 7), // YYYY-MM
      data: climateData,
      alerts: climateAlerts || [],
      compliance: !(climateAlerts && climateAlerts.length > 0),
      standard: 'AFS 2020:1 + BBR',
    };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'CLIMATE_REPORT', $2, NOW())`,
      [buildingId, JSON.stringify(report)]
    );

    return {
      success: true,
      variables: {
        climateReportGenerated: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * ghgCalculationDelegate
 * Calculates greenhouse gas emissions per GHG Protocol.
 */
export const ghgCalculationDelegate: CamundaDelegate = {
  name: 'ghgCalculationDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // In production: pull energy data and apply emission factors
    // Stub: placeholder calculation
    const emissions = {
      scope1_tco2e: 0, // direct (on-site combustion)
      scope2_tco2e: 12.5, // indirect (purchased electricity/heat)
      scope3_tco2e: 3.2, // other indirect
      total_tco2e: 15.7,
      year: new Date().getFullYear(),
    };

    return {
      success: true,
      variables: {
        ghgEmissions: pvar(emissions, 'Json'),
        ghgCalculated: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * waterDataCollectionDelegate
 * Collects water consumption data.
 */
export const waterDataCollectionDelegate: CamundaDelegate = {
  name: 'waterDataCollectionDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId } = execution.variables as { buildingId: number };

    // Stub: placeholder data
    return {
      success: true,
      variables: {
        waterData: pvar({ total_m3: 0, hot_m3: 0, cold_m3: 0 }, 'Json'),
        waterDataCollected: pvar(true, 'Boolean'),
      },
    };
  },
};

/**
 * esgReportDelegate
 * Compiles ESG sustainability report (EU Taxonomy, Miljöbyggnad).
 */
export const esgReportDelegate: CamundaDelegate = {
  name: 'esgReportDelegate',

  async execute(execution: DelegateExecution, db: Client): Promise<DelegateResult> {
    const { buildingId, ghgEmissions, waterData } = execution.variables as {
      buildingId: number;
      ghgEmissions?: unknown;
      waterData?: unknown;
    };

    const report = {
      buildingId,
      year: new Date().getFullYear(),
      ghg: ghgEmissions,
      water: waterData,
      frameworks: ['EU Taxonomy', 'GHG Protocol', 'Miljöbyggnad', 'BREEAM-SE'],
      generatedAt: new Date().toISOString(),
    };

    await db.query(
      `INSERT INTO audit_log (object_instance_id, user_id, action, new_value, changed_at)
       VALUES ($1, 'system', 'ESG_REPORT', $2, NOW())`,
      [buildingId, JSON.stringify(report)]
    );

    return {
      success: true,
      variables: {
        esgReportGenerated: pvar(true, 'Boolean'),
      },
    };
  },
};
