/**
 * BIM/IFC Integration API Routes
 *
 * Endpoints for BIM model management and IFC-to-OMS synchronization
 * - GET    /api/bim/models                   - List BIM models
 * - POST   /api/bim/models                   - Register a new model
 * - GET    /api/bim/models/:id               - Get model details
 * - PUT    /api/bim/models/:id/status        - Update model status
 * - GET    /api/bim/models/:id/entities      - List entity mappings
 * - GET    /api/bim/models/:id/clashes       - List clash results
 * - POST   /api/bim/models/:id/clashes       - Record clash results
 * - PUT    /api/bim/clashes/:id              - Update clash status (resolve/accept)
 */

import { Router, Request, Response } from 'express';
import { Client } from 'pg';

export function createBimRouter(db: Client): Router {
  const router = Router();

  /**
   * GET /api/bim/models
   */
  router.get('/models', async (req: Request, res: Response) => {
    try {
      const { building_instance_id, status } = req.query;

      let query = `
        SELECT bm.*, bp.portfolio_name as building_name
        FROM bim_models bm
        LEFT JOIN building_portfolio bp ON bp.building_instance_id = bm.building_instance_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (building_instance_id) {
        params.push(parseInt(String(building_instance_id), 10));
        query += ` AND bm.building_instance_id = $${params.length}`;
      }
      if (status) {
        params.push(String(status));
        query += ` AND bm.status = $${params.length}`;
      }

      query += ' ORDER BY bm.upload_date DESC';

      const result = await db.query(query, params);
      res.json({ models: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/bim/models
   */
  router.post('/models', async (req: Request, res: Response) => {
    try {
      const {
        building_instance_id,
        model_name,
        ifc_schema,
        file_path,
        file_size_bytes,
        authoring_tool,
        uploaded_by
      } = req.body;

      if (!building_instance_id || !model_name) {
        return res.status(400).json({
          error: 'Missing required fields: building_instance_id, model_name'
        });
      }

      // Auto-increment version for same building
      const versionResult = await db.query(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM bim_models WHERE building_instance_id = $1',
        [building_instance_id]
      );
      const nextVersion = versionResult.rows[0].next_version;

      const result = await db.query(
        `INSERT INTO bim_models
          (building_instance_id, model_name, ifc_schema, version, file_path,
           file_size_bytes, authoring_tool, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          building_instance_id, model_name,
          ifc_schema || 'IFC4', nextVersion,
          file_path || null, file_size_bytes || null,
          authoring_tool || null, uploaded_by || null
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/bim/models/:id
   */
  router.get('/models/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [model, entityCount, clashCount] = await Promise.all([
        db.query('SELECT * FROM bim_models WHERE id = $1', [id]),
        db.query('SELECT COUNT(*) as count FROM bim_entity_mappings WHERE bim_model_id = $1', [id]),
        db.query(
          `SELECT status, COUNT(*) as count FROM bim_clash_results
           WHERE bim_model_id = $1 GROUP BY status`,
          [id]
        )
      ]);

      if (model.rows.length === 0) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json({
        ...model.rows[0],
        entity_count: parseInt(entityCount.rows[0].count),
        clash_summary: clashCount.rows
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * PUT /api/bim/models/:id/status
   */
  router.put('/models/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, parsed_entity_count, validation_issues, process_instance_id } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Missing required field: status' });
      }

      const updates = ['status = $1'];
      const params: any[] = [status];

      if (parsed_entity_count !== undefined) {
        params.push(parsed_entity_count);
        updates.push(`parsed_entity_count = $${params.length}`);
      }
      if (validation_issues !== undefined) {
        params.push(JSON.stringify(validation_issues));
        updates.push(`validation_issues = $${params.length}`);
      }
      if (process_instance_id !== undefined) {
        params.push(process_instance_id);
        updates.push(`process_instance_id = $${params.length}`);
      }

      params.push(id);
      const result = await db.query(
        `UPDATE bim_models SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Model not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/bim/models/:id/entities
   */
  router.get('/models/:id/entities', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { ifc_entity_type, sync_status } = req.query;

      let query = `
        SELECT bem.*, oi.object_type_id as oms_type_id
        FROM bim_entity_mappings bem
        LEFT JOIN object_instances oi ON oi.id = bem.oms_object_instance_id
        WHERE bem.bim_model_id = $1
      `;
      const params: any[] = [id];

      if (ifc_entity_type) {
        params.push(String(ifc_entity_type));
        query += ` AND bem.ifc_entity_type = $${params.length}`;
      }
      if (sync_status) {
        params.push(String(sync_status));
        query += ` AND bem.sync_status = $${params.length}`;
      }

      query += ' ORDER BY bem.ifc_entity_type, bem.ifc_name';

      const result = await db.query(query, params);
      res.json({ entities: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/bim/models/:id/clashes
   */
  router.get('/models/:id/clashes', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, severity } = req.query;

      let query = 'SELECT * FROM bim_clash_results WHERE bim_model_id = $1';
      const params: any[] = [id];

      if (status) {
        params.push(String(status));
        query += ` AND status = $${params.length}`;
      }
      if (severity) {
        params.push(String(severity));
        query += ` AND severity = $${params.length}`;
      }

      query += ' ORDER BY severity DESC, created_at DESC';

      const result = await db.query(query, params);
      res.json({ clashes: result.rows, count: result.rows.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/bim/models/:id/clashes
   * Bulk insert clash results from clash detection
   */
  router.post('/models/:id/clashes', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { clashes } = req.body;

      if (!Array.isArray(clashes) || clashes.length === 0) {
        return res.status(400).json({ error: 'clashes must be a non-empty array' });
      }

      await db.query('BEGIN');

      let insertedCount = 0;
      for (const clash of clashes) {
        await db.query(
          `INSERT INTO bim_clash_results
            (bim_model_id, clash_type, severity, entity_a_global_id, entity_a_type,
             entity_b_global_id, entity_b_type, description, location_x, location_y, location_z)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id, clash.clash_type, clash.severity || 'warning',
            clash.entity_a_global_id, clash.entity_a_type || null,
            clash.entity_b_global_id, clash.entity_b_type || null,
            clash.description || null,
            clash.location_x || null, clash.location_y || null, clash.location_z || null
          ]
        );
        insertedCount++;
      }

      await db.query('COMMIT');
      res.status(201).json({ inserted: insertedCount });
    } catch (error) {
      await db.query('ROLLBACK');
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * PUT /api/bim/clashes/:id
   * Update clash status (resolve, accept, ignore)
   */
  router.put('/clashes/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, resolved_by } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Missing required field: status' });
      }

      const result = await db.query(
        `UPDATE bim_clash_results
         SET status = $1, resolved_by = $2, resolved_at = CASE WHEN $1 IN ('resolved', 'accepted') THEN NOW() ELSE NULL END
         WHERE id = $3 RETURNING *`,
        [status, resolved_by || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Clash not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
