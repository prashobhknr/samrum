/**
 * Portfolio Management API Routes
 *
 * Endpoints for multi-building portfolio management
 * - GET  /api/portfolio/buildings       - List all buildings in portfolio
 * - GET  /api/portfolio/buildings/:id   - Get single building details
 * - POST /api/portfolio/buildings       - Register a new building
 * - PUT  /api/portfolio/buildings/:id   - Update building info
 * - GET  /api/portfolio/campaigns       - List maintenance campaigns
 * - POST /api/portfolio/campaigns       - Create a new campaign
 * - GET  /api/portfolio/dashboard       - Portfolio KPI dashboard data
 */

import { Router, Request, Response } from 'express';
import { Client } from 'pg';

export function createPortfolioRouter(db: Client): Router {
  const router = Router();

  /**
   * GET /api/portfolio/buildings
   * List all buildings in the portfolio with lifecycle status
   */
  router.get('/buildings', async (req: Request, res: Response) => {
    try {
      const { lifecycle_phase, geographic_zone, is_active } = req.query;

      let query = `
        SELECT
          bp.id,
          bp.portfolio_name,
          bp.building_address,
          bp.building_type,
          bp.lifecycle_phase,
          bp.master_process_instance_id,
          bp.registration_date,
          bp.geographic_zone,
          bp.total_area_sqm,
          bp.floor_count,
          bp.is_active,
          bp.building_instance_id,
          oi.object_type_id
        FROM building_portfolio bp
        JOIN object_instances oi ON oi.id = bp.building_instance_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (lifecycle_phase) {
        params.push(String(lifecycle_phase));
        query += ` AND bp.lifecycle_phase = $${params.length}`;
      }
      if (geographic_zone) {
        params.push(String(geographic_zone));
        query += ` AND bp.geographic_zone = $${params.length}`;
      }
      if (is_active !== undefined) {
        params.push(is_active === 'true');
        query += ` AND bp.is_active = $${params.length}`;
      }

      query += ' ORDER BY bp.portfolio_name';

      const result = await db.query(query, params);
      res.json({ buildings: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/portfolio/buildings/:id
   */
  router.get('/buildings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `SELECT bp.*, oi.object_type_id
         FROM building_portfolio bp
         JOIN object_instances oi ON oi.id = bp.building_instance_id
         WHERE bp.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/portfolio/buildings
   * Register a new building in the portfolio
   */
  router.post('/buildings', async (req: Request, res: Response) => {
    try {
      const {
        portfolio_name,
        building_address,
        building_type,
        building_instance_id,
        geographic_zone,
        total_area_sqm,
        floor_count
      } = req.body;

      if (!portfolio_name || !building_instance_id) {
        return res.status(400).json({
          error: 'Missing required fields: portfolio_name, building_instance_id'
        });
      }

      const result = await db.query(
        `INSERT INTO building_portfolio
          (building_instance_id, portfolio_name, building_address, building_type,
           geographic_zone, total_area_sqm, floor_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          building_instance_id,
          portfolio_name,
          building_address || null,
          building_type || 'residential',
          geographic_zone || null,
          total_area_sqm || null,
          floor_count || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * PUT /api/portfolio/buildings/:id
   */
  router.put('/buildings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { lifecycle_phase, is_active, master_process_instance_id } = req.body;

      const updates: string[] = [];
      const params: any[] = [];

      if (lifecycle_phase !== undefined) {
        params.push(lifecycle_phase);
        updates.push(`lifecycle_phase = $${params.length}`);
      }
      if (is_active !== undefined) {
        params.push(is_active);
        updates.push(`is_active = $${params.length}`);
      }
      if (master_process_instance_id !== undefined) {
        params.push(master_process_instance_id);
        updates.push(`master_process_instance_id = $${params.length}`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = NOW()');
      params.push(id);

      const result = await db.query(
        `UPDATE building_portfolio SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/portfolio/campaigns
   */
  router.get('/campaigns', async (req: Request, res: Response) => {
    try {
      const { status, campaign_type } = req.query;

      let query = 'SELECT * FROM portfolio_campaigns WHERE 1=1';
      const params: any[] = [];

      if (status) {
        params.push(String(status));
        query += ` AND status = $${params.length}`;
      }
      if (campaign_type) {
        params.push(String(campaign_type));
        query += ` AND campaign_type = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, params);
      res.json({ campaigns: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/portfolio/campaigns
   */
  router.post('/campaigns', async (req: Request, res: Response) => {
    try {
      const {
        campaign_name,
        campaign_type,
        target_building_ids,
        planned_start,
        planned_end,
        created_by,
        notes
      } = req.body;

      if (!campaign_name || !campaign_type || !target_building_ids) {
        return res.status(400).json({
          error: 'Missing required fields: campaign_name, campaign_type, target_building_ids'
        });
      }

      const result = await db.query(
        `INSERT INTO portfolio_campaigns
          (campaign_name, campaign_type, target_building_ids, planned_start, planned_end, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [campaign_name, campaign_type, target_building_ids, planned_start || null, planned_end || null, created_by || null, notes || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/portfolio/dashboard
   * Aggregate KPIs across the portfolio
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const [
        totalBuildings,
        phaseDistribution,
        typeDistribution,
        activeCampaigns,
        totalArea
      ] = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM building_portfolio WHERE is_active = true'),
        db.query(`
          SELECT lifecycle_phase, COUNT(*) as count
          FROM building_portfolio WHERE is_active = true
          GROUP BY lifecycle_phase ORDER BY count DESC
        `),
        db.query(`
          SELECT building_type, COUNT(*) as count
          FROM building_portfolio WHERE is_active = true
          GROUP BY building_type ORDER BY count DESC
        `),
        db.query(`
          SELECT COUNT(*) as count
          FROM portfolio_campaigns WHERE status = 'in_progress'
        `),
        db.query(`
          SELECT COALESCE(SUM(total_area_sqm), 0) as total_sqm
          FROM building_portfolio WHERE is_active = true
        `)
      ]);

      res.json({
        total_buildings: parseInt(totalBuildings.rows[0].count),
        total_area_sqm: parseFloat(totalArea.rows[0].total_sqm),
        active_campaigns: parseInt(activeCampaigns.rows[0].count),
        phase_distribution: phaseDistribution.rows,
        type_distribution: typeDistribution.rows,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
