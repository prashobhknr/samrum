/**
 * Phase 3: Objects API Routes
 * 
 * CRUD endpoints for door/lock/frame management
 * - GET  /api/objects/types - List all object types
 * - GET  /api/objects/instances - List doors with filters
 * - GET  /api/objects/instances/:id - Get single door with attributes
 * - POST /api/objects/instances - Create door
 * - PUT  /api/objects/instances/:id - Update door
 */

import { Router, Request, Response } from 'express';
import { Client } from 'pg';

export function createObjectsRouter(db: Client): Router {
  const router = Router();

  /**
   * GET /api/objects/types
   * List all object types (Door, Lock, Frame, etc.)
   */
  router.get('/types', async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT id, name, description, icon_url, created_at
        FROM object_types
        ORDER BY id
      `;

      const result = await db.query(query);
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/objects/types/:id
   * Get single object type with all attributes
   */
  router.get('/types/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const typeQuery = `
        SELECT id, name, description, icon_url, created_at
        FROM object_types
        WHERE id = $1
      `;

      const typeResult = await db.query(typeQuery, [id]);
      if (typeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Object type not found' });
      }

      const attrQuery = `
        SELECT 
          id, attribute_name, attribute_type, is_required, enum_values,
          default_value, help_text, placeholder
        FROM object_attributes
        WHERE object_type_id = $1
        ORDER BY id
      `;

      const attrResult = await db.query(attrQuery, [id]);

      res.status(200).json({
        ...typeResult.rows[0],
        attributes: attrResult.rows
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/objects/instances
   * List door instances with pagination and filters
   * 
   * Query params:
   *   - type: number (default: 1 for Door)
   *   - limit: number (default: 50)
   *   - offset: number (default: 0)
   *   - search: string (search in name/external_id)
   */
  router.get('/instances', async (req: Request, res: Response) => {
    try {
      const objectTypeId = req.query.type ? parseInt(String(req.query.type), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const search = req.query.search ? String(req.query.search) : null;

      let whereClause = 'WHERE object_type_id = $1';
      let paramIndex = 2;
      const params: any[] = [objectTypeId];

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR external_id ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const countQuery = `SELECT COUNT(*) as count FROM object_instances ${whereClause}`;
      const countResult = await db.query(countQuery, params);

      const query = `
        SELECT 
          id, object_type_id, external_id, name, created_at, updated_at
        FROM object_instances
        ${whereClause}
        ORDER BY external_id
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);
      const result = await db.query(query, params);

      res.status(200).json({
        total: parseInt(countResult.rows[0].count, 10),
        limit,
        offset,
        items: result.rows
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/objects/instances/:id
   * Get single door instance with all attributes
   */
  router.get('/instances/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const instanceQuery = `
        SELECT id, object_type_id, external_id, name, created_at, updated_at
        FROM object_instances
        WHERE id = $1
      `;

      const instanceResult = await db.query(instanceQuery, [id]);
      if (instanceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Door instance not found' });
      }

      const attrQuery = `
        SELECT 
          av.id as attribute_value_id,
          oa.id as attribute_id,
          oa.attribute_name,
          oa.attribute_type,
          av.value,
          oa.is_required,
          oa.help_text
        FROM attribute_values av
        JOIN object_attributes oa ON oa.id = av.object_attribute_id
        WHERE av.object_instance_id = $1
        ORDER BY oa.id
      `;

      const attrResult = await db.query(attrQuery, [id]);

      res.status(200).json({
        ...instanceResult.rows[0],
        attributes: attrResult.rows
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/objects/instances
   * Create new door instance
   * 
   * Body:
   * {
   *   "external_id": "D-100",
   *   "name": "New Door",
   *   "attributes": {
   *     "fire_class": "EI30",
   *     "security_class": "MEDIUM"
   *   }
   * }
   */
  router.post('/instances', async (req: Request, res: Response) => {
    try {
      const { external_id, name, attributes } = req.body;

      if (!external_id || !name) {
        return res.status(400).json({
          error: 'Missing required fields: external_id, name'
        });
      }

      const objectTypeId = 1; // Door type
      const client = db;

      await client.query('BEGIN');

      // Insert instance
      const instanceQuery = `
        INSERT INTO object_instances (object_type_id, external_id, name)
        VALUES ($1, $2, $3)
        RETURNING id
      `;

      const instanceResult = await client.query(instanceQuery, [
        objectTypeId,
        external_id,
        name
      ]);

      const instanceId = instanceResult.rows[0].id;

      // Insert attributes
      if (attributes) {
        for (const [attrName, value] of Object.entries(attributes)) {
          const attrIdQuery = `
            SELECT id FROM object_attributes 
            WHERE attribute_name = $1 AND object_type_id = $2
          `;

          const attrIdResult = await client.query(attrIdQuery, [attrName, objectTypeId]);
          if (attrIdResult.rows.length > 0) {
            const attrId = attrIdResult.rows[0].id;

            const attrValQuery = `
              INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
              VALUES ($1, $2, $3)
            `;

            await client.query(attrValQuery, [instanceId, attrId, String(value)]);
          }
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Door instance created',
        id: instanceId,
        external_id,
        name
      });
    } catch (error) {
      await db.query('ROLLBACK');
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * PUT /api/objects/instances/:id
   * Update door instance
   */
  router.put('/instances/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, attributes } = req.body;

      const client = db;
      await client.query('BEGIN');

      // Update name if provided
      if (name) {
        const updateQuery = `
          UPDATE object_instances
          SET name = $1, updated_at = NOW()
          WHERE id = $2
        `;
        await client.query(updateQuery, [name, id]);
      }

      // Update attributes
      if (attributes) {
        for (const [attrName, value] of Object.entries(attributes)) {
          const attrIdQuery = `
            SELECT id FROM object_attributes WHERE attribute_name = $1
          `;

          const attrIdResult = await client.query(attrIdQuery, [attrName]);
          if (attrIdResult.rows.length > 0) {
            const attrId = attrIdResult.rows[0].id;

            const upsertQuery = `
              INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
              VALUES ($1, $2, $3)
              ON CONFLICT(object_instance_id, object_attribute_id)
              DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `;

            await client.query(upsertQuery, [id, attrId, String(value)]);
          }
        }
      }

      await client.query('COMMIT');

      res.status(200).json({
        message: 'Door instance updated',
        id: parseInt(id, 10)
      });
    } catch (error) {
      await db.query('ROLLBACK');
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
