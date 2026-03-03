/**
 * Doorman Demo Server - Quick Working API
 * ES Modules version for Node.js 25.6.1
 */

import http from 'http';
import url from 'url';
import pkg from 'pg';
const { Client } = pkg;

// PostgreSQL connection
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://doorman_user:doorman_pass@localhost:5432/doorman_db'
});

// Configuration
const DISABLE_AUTH_CHECK = true; // Set to false to enable role-based security checks again

const PORT = process.env.API_PORT || 3000;

// Connect to database
client.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected to PostgreSQL');
});

// In-memory view settings store (module_id -> column config)
const viewSettings = {};

// Derive the ID column label from an OMS object type name
function getIdColumnLabel(typeName) {
  if (!typeName) return 'Objekt-ID';
  const map = {
    'Door': 'DörrID', 'Lock': 'LåsID', 'Door Frame': 'KarmID',
    'Door Automation': 'AutomatikID', 'Wall Type': 'VäggtypsID',
  };
  if (map[typeName]) return map[typeName];
  if (typeName.startsWith('ID ')) {
    const rest = typeName.substring(3);
    return rest.charAt(0).toUpperCase() + rest.slice(1) + '-ID';
  }
  if (typeName.endsWith('ID')) return typeName;
  return typeName + '-ID';
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Basic auth guard generator
  const requireAdmin = async (req, res) => {
    if (DISABLE_AUTH_CHECK) return true;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return false;
    }
    try {
      // Decode Base64 token (username:password) -> For demo, we just extract username from matching token in auth.ts
      const token = authHeader.split(' ')[1];
      const decoded = Buffer.from(token, 'base64').toString('ascii');
      const [username] = decoded.split(':');

      // Role check has been removed as per user request to remove admin restrictions.
      // Any valid authenticated user is now allowed to access admin endpoints.
      return true;
    } catch (e) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return false;
    }
  };

  const readBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });

  try {
    // Phase 8: Authentication endpoint (Demo logic)
    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await readBody();
      const { username, password } = body;

      const r = await client.query('SELECT id, username, email FROM samrum_users WHERE username = $1', [username]);
      const user = r.rows[0];

      // MOCK password check for demo purposes
      if (!user || password !== 'password123') {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }

      // Fetch user roles
      const rolesRes = await client.query('SELECT role FROM samrum_user_roles WHERE user_id = $1', [user.id]);
      const roles = rolesRes.rows.map(row => row.role);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          id: user.id.toString(),
          username: user.username,
          name: user.username,
          email: user.email,
          groups: roles
        }
      }));
      return;
    }

    // Health check
    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
      }));
      return;
    }

    // API info
    if (pathname === '/api') {
      res.writeHead(200);
      res.end(JSON.stringify({
        service: 'Doorman API (Demo)',
        version: '1.0.0',
        phase: 'Phase 1: Foundation',
        status: 'operational',
        database: 'PostgreSQL OMS',
        endpoints: {
          objects: '/api/objects/types',
          instances: '/api/objects/instances',
          forms: '/api/forms'
        }
      }));
      return;
    }

    // Get object types
    if (pathname === '/api/objects/types' && req.method === 'GET') {
      const result = await client.query('SELECT id, name, description FROM object_types ORDER BY id');
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: result.rows,
        count: result.rows.length
      }));
      return;
    }

    // POST /api/objects/instances — create a new instance
    if (pathname === '/api/objects/instances' && req.method === 'POST') {
      const body = await readBody();
      const { object_type_id, name, external_id, attribute_values_by_id, is_active } = body;
      if (!object_type_id) {
        res.writeHead(400); res.end(JSON.stringify({ success: false, error: 'object_type_id is required' })); return;
      }
      await client.query('BEGIN');
      try {
        const instR = await client.query(
          `INSERT INTO object_instances (object_type_id, external_id, name, is_active)
           VALUES ($1, $2, $3, $4) RETURNING id, external_id, name`,
          [object_type_id, external_id || null, name || null, is_active !== false]
        );
        const newId = instR.rows[0].id;
        if (attribute_values_by_id && typeof attribute_values_by_id === 'object') {
          for (const [attrId, val] of Object.entries(attribute_values_by_id)) {
            if (val === null || val === undefined || String(val).trim() === '') continue;
            await client.query(
              `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
               VALUES ($1, $2, $3)
               ON CONFLICT (object_instance_id, object_attribute_id) DO UPDATE SET value = $3, updated_at = NOW()`,
              [newId, parseInt(attrId), String(val)]
            );
          }
        }
        await client.query('COMMIT');
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, id: newId, external_id: instR.rows[0].external_id, name: instR.rows[0].name }));
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
          res.writeHead(409);
          res.end(JSON.stringify({ success: false, error: 'En instans med detta ID finns redan' }));
        } else {
          throw err;
        }
      }
      return;
    }

    // Get object instances (doors)
    if (pathname === '/api/objects/instances' && req.method === 'GET') {
      const result = await client.query(`
        SELECT 
          oi.id,
          oi.external_id,
          oi.name,
          ot.name as object_type
        FROM object_instances oi
        JOIN object_types ot ON oi.object_type_id = ot.id
        ORDER BY oi.id
      `);
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: result.rows,
        count: result.rows.length
      }));
      return;
    }

    // GET /api/objects/types/:typeId/instances — list all instances of an OMS type
    const typeInstMatch = pathname.match(/^\/api\/objects\/types\/(\d+)\/instances$/);
    if (typeInstMatch && req.method === 'GET') {
      const typeId = typeInstMatch[1];
      const r = await client.query(
        `SELECT id, external_id, name FROM object_instances WHERE object_type_id = $1 ORDER BY external_id`,
        [typeId]
      );
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }

    // GET /api/objects/instances/:id/details?module=:moduleId
    const detailsMatch = pathname.match(/^\/api\/objects\/instances\/(\d+)\/details$/);
    if (detailsMatch && req.method === 'GET') {
      const instanceId = parseInt(detailsMatch[1]);
      const moduleId = parsedUrl.query.module ? parseInt(parsedUrl.query.module) : null;

      // 1. Load instance + OMS type
      const instR = await client.query(
        `SELECT oi.id, oi.external_id, oi.name, oi.object_type_id, oi.is_active, oi.is_locked,
                ot.name AS object_type_name, ot.samrum_ot_id
         FROM object_instances oi
         JOIN object_types ot ON ot.id = oi.object_type_id
         WHERE oi.id = $1`, [instanceId]);
      if (!instR.rows.length) {
        res.writeHead(404); res.end(JSON.stringify({ success: false, error: 'Instance not found' })); return;
      }
      const inst = instR.rows[0];

      // 2. Load module info (if moduleId given)
      let moduleInfo = null;
      if (moduleId) {
        const modR = await client.query(
          `SELECT id, name FROM samrum_modules WHERE id = $1`, [moduleId]);
        if (modR.rows.length) moduleInfo = modR.rows[0];
      }

      // 3. Load column definitions
      let columns = [];
      if (moduleId) {
        const mvcR = await client.query(
          `SELECT mvc.column_key AS key, mvc.label, mvc.col_type AS type,
                  mvc.col_order, mvc.is_required, mvc.is_editable,
                  mvc.oms_attribute_id, oa.enum_values
           FROM module_view_columns mvc
           LEFT JOIN object_attributes oa ON oa.id = mvc.oms_attribute_id
           WHERE mvc.module_id = $1
           ORDER BY mvc.col_order, mvc.id`, [moduleId]);
        columns = mvcR.rows;
      }
      // Fallback: all OMS attributes for this type
      if (columns.length === 0) {
        const fbR = await client.query(
          `SELECT attribute_name AS key, attribute_name AS label, attribute_type AS type,
                  0 AS col_order, is_required, TRUE AS is_editable, id AS oms_attribute_id, enum_values
           FROM object_attributes WHERE object_type_id = $1 ORDER BY id`, [inst.object_type_id]);
        columns = fbR.rows;
      }

      // 4. Load attribute_values for this instance
      const attrIds = [...new Set(columns.filter(c => c.oms_attribute_id).map(c => Number(c.oms_attribute_id)))];
      let avMap = {};
      if (attrIds.length > 0) {
        const avR = await client.query(
          `SELECT object_attribute_id, value FROM attribute_values
           WHERE object_instance_id = $1 AND object_attribute_id = ANY($2::int[])`,
          [instanceId, attrIds]);
        avR.rows.forEach(av => { avMap[av.object_attribute_id] = av.value; });
      }

      // 5. Build fields array (skip reference-type cols — handled as related_groups)
      const mapType = (t) => t || 'text';
      const fields = columns
        .filter(c => mapType(c.type) !== 'reference')
        .map(c => ({
          key: c.key,
          label: c.label || c.key,
          type: mapType(c.type),
          col_order: c.col_order,
          is_required: c.is_required || false,
          is_editable: c.is_editable !== false,
          enum_values: c.enum_values || null,
          oms_attribute_id: c.oms_attribute_id ? Number(c.oms_attribute_id) : null,
          value: c.oms_attribute_id ? (avMap[c.oms_attribute_id] ?? null) : null,
        }));

      // 6. Load object_relationships for this OMS type
      const relR = await client.query(
        `SELECT r.id AS relationship_id, r.child_object_type_id AS type_id,
                ot.name AS type_name, r.relationship_name, r.cardinality
         FROM object_relationships r
         JOIN object_types ot ON ot.id = r.child_object_type_id
         WHERE r.parent_object_type_id = $1
         ORDER BY r.id`, [inst.object_type_id]);

      // 7. For each relationship, load linked child instances
      const relatedGroups = [];
      for (const rel of relR.rows) {
        const linksR = await client.query(
          `SELECT oir.id AS link_id, ci.id, ci.external_id, ci.name
           FROM object_instance_relationships oir
           JOIN object_instances ci ON ci.id = oir.child_instance_id
           WHERE oir.parent_instance_id = $1 AND oir.relationship_id = $2
           ORDER BY ci.external_id`, [instanceId, rel.relationship_id]);
        relatedGroups.push({
          relationship_id: rel.relationship_id,
          type_id: rel.type_id,
          type_name: rel.type_name,
          relationship_name: rel.relationship_name,
          cardinality: rel.cardinality,
          instances: linksR.rows,
        });
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        instance: {
          id: inst.id, external_id: inst.external_id, name: inst.name,
          object_type_id: inst.object_type_id, object_type_name: inst.object_type_name,
          id_column_label: getIdColumnLabel(inst.object_type_name),
          is_active: inst.is_active,
          is_locked: inst.is_locked || false,
        },
        module: moduleInfo,
        fields,
        related_groups: relatedGroups,
      }));
      return;
    }

    // POST /api/objects/instances/:id/relationships
    const relPostMatch = pathname.match(/^\/api\/objects\/instances\/(\d+)\/relationships$/);
    if (relPostMatch && req.method === 'POST') {
      const parentId = parseInt(relPostMatch[1]);
      const body = await readBody();
      const { child_instance_id, relationship_id } = body;
      if (!child_instance_id || !relationship_id) {
        res.writeHead(400); res.end(JSON.stringify({ success: false, error: 'child_instance_id and relationship_id required' })); return;
      }
      await client.query(
        `INSERT INTO object_instance_relationships (parent_instance_id, child_instance_id, relationship_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [parentId, child_instance_id, relationship_id]);
      res.writeHead(201); res.end(JSON.stringify({ success: true })); return;
    }

    // DELETE /api/objects/instances/:id/relationships/:linkId
    const relDelMatch = pathname.match(/^\/api\/objects\/instances\/(\d+)\/relationships\/(\d+)$/);
    if (relDelMatch && req.method === 'DELETE') {
      const [, parentId, linkId] = relDelMatch;
      await client.query(
        `DELETE FROM object_instance_relationships WHERE id = $1 AND parent_instance_id = $2`,
        [linkId, parentId]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }

    // PATCH /api/objects/instances/:id/lock — toggle locked state (A010)
    const lockMatch = pathname.match(/^\/api\/objects\/instances\/(\d+)\/lock$/);
    if (lockMatch && req.method === 'PATCH') {
      const id = parseInt(lockMatch[1]);
      const body = await readBody();
      const locked = body.is_locked === true;
      await client.query(`UPDATE object_instances SET is_locked = $1 WHERE id = $2`, [locked, id]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, is_locked: locked }));
      return;
    }

    // POST /api/objects/instances/:id/copy — duplicate instance + attribute_values
    const copyMatch = pathname.match(/^\/api\/objects\/instances\/(\d+)\/copy$/);
    if (copyMatch && req.method === 'POST') {
      const srcId = parseInt(copyMatch[1]);
      const src = await client.query(`SELECT * FROM object_instances WHERE id = $1`, [srcId]);
      if (!src.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      const s = src.rows[0];
      // Build a unique external_id for the copy (retry with incrementing suffix)
      const baseExtId = `${s.external_id || 'kopia'}`;
      let newExtId = `${baseExtId}-kopia`;
      let suffix = 2;
      while (true) {
        const exists = await client.query(
          `SELECT 1 FROM object_instances WHERE object_type_id=$1 AND external_id=$2`, [s.object_type_id, newExtId]);
        if (!exists.rows.length) break;
        newExtId = `${baseExtId}-kopia${suffix++}`;
      }
      const newInst = await client.query(
        `INSERT INTO object_instances (object_type_id, external_id, name, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [s.object_type_id, newExtId, `${s.name || ''} (kopia)`, s.is_active]
      );
      const newId = newInst.rows[0].id;
      await client.query(
        `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
         SELECT $1, object_attribute_id, value FROM attribute_values WHERE object_instance_id = $2`,
        [newId, srcId]
      );
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, id: newId }));
      return;
    }

    // Get instance with attributes
    if (pathname.startsWith('/api/objects/instances/') && req.method === 'GET') {
      const instanceId = pathname.split('/').pop();
      const result = await client.query(`
        SELECT 
          oi.id,
          oi.external_id,
          oi.name,
          ot.name as object_type,
          json_agg(
            json_build_object(
              'attribute_id', av.object_attribute_id,
              'attribute_name', oa.attribute_name,
              'value', av.value
            )
          ) as attributes
        FROM object_instances oi
        JOIN object_types ot ON oi.object_type_id = ot.id
        LEFT JOIN attribute_values av ON oi.id = av.object_instance_id
        LEFT JOIN object_attributes oa ON av.object_attribute_id = oa.id
        WHERE oi.id = $1
        GROUP BY oi.id, oi.external_id, oi.name, ot.name
      `, [instanceId]);

      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Instance not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: result.rows[0]
      }));
      return;
    }

    // Get all attributes
    if (pathname === '/api/objects/attributes' && req.method === 'GET') {
      const result = await client.query(`
        SELECT 
          oa.id,
          oa.attribute_name,
          ot.name as object_type,
          oa.attribute_type,
          oa.is_required
        FROM object_attributes oa
        JOIN object_types ot ON oa.object_type_id = ot.id
        ORDER BY ot.name, oa.attribute_name
      `);
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: result.rows,
        count: result.rows.length
      }));
      return;
    }

    // Database stats
    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = await Promise.all([
        client.query('SELECT COUNT(*) FROM object_types'),
        client.query('SELECT COUNT(*) FROM object_attributes'),
        client.query('SELECT COUNT(*) FROM object_instances'),
        client.query('SELECT COUNT(*) FROM attribute_values'),
        client.query('SELECT COUNT(*) FROM object_relationships'),
        client.query('SELECT COUNT(*) FROM samrum_users'),
        client.query('SELECT COUNT(*) FROM samrum_user_roles'),
        client.query('SELECT COUNT(*) FROM samrum_object_types'),
        client.query('SELECT COUNT(*) FROM samrum_relationships'),
        client.query('SELECT COUNT(*) FROM samrum_modules'),
        client.query('SELECT COUNT(*) FROM samrum_module_folders'),
        client.query('SELECT COUNT(*) FROM samrum_classifications'),
      ]);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        stats: {
          object_types: parseInt(stats[0].rows[0].count),
          attributes: parseInt(stats[1].rows[0].count),
          instances: parseInt(stats[2].rows[0].count),
          attribute_values: parseInt(stats[3].rows[0].count),
          relationships: parseInt(stats[4].rows[0].count),
          users: parseInt(stats[5].rows[0].count),
          user_roles: parseInt(stats[6].rows[0].count),
          samrum_object_types: parseInt(stats[7].rows[0].count),
          samrum_relationships: parseInt(stats[8].rows[0].count),
          samrum_modules: parseInt(stats[9].rows[0].count),
          samrum_module_folders: parseInt(stats[10].rows[0].count),
          samrum_classifications: parseInt(stats[11].rows[0].count),
        }
      }));
      return;
    }

    // ─── Object Instances: Bulk Update ────────────────────────────────────────
    if (pathname === '/api/objects/instances/bulk-update' && req.method === 'PUT') {
      const body = await readBody();
      const { ids, attribute_values, attribute_values_by_id, name, is_active } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'IDs array is required' }));
        return;
      }

      await client.query('BEGIN');
      try {
        for (const id of ids) {
          // attribute_values_by_id: { [oms_attribute_id]: value } — preferred path (by attr ID)
          if (attribute_values_by_id && typeof attribute_values_by_id === 'object') {
            for (const [attrId, val] of Object.entries(attribute_values_by_id)) {
              await client.query(`
                INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
                VALUES ($1, $2, $3)
                ON CONFLICT (object_instance_id, object_attribute_id)
                DO UPDATE SET value = $3, updated_at = NOW()
              `, [id, parseInt(attrId), val !== null && val !== undefined ? String(val) : null]);
            }
          }
          // attribute_values: { [attrName]: value } — legacy path (by attr name)
          if (attribute_values && typeof attribute_values === 'object') {
            for (const [attrName, val] of Object.entries(attribute_values)) {
              await client.query(`
                INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
                SELECT $1, oa.id, $2
                FROM object_attributes oa
                WHERE oa.attribute_name = $3
                  AND oa.object_type_id = (SELECT object_type_id FROM object_instances WHERE id = $1)
                ON CONFLICT (object_instance_id, object_attribute_id)
                DO UPDATE SET value = $2, updated_at = NOW()
              `, [id, String(val), attrName]);
            }
          }
          if (name !== undefined) {
            await client.query(`UPDATE object_instances SET name = $1 WHERE id = $2`, [name, id]);
          }
          if (is_active !== undefined) {
            await client.query(`UPDATE object_instances SET is_active = $1 WHERE id = $2`, [is_active, id]);
          }
        }
        await client.query('COMMIT');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: `Updated ${ids.length} instances` }));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      return;
    }

    if (pathname.match(/^\/api\/objects\/instances\/\d+$/) && req.method === 'PUT') {
      const instanceId = parseInt(pathname.split('/').pop() ?? '0');
      const body = await readBody();
      await client.query('BEGIN');
      try {
        // attribute_values_by_id: { [oms_attribute_id]: value } — preferred path from new edit form
        if (body.attribute_values_by_id && typeof body.attribute_values_by_id === 'object') {
          for (const [attrId, val] of Object.entries(body.attribute_values_by_id)) {
            await client.query(`
              INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
              VALUES ($1, $2, $3)
              ON CONFLICT (object_instance_id, object_attribute_id)
              DO UPDATE SET value = $3, updated_at = NOW()
            `, [instanceId, parseInt(attrId), val !== null && val !== undefined ? String(val) : null]);
          }
        }
        // attribute_values: { [attrName]: value } — legacy path from old edit form
        if (body.attribute_values && typeof body.attribute_values === 'object') {
          for (const [attrName, val] of Object.entries(body.attribute_values)) {
            await client.query(`
              INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
              SELECT $1, oa.id, $2
              FROM object_attributes oa
              WHERE oa.attribute_name = $3
                AND oa.object_type_id = (SELECT object_type_id FROM object_instances WHERE id = $1)
              ON CONFLICT (object_instance_id, object_attribute_id)
              DO UPDATE SET value = $2, updated_at = NOW()
            `, [instanceId, String(val), attrName]);
          }
        }
        if (body.name !== undefined || body.external_id !== undefined || body.is_active !== undefined) {
          await client.query(
            `UPDATE object_instances
             SET name = COALESCE($1, name),
                 external_id = COALESCE($2, external_id),
                 is_active = COALESCE($3, is_active)
             WHERE id = $4`,
            [body.name ?? null, body.external_id ?? null,
             body.is_active !== undefined ? body.is_active : null, instanceId]
          );
        }
        await client.query('COMMIT');
        res.writeHead(200); res.end(JSON.stringify({ success: true }));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      return;
    }

    if (pathname.match(/^\/api\/objects\/instances\/\d+$/) && req.method === 'DELETE') {
      const instanceId = parseInt(pathname.split('/').pop() ?? '0');
      await client.query(`DELETE FROM attribute_values WHERE object_instance_id = $1`, [instanceId]);
      await client.query(`DELETE FROM object_instances WHERE id = $1`, [instanceId]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }

    // ==========================================
    // ADMIN ENDPOINTS (Require global_security_admin)
    // ==========================================
    if (pathname.startsWith('/api/admin')) {
      if (!(await requireAdmin(req, res))) return;
    }

    // ─── Admin: Storage Types ──────────────────────────────────────────────────
    if (pathname === '/api/admin/storage-types' && req.method === 'GET') {
      const r = await client.query('SELECT * FROM samrum_storage_types ORDER BY id');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }

    // ─── Admin: Data Types ─────────────────────────────────────────────────────
    if (pathname === '/api/admin/data-types' && req.method === 'GET') {
      const r = await client.query('SELECT * FROM samrum_data_types ORDER BY id');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }

    // ─── Admin: Classifications ────────────────────────────────────────────────
    if (pathname === '/api/admin/classifications') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM samrum_classifications ORDER BY name');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          'INSERT INTO samrum_classifications (name, description) VALUES ($1,$2) RETURNING *',
          [body.name, body.description || null]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    if (pathname.match(/^\/api\/admin\/classifications\/(\d+)$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          'UPDATE samrum_classifications SET name=$1, description=$2 WHERE id=$3 RETURNING *',
          [body.name, body.description || null, id]
        );
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_classifications WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    // ─── Admin: Object Types ───────────────────────────────────────────────────
    if (pathname === '/api/admin/object-types') {
      const q = parsedUrl.query;
      if (req.method === 'GET') {
        const page = Math.max(1, parseInt(q.page || '1'));
        const pageSize = Math.min(1400, Math.max(1, parseInt(q.pageSize || '50')));
        const offset = (page - 1) * pageSize;
        const search = q.search || '';
        const classificationName = q.classificationId || '';
        const selectedId = q.selectedId ? parseInt(q.selectedId) : null;

        const base = `FROM samrum_object_types ot
          LEFT JOIN samrum_data_types dt ON ot.data_type_id = dt.id
          LEFT JOIN samrum_classifications c ON ot.classification_id = c.id`;
        const conditions = [];
        const params = [];

        if (search) { conditions.push(`ot.name_singular ILIKE $${params.length + 1}`); params.push(`%${search}%`); }
        if (classificationName) { conditions.push(`c.name = $${params.length + 1}`); params.push(classificationName); }
        if (q.primitive) { conditions.push(`ot.data_type_id NOT IN (14, 16)`); }
        if (q.complex) { conditions.push(`ot.data_type_id IN (14, 16)`); }
        if (selectedId) {
          const relR = await client.query(
            `SELECT DISTINCT to_type_id AS id FROM samrum_relationships WHERE from_type_id=$1
             UNION SELECT DISTINCT from_type_id FROM samrum_relationships WHERE to_type_id=$1`,
            [selectedId]);
          const allIds = [selectedId, ...relR.rows.map(r => r.id)];
          conditions.push(`ot.id = ANY($${params.length + 1})`);
          params.push(allIds);
        }

        const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        const dataParams = [...params, pageSize, offset];
        const r = await client.query(
          `SELECT ot.*, dt.name as data_type_name, c.name as classification_name ${base}${where} ORDER BY ot.name_singular LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          dataParams);
        const countR = await client.query(`SELECT COUNT(*) ${base}${where}`, params);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows, total: parseInt(countR.rows[0].count) }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          `INSERT INTO samrum_object_types (data_type_id, name_singular, name_plural, default_attr_caption, description, is_abstract, classification_id, database_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [body.data_type_id || null, body.name_singular, body.name_plural || null,
          body.default_attr_caption || null, body.description || null,
          body.is_abstract || false, body.classification_id || null, body.database_id || null]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    const otMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)$/);
    if (otMatch) {
      const id = otMatch[1];
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT ot.*, dt.name as data_type_name, c.name as classification_name
           FROM samrum_object_types ot
           LEFT JOIN samrum_data_types dt ON ot.data_type_id = dt.id
           LEFT JOIN samrum_classifications c ON ot.classification_id = c.id
           WHERE ot.id = $1`, [id]);
        if (!r.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_object_types SET data_type_id=$1, name_singular=$2, name_plural=$3,
           default_attr_caption=$4, description=$5, is_abstract=$6, classification_id=$7,
           database_id=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
          [body.data_type_id || null, body.name_singular, body.name_plural || null,
          body.default_attr_caption || null, body.description || null,
          body.is_abstract || false, body.classification_id || null,
          body.database_id || null, id]
        );
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_object_types WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    const otRelMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/relationships$/);
    if (otRelMatch && req.method === 'POST') {
      const fromId = parseInt(otRelMatch[1]);
      const body = await readBody();
      const r = await client.query(
        `INSERT INTO samrum_relationships (from_type_id, to_type_id, caption_singular, caption_plural, min_relations, max_relations, is_requirement)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [fromId, body.to_type_id, body.caption_singular || null, body.caption_plural || null,
         body.min_relations || 0, body.max_relations || null, body.is_requirement || false]
      );
      res.writeHead(201); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
    }
    const relDeleteMatch = pathname.match(/^\/api\/admin\/object-types\/relationships\/(\d+)$/);
    if (relDeleteMatch && req.method === 'DELETE') {
      await client.query('DELETE FROM samrum_relationships WHERE id=$1', [parseInt(relDeleteMatch[1])]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }
    if (relDeleteMatch && req.method === 'PUT') {
      const body = await readBody();
      const r = await client.query(
        `UPDATE samrum_relationships SET caption_singular=$1, caption_plural=$2, min_relations=$3, max_relations=$4 WHERE id=$5 RETURNING *`,
        [body.caption_singular || null, body.caption_plural || null,
         body.min_relations ?? 0, body.max_relations || null, parseInt(relDeleteMatch[1])]);
      res.writeHead(r.rows.length ? 200 : 404);
      res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null })); return;
    }
    if (otRelMatch && req.method === 'GET') {
      const id = otRelMatch[1];
      const r = await client.query(
        `SELECT r.*, ot_from.name_singular as from_name, ot_to.name_singular as to_name
         FROM samrum_relationships r
         JOIN samrum_object_types ot_from ON r.from_type_id = ot_from.id
         JOIN samrum_object_types ot_to ON r.to_type_id = ot_to.id
         WHERE r.from_type_id = $1 OR r.to_type_id = $1
         ORDER BY r.caption_singular`, [id]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }

    // GET /api/admin/object-types/:id/modules — modules that use this object type
    const otModsMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/modules$/);
    if (otModsMatch && req.method === 'GET') {
      const otId = otModsMatch[1];
      const r = await client.query(
        `SELECT mot.id, mot.module_id, mot.allow_edit, mot.show_as_root,
                mot.allow_insert, mot.is_main_object_type,
                m.name as module_name, mf.name as folder_name
         FROM samrum_module_object_types mot
         JOIN samrum_modules m ON mot.module_id = m.id
         LEFT JOIN samrum_module_folders mf ON m.folder_id = mf.id
         WHERE mot.object_type_id = $1
         ORDER BY m.name`, [otId]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }
    // PUT /api/admin/object-types/:id/modules/:moduleId — update flags
    const otModItemMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/modules\/(\d+)$/);
    if (otModItemMatch && req.method === 'PUT') {
      const [, otId, modId] = otModItemMatch;
      const body = await readBody();
      const r = await client.query(
        `UPDATE samrum_module_object_types
         SET allow_edit=$1, show_as_root=$2, allow_insert=$3, is_main_object_type=$4
         WHERE object_type_id=$5 AND module_id=$6 RETURNING *`,
        [body.allow_edit ?? true, body.show_as_root ?? false,
         body.allow_insert ?? true, body.is_main_object_type ?? false,
         parseInt(otId), parseInt(modId)]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows[0] || null }));
      return;
    }

    // ─── B012: Object Type Attributes CRUD (via samrum_relationships) ────────────
    const otAttrMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/attributes$/);
    if (otAttrMatch && req.method === 'GET') {
      const otId = otAttrMatch[1];
      // Complex types (references) have data_type_id IN (14,16); scalars have data_type_id 1-13
      const relR = await client.query(
        `WITH mot_agg AS (
           SELECT object_type_id,
             BOOL_OR(is_main_object_type) AS is_main_for_module,
             BOOL_OR(allow_edit)          AS is_changeable,
             BOOL_OR(allow_insert)        AS can_create
           FROM samrum_module_object_types
           GROUP BY object_type_id
         )
         SELECT r.*,
           CASE WHEN to_ot.data_type_id IN (14,16) THEN TRUE ELSE FALSE END AS is_reference,
           CASE WHEN to_ot.data_type_id IN (14,16) THEN to_ot.name_singular ELSE dt.name END AS type_name,
           CASE WHEN to_ot.data_type_id IN (14,16) THEN to_ot.id ELSE NULL END AS ref_type_id,
           CASE WHEN to_ot.data_type_id IN (14,16) THEN to_ot.name_singular ELSE NULL END AS ref_type_name,
           CASE WHEN to_ot.data_type_id NOT IN (14,16) THEN dt.name ELSE NULL END AS data_type_name,
           to_ot.name_singular AS to_type_name,
           COALESCE(mot.is_main_for_module, FALSE) AS is_main_for_module,
           COALESCE(mot.is_changeable, FALSE)      AS is_changeable,
           COALESCE(mot.can_create, FALSE)         AS can_create
         FROM samrum_relationships r
         JOIN samrum_object_types to_ot ON r.to_type_id = to_ot.id
         LEFT JOIN samrum_data_types dt ON to_ot.data_type_id = dt.id
         LEFT JOIN mot_agg mot ON mot.object_type_id = r.to_type_id
         WHERE r.from_type_id = $1
         ORDER BY r.sort_order NULLS LAST, r.caption_singular NULLS LAST`,
        [otId]);

      // For reference rows, fetch their scalar children
      const refTypeIds = [...new Set(
        relR.rows.filter(r => r.is_reference && r.ref_type_id).map(r => r.ref_type_id)
      )];
      const childrenMap = {};
      if (refTypeIds.length > 0) {
        const childR = await client.query(
          `SELECT r.*, FALSE AS is_reference,
             dt.name AS data_type_name, dt.name AS type_name,
             NULL::int AS ref_type_id, NULL AS ref_type_name
           FROM samrum_relationships r
           JOIN samrum_object_types to_ot ON r.to_type_id = to_ot.id
           JOIN samrum_data_types dt ON to_ot.data_type_id = dt.id
           WHERE r.from_type_id = ANY($1::int[])
             AND to_ot.data_type_id NOT IN (14, 16)
           ORDER BY r.from_type_id, r.sort_order NULLS LAST`,
          [refTypeIds]);
        for (const child of childR.rows) {
          if (!childrenMap[child.from_type_id]) childrenMap[child.from_type_id] = [];
          childrenMap[child.from_type_id].push(child);
        }
      }

      // Modules using this object type
      const modR = await client.query(
        `SELECT m.id AS module_id, m.name AS module_name, mot.allow_edit
         FROM samrum_module_object_types mot
         JOIN samrum_modules m ON mot.module_id = m.id
         WHERE mot.object_type_id = $1 ORDER BY m.name`,
        [otId]);
      const usedInModules = modR.rows;

      const enriched = relR.rows.map(r => ({
        ...r,
        used_in_modules: usedInModules,
        children: r.is_reference && r.ref_type_id ? (childrenMap[r.ref_type_id] || []) : undefined,
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: enriched }));
      return;
    }
    if (otAttrMatch && req.method === 'POST') {
      const otId = otAttrMatch[1];
      const body = await readBody();
      // to_type_id: data type id (1-16) OR another samrum_object_types id (for reference attrs)
      const r = await client.query(
        `INSERT INTO samrum_relationships
           (from_type_id, to_type_id, caption_singular, caption_plural,
            min_relations, max_relations, sort_order,
            allow_in_lists, show_in_lists_default, is_requirement,
            max_chars, copy_attribute, exists_only_in_parent, required_in_locked_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [parseInt(otId), parseInt(body.to_type_id),
         body.caption_singular || null, body.caption_plural || null,
         body.min_relations ?? 0, body.max_relations || null,
         body.sort_order ?? 0,
         body.allow_in_lists ?? true, body.show_in_lists_default ?? false,
         body.is_requirement ?? false,
         body.max_chars || null, body.copy_attribute ?? false,
         body.exists_only_in_parent ?? false, body.required_in_locked_version ?? false]);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      return;
    }
    const attrMatch = pathname.match(/^\/api\/admin\/object-types\/attributes\/(\d+)$/);
    if (attrMatch) {
      const attrId = attrMatch[1];
      if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_relationships SET
             caption_singular=$1, caption_plural=$2, to_type_id=$3,
             allow_in_lists=$4, show_in_lists_default=$5, is_requirement=$6,
             max_chars=$7, copy_attribute=$8, exists_only_in_parent=$9, required_in_locked_version=$10,
             min_relations=$11, max_relations=$12
           WHERE id=$13 RETURNING *`,
          [body.caption_singular || null, body.caption_plural || null,
           parseInt(body.to_type_id),
           body.allow_in_lists ?? true, body.show_in_lists_default ?? false, body.is_requirement ?? false,
           body.max_chars || null, body.copy_attribute ?? false,
           body.exists_only_in_parent ?? false, body.required_in_locked_version ?? false,
           body.min_relations ?? 0, body.max_relations || null,
           attrId]);
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
        return;
      }
      if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_relationships WHERE id=$1', [attrId]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    const attrReorderMatch = pathname.match(/^\/api\/admin\/object-types\/attributes\/(\d+)\/reorder$/);
    if (attrReorderMatch && req.method === 'PUT') {
      const relId = attrReorderMatch[1];
      const body = await readBody();
      const cur = await client.query(
        'SELECT sort_order, from_type_id FROM samrum_relationships WHERE id=$1', [relId]);
      if (!cur.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      const { sort_order, from_type_id } = cur.rows[0];
      let adjQ;
      if (body.direction === 'up') {
        adjQ = await client.query(
          `SELECT id, sort_order FROM samrum_relationships
           WHERE from_type_id=$1 AND (sort_order < $2 OR (sort_order = $2 AND id < $3))
           ORDER BY sort_order DESC, id DESC LIMIT 1`,
          [from_type_id, sort_order ?? 0, relId]);
      } else {
        adjQ = await client.query(
          `SELECT id, sort_order FROM samrum_relationships
           WHERE from_type_id=$1 AND (sort_order > $2 OR (sort_order = $2 AND id > $3))
           ORDER BY sort_order ASC, id ASC LIMIT 1`,
          [from_type_id, sort_order ?? 0, relId]);
      }
      if (adjQ.rows.length) {
        const adj = adjQ.rows[0];
        // Swap sort_order between the two samrum_relationships rows
        await client.query('UPDATE samrum_relationships SET sort_order=$1 WHERE id=$2', [adj.sort_order, relId]);
        await client.query('UPDATE samrum_relationships SET sort_order=$1 WHERE id=$2', [sort_order, adj.id]);
        // Keep module_view_columns.col_order in sync so object views reflect the new order
        await client.query('UPDATE module_view_columns SET col_order=$1 WHERE samrum_relationship_id=$2', [adj.sort_order, relId]);
        await client.query('UPDATE module_view_columns SET col_order=$1 WHERE samrum_relationship_id=$2', [sort_order, adj.id]);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }


    // ─── Admin: Module Folders ─────────────────────────────────────────────────
    if (pathname === '/api/admin/module-folders') {
      if (req.method === 'GET') {
        const r = await client.query('SELECT * FROM samrum_module_folders ORDER BY name');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          'INSERT INTO samrum_module_folders (parent_id, name, description) VALUES ($1,$2,$3) RETURNING *',
          [body.parent_id || null, body.name, body.description || null]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    if (pathname.match(/^\/api\/admin\/module-folders\/(\d+)$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          'UPDATE samrum_module_folders SET parent_id=$1, name=$2, description=$3 WHERE id=$4 RETURNING *',
          [body.parent_id || null, body.name, body.description || null, id]
        );
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_module_folders WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    // ─── Admin: Modules ────────────────────────────────────────────────────────
    if (pathname === '/api/admin/modules') {
      if (req.method === 'GET') {
        const offset = parseInt(parsedUrl.query.offset || '0');
        const r = await client.query(
          `SELECT m.*, f.name as folder_name FROM samrum_modules m
           LEFT JOIN samrum_module_folders f ON m.folder_id = f.id
           ORDER BY m.name LIMIT 50 OFFSET $1`, [offset]);
        const countR = await client.query('SELECT COUNT(*) FROM samrum_modules');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows, total: parseInt(countR.rows[0].count) }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          `INSERT INTO samrum_modules (name, description, allow_incomplete_versions, folder_id)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [body.name, body.description || null, body.allow_incomplete_versions || false, body.folder_id || null]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    const modMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)$/);
    if (modMatch) {
      const id = modMatch[1];
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT m.*, f.name as folder_name FROM samrum_modules m
           LEFT JOIN samrum_module_folders f ON m.folder_id = f.id WHERE m.id=$1`, [id]);
        if (!r.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_modules SET name=$1, description=$2, allow_incomplete_versions=$3, folder_id=$4 WHERE id=$5 RETURNING *`,
          [body.name, body.description || null, body.allow_incomplete_versions || false, body.folder_id || null, id]
        );
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_modules WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    const modOtMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/object-types$/);
    if (modOtMatch) {
      const modId = modOtMatch[1];
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT mot.*, ot.name_singular, ot.name_plural
           FROM samrum_module_object_types mot
           JOIN samrum_object_types ot ON mot.object_type_id = ot.id
           WHERE mot.module_id = $1 ORDER BY ot.name_singular`, [modId]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          `INSERT INTO samrum_module_object_types (module_id, object_type_id, allow_edit, show_as_root, allow_insert, is_main_object_type)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [modId, body.object_type_id, body.allow_edit !== false, body.show_as_root || false,
            body.allow_insert !== false, body.is_main_object_type || false]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    // GET /api/admin/modules/:id/columns — lightweight: module info + column defs only (no instance pivot)
    const modColsMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/columns$/);
    if (modColsMatch && req.method === 'GET') {
      const modId = modColsMatch[1];
      const modR = await client.query(
        `SELECT m.id, m.name, m.description, f.name as folder_name,
                ot.id as oms_ot_id, ot.name as oms_ot_name
         FROM samrum_modules m
         LEFT JOIN samrum_module_folders f ON f.id = m.folder_id
         LEFT JOIN object_types ot ON ot.id = m.oms_object_type_id
         WHERE m.id = $1`, [modId]);
      if (!modR.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      const mod = modR.rows[0];

      const mvcR = await client.query(
        `SELECT mvc.column_key AS key, mvc.label, mvc.col_type AS type,
                mvc.col_order, mvc.is_required, mvc.is_editable,
                mvc.oms_attribute_id, oa.enum_values
         FROM module_view_columns mvc
         LEFT JOIN object_attributes oa ON oa.id = mvc.oms_attribute_id
         WHERE mvc.module_id = $1
         ORDER BY mvc.col_order, mvc.id`, [modId]);

      let columns = mvcR.rows;
      if (columns.length === 0 && mod.oms_ot_id) {
        const fbR = await client.query(
          `SELECT attribute_name AS key, attribute_name AS label, attribute_type AS type,
                  0 AS col_order, is_required, TRUE AS is_editable, id AS oms_attribute_id, enum_values
           FROM object_attributes WHERE object_type_id = $1 ORDER BY id`, [mod.oms_ot_id]);
        columns = fbR.rows;
      }

      const mapType = (t) => t || 'text';
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        module: { id: mod.id, name: mod.name, description: mod.description, folder_name: mod.folder_name },
        oms_object_type: { id: mod.oms_ot_id, name: mod.oms_ot_name },
        id_column_label: getIdColumnLabel(mod.oms_ot_name),
        columns: columns.map(c => ({
          key: c.key, label: c.label || c.key, type: mapType(c.type),
          col_order: c.col_order, is_required: c.is_required || false,
          is_editable: c.is_editable !== false,
          oms_attribute_id: c.oms_attribute_id ? Number(c.oms_attribute_id) : null,
          enum_values: c.enum_values || null,
        })),
      }));
      return;
    }

    // POST /api/admin/modules/:id/import — batch CSV import
    const modImportMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/import$/);
    if (modImportMatch) {
      const modId = parseInt(modImportMatch[1]);
      if (req.method === 'POST') {
        const modR = await client.query(
          `SELECT oms_object_type_id FROM samrum_modules WHERE id = $1`, [modId]);
        if (!modR.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        const omsTypeId = modR.rows[0].oms_object_type_id;
        if (!omsTypeId) { res.writeHead(400); res.end(JSON.stringify({ error: 'Module has no OMS object type' })); return; }

        const body = await readBody();
        const rows = Array.isArray(body.rows) ? body.rows : [];
        let imported = 0, skipped = 0;
        const errors = [];

        for (const row of rows) {
          try {
            const instR = await client.query(
              `INSERT INTO object_instances (external_id, name, object_type_id, is_active)
               VALUES ($1, $2, $3, TRUE)
               ON CONFLICT (external_id, object_type_id) DO NOTHING
               RETURNING id`,
              [row.external_id, row.name || null, omsTypeId]);
            if (instR.rows.length === 0) { skipped++; continue; }
            const instanceId = instR.rows[0].id;
            if (row.attribute_values_by_id && typeof row.attribute_values_by_id === 'object') {
              for (const [attrId, value] of Object.entries(row.attribute_values_by_id)) {
                if (value === undefined || value === null || value === '') continue;
                await client.query(
                  `INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (object_instance_id, object_attribute_id) DO UPDATE SET value = $3, updated_at = NOW()`,
                  [instanceId, parseInt(attrId), String(value)]);
              }
            }
            imported++;
          } catch (e) {
            errors.push({ row: row.external_id, error: e.message });
          }
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, imported, skipped, errors }));
      } else if (req.method === 'GET') {
        // GET /api/admin/modules/:id/import/template handled separately below
        res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      return;
    }

    // GET /api/admin/modules/:id/import/template — CSV template download
    const modImportTplMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/import\/template$/);
    if (modImportTplMatch && req.method === 'GET') {
      const modId = modImportTplMatch[1];
      const mvcR = await client.query(
        `SELECT column_key, label FROM module_view_columns WHERE module_id = $1 ORDER BY col_order, id`,
        [modId]);
      const cols = mvcR.rows;
      const headerKeys = ['external_id', 'name', ...cols.map(c => c.column_key)];
      const headerLabels = ['ID', 'Namn', ...cols.map(c => c.label || c.column_key)];
      const csv = headerLabels.join(',') + '\r\n' + headerKeys.join(',') + '\r\n';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="import-template.csv"');
      res.writeHead(200);
      res.end(csv);
      return;
    }

    // GET /api/admin/modules/:id/export — CSV export of all instances with attribute values
    const modExportMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/export$/);
    if (modExportMatch && req.method === 'GET') {
      const modId = modExportMatch[1];
      const modR = await client.query(
        `SELECT m.name, ot.id as oms_ot_id FROM samrum_modules m
         LEFT JOIN object_types ot ON ot.id = m.oms_object_type_id WHERE m.id = $1`, [modId]);
      if (!modR.rows.length) { res.writeHead(404); res.end('Not found'); return; }
      const mod = modR.rows[0];

      const mvcR = await client.query(
        `SELECT mvc.column_key, mvc.label, mvc.oms_attribute_id
         FROM module_view_columns mvc WHERE mvc.module_id = $1 ORDER BY mvc.col_order, mvc.id`, [modId]);
      const cols = mvcR.rows;

      const instR = await client.query(
        `SELECT oi.id, oi.external_id, oi.name, oi.is_active
         FROM object_instances oi WHERE oi.object_type_id = $1 ORDER BY oi.external_id`, [mod.oms_ot_id]);
      const instances = instR.rows;

      const attrIds = cols.filter(c => c.oms_attribute_id).map(c => Number(c.oms_attribute_id));
      let valMap = {};
      if (attrIds.length > 0 && instances.length > 0) {
        const vR = await client.query(
          `SELECT object_instance_id, object_attribute_id, value FROM attribute_values
           WHERE object_instance_id = ANY($1) AND object_attribute_id = ANY($2)`,
          [instances.map(i => i.id), attrIds]);
        for (const v of vR.rows) {
          if (!valMap[v.object_instance_id]) valMap[v.object_instance_id] = {};
          valMap[v.object_instance_id][v.object_attribute_id] = v.value;
        }
      }

      const escCsv = (v) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const headerLabels = ['ID', 'Namn', 'Aktivt', ...cols.map(c => c.label || c.column_key)];
      const rows = instances.map(inst => {
        const vals = [inst.external_id, inst.name || '', inst.is_active ? 'Ja' : 'Nej',
          ...cols.map(c => c.oms_attribute_id ? (valMap[inst.id]?.[c.oms_attribute_id] ?? '') : '')];
        return vals.map(escCsv).join(',');
      });

      const modName = mod.name.replace(/[^a-zA-Z0-9\-_åäöÅÄÖ ]/g, '').substring(0, 40).trim().replace(/ /g, '_');
      const csv = headerLabels.map(escCsv).join(',') + '\r\n' + rows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${modName}-export.csv"`);
      res.writeHead(200);
      res.end(csv);
      return;
    }

    // --- Module instances (dynamic column pivot) ---
    const modInstMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/instances$/);
    if (modInstMatch && req.method === 'GET') {
      const modId = modInstMatch[1];

      // 1. Load module + its OMS object type
      const modR = await client.query(
        `SELECT m.*, f.name as folder_name, ot.id as oms_ot_id, ot.name as oms_ot_name
         FROM samrum_modules m
         LEFT JOIN samrum_module_folders f ON f.id = m.folder_id
         LEFT JOIN object_types ot ON ot.id = m.oms_object_type_id
         WHERE m.id = $1`, [modId]);
      if (!modR.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      const mod = modR.rows[0];

      // 2. Load per-module column definitions from module_view_columns.
      //    Each module has its own ordered column list sourced from samrum_module_relationships.
      //    Columns with oms_attribute_id have live data from attribute_values.
      const mvcR = await client.query(
        `SELECT mvc.id, mvc.column_key, mvc.label, mvc.col_order, mvc.col_type,
                mvc.is_editable, mvc.is_required, mvc.show_by_default,
                mvc.oms_attribute_id,
                oa.is_key, oa.enum_values
         FROM module_view_columns mvc
         LEFT JOIN object_attributes oa ON oa.id = mvc.oms_attribute_id
         WHERE mvc.module_id = $1
         ORDER BY mvc.col_order, mvc.id`, [modId]);

      // Fallback: if no module_view_columns exist, use all OMS object_attributes
      let moduleColumns = mvcR.rows;
      if (moduleColumns.length === 0 && mod.oms_ot_id) {
        const fbR = await client.query(
          `SELECT id AS oms_attribute_id, attribute_name AS column_key,
                  attribute_name AS label, attribute_type AS col_type,
                  is_required, is_key, enum_values,
                  TRUE AS show_by_default, TRUE AS is_editable
           FROM object_attributes WHERE object_type_id = $1 ORDER BY id`, [mod.oms_ot_id]);
        moduleColumns = fbR.rows;
      }

      // Map type to frontend-compatible values
      const mapType = (t) => {
        if (t === 'reference') return 'text';
        if (t === 'file') return 'text';
        return t || 'text';
      };

      // 2b. Load related OMS object types (structural column groups, always shown for OMS types)
      const relatedGroups = [];
      if (mod.oms_ot_id) {
        const relTypesR = await client.query(
          `SELECT r.child_object_type_id AS type_id, ot.name AS type_name,
                  r.relationship_name, r.cardinality
           FROM object_relationships r
           JOIN object_types ot ON ot.id = r.child_object_type_id
           WHERE r.parent_object_type_id = $1
           ORDER BY r.id`, [mod.oms_ot_id]);

        for (const rel of relTypesR.rows) {
          const snakeName = rel.type_name.toLowerCase().replace(/\s+/g, '_');
          const relAttrsR = await client.query(
            `SELECT id, attribute_name, attribute_type, is_required, is_key, enum_values
             FROM object_attributes WHERE object_type_id = $1 ORDER BY id`, [rel.type_id]);
          relatedGroups.push({
            key: `rel_${rel.type_id}`,
            type_id: rel.type_id,
            type_name: rel.type_name,
            relationship_name: rel.relationship_name,
            cardinality: rel.cardinality,
            columns: relAttrsR.rows.map(a => ({
              key: `${snakeName}__${a.attribute_name}`,
              label: a.attribute_name,
              type: a.attribute_type,
              is_required: a.is_required,
              is_key: a.is_key,
              enum_values: a.enum_values,
            })),
          });
        }
      }

      // 3. Load all instances of this OMS object type
      const instsR = await client.query(
        `SELECT id, external_id, name, created_at, updated_at
         FROM object_instances WHERE object_type_id = $1 ORDER BY external_id`, [mod.oms_ot_id]);
      const instances = instsR.rows;

      // 4. Load attribute values only for columns that have an OMS attribute mapping
      let attrValues = [];
      const mappedAttrIds = [...new Set(
        moduleColumns.filter(c => c.oms_attribute_id).map(c => Number(c.oms_attribute_id))
      )];
      if (instances.length > 0 && mappedAttrIds.length > 0) {
        const instIds = instances.map(i => i.id);
        const avR = await client.query(
          `SELECT object_instance_id, object_attribute_id, value
           FROM attribute_values
           WHERE object_instance_id = ANY($1::int[])
             AND object_attribute_id = ANY($2::int[])`, [instIds, mappedAttrIds]);
        attrValues = avR.rows;
      }

      // 5. Pivot: instanceId → { attrId: value }
      const pivot = {};
      attrValues.forEach(av => {
        if (!pivot[av.object_instance_id]) pivot[av.object_instance_id] = {};
        pivot[av.object_instance_id][av.object_attribute_id] = av.value;
      });

      // 6. Build final rows — each column gets its value from attribute_values if mapped,
      //    otherwise null (data not yet stored in OMS for this samrum-derived column)
      const rows = instances.map(inst => {
        const row = {
          _id: inst.id,
          _external_id: inst.external_id,
          _name: inst.name,
          _created_at: inst.created_at,
          _updated_at: inst.updated_at,
        };
        moduleColumns.forEach(col => {
          row[col.column_key] = col.oms_attribute_id
            ? (pivot[inst.id]?.[col.oms_attribute_id] ?? null)
            : null;
        });
        return row;
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        module: {
          id: mod.id, name: mod.name, description: mod.description,
          folder_name: mod.folder_name, allow_incomplete_versions: mod.allow_incomplete_versions,
          created_at: mod.created_at, created_by: mod.created_by,
          changed_at: mod.changed_at, changed_by: mod.changed_by,
          oms_object_type: { id: mod.oms_ot_id, name: mod.oms_ot_name },
          id_column_label: getIdColumnLabel(mod.oms_ot_name),
        },
        columns: moduleColumns.map(c => ({
          key: c.column_key,
          label: c.label || c.column_key,
          type: mapType(c.col_type),
          is_required: c.is_required || false,
          is_key: c.is_key || false,
          enum_values: c.enum_values || null,
          show_by_default: c.show_by_default || false,
          is_editable: c.is_editable !== false,
        })),
        related_groups: relatedGroups,
        data: rows,
        total: rows.length,
      }));
      return;
    }

    const modOtDelMatch = pathname.match(/^\/api\/admin\/modules\/(\d+)\/object-types\/(\d+)$/);
    if (modOtDelMatch && req.method === 'DELETE') {
      const [, modId, otId] = modOtDelMatch;
      await client.query('DELETE FROM samrum_module_object_types WHERE module_id=$1 AND object_type_id=$2', [modId, otId]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ─── Admin: Relationships ──────────────────────────────────────────────────
    if (pathname === '/api/admin/relationships') {
      if (req.method === 'GET') {
        const offset = parseInt(parsedUrl.query.offset || '0');
        const r = await client.query(
          `SELECT r.*, ot_from.name_singular as from_name, ot_to.name_singular as to_name
           FROM samrum_relationships r
           LEFT JOIN samrum_object_types ot_from ON r.from_type_id = ot_from.id
           LEFT JOIN samrum_object_types ot_to ON r.to_type_id = ot_to.id
           ORDER BY r.caption_singular LIMIT 100 OFFSET $1`, [offset]);
        const countR = await client.query('SELECT COUNT(*) FROM samrum_relationships');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows, total: parseInt(countR.rows[0].count) }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(
          `INSERT INTO samrum_relationships
           (caption_singular, caption_plural, from_type_id, to_type_id, min_relations, max_relations,
            sort_order, allow_in_lists, show_in_lists_default, is_requirement, sys_caption)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [body.caption_singular, body.caption_plural || null, body.from_type_id || null,
          body.to_type_id || null, body.min_relations || 0, body.max_relations || null,
          body.sort_order || 0, body.allow_in_lists !== false, body.show_in_lists_default || false,
          body.is_requirement || false, body.sys_caption || null]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }
    const relMatch = pathname.match(/^\/api\/admin\/relationships\/(\d+)$/);
    if (relMatch) {
      const id = relMatch[1];
      if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_relationships SET
           caption_singular=$1, caption_plural=$2, from_type_id=$3, to_type_id=$4,
           min_relations=$5, max_relations=$6, sort_order=$7, allow_in_lists=$8,
           show_in_lists_default=$9, is_requirement=$10, sys_caption=$11
           WHERE id=$12 RETURNING *`,
          [body.caption_singular, body.caption_plural || null, body.from_type_id || null,
          body.to_type_id || null, body.min_relations || 0, body.max_relations || null,
          body.sort_order || 0, body.allow_in_lists !== false, body.show_in_lists_default || false,
          body.is_requirement || false, body.sys_caption || null, id]
        );
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_relationships WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    // ─── Admin: Stats ──────────────────────────────────────────────────────────
    if (pathname === '/api/admin/stats' && req.method === 'GET') {
      const [st, dt, cl, ot, mf, m, r, mot, mr] = await Promise.all([
        client.query('SELECT COUNT(*) FROM samrum_storage_types'),
        client.query('SELECT COUNT(*) FROM samrum_data_types'),
        client.query('SELECT COUNT(*) FROM samrum_classifications'),
        client.query('SELECT COUNT(*) FROM samrum_object_types'),
        client.query('SELECT COUNT(*) FROM samrum_module_folders'),
        client.query('SELECT COUNT(*) FROM samrum_modules'),
        client.query('SELECT COUNT(*) FROM samrum_relationships'),
        client.query('SELECT COUNT(*) FROM samrum_module_object_types'),
        client.query('SELECT COUNT(*) FROM samrum_module_relationships'),
      ]);
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        stats: {
          storage_types: parseInt(st.rows[0].count),
          data_types: parseInt(dt.rows[0].count),
          classifications: parseInt(cl.rows[0].count),
          object_types: parseInt(ot.rows[0].count),
          module_folders: parseInt(mf.rows[0].count),
          modules: parseInt(m.rows[0].count),
          relationships: parseInt(r.rows[0].count),
          module_object_types: parseInt(mot.rows[0].count),
          module_relationships: parseInt(mr.rows[0].count),
        }
      }));
      return;
    }

    // ─── Admin: Projects ───────────────────────────────────────────────────────
    if (pathname === '/api/admin/projects') {
      if (req.method === 'GET') {
        const search = parsedUrl.query.search || '';
        const query = search
          ? `SELECT p.*, COUNT(pm.module_id) as module_count
             FROM samrum_projects p
             LEFT JOIN samrum_project_modules pm ON pm.project_id = p.id AND pm.is_enabled = true
             WHERE p.name ILIKE $1 GROUP BY p.id ORDER BY p.name`
          : `SELECT p.*, COUNT(pm.module_id) as module_count
             FROM samrum_projects p
             LEFT JOIN samrum_project_modules pm ON pm.project_id = p.id AND pm.is_enabled = true
             GROUP BY p.id ORDER BY p.name`;
        const r = await client.query(query, search ? [`%${search}%`] : []);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows, total: r.rows.length }));
      } else if (req.method === 'POST') {
        const body = await readBody();
        // Create project
        const r = await client.query(
          `INSERT INTO samrum_projects (name, database_name, description, created_by)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [body.name, body.database_name || null, body.description || null, body.created_by || 'admin']
        );
        const project = r.rows[0];
        // Auto-assign all modules (Option A)
        await client.query(
          `INSERT INTO samrum_project_modules (project_id, module_id)
           SELECT $1, id FROM samrum_modules ON CONFLICT DO NOTHING`,
          [project.id]
        );
        const mc = await client.query(
          'SELECT COUNT(*) FROM samrum_project_modules WHERE project_id=$1', [project.id]
        );
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: { ...project, module_count: parseInt(mc.rows[0].count) } }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    const projectMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)$/);
    if (projectMatch) {
      const id = parseInt(projectMatch[1]);
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT p.*, COUNT(pm.module_id) as module_count
           FROM samrum_projects p
           LEFT JOIN samrum_project_modules pm ON pm.project_id = p.id AND pm.is_enabled = true
           WHERE p.id = $1 GROUP BY p.id`, [id]
        );
        if (!r.rows[0]) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_projects SET name=$1, database_name=$2, description=$3, is_active=$4, updated_at=NOW()
           WHERE id=$5 RETURNING *`,
          [body.name, body.database_name || null, body.description || null, body.is_active !== false, id]
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else if (req.method === 'DELETE') {
        await client.query('DELETE FROM samrum_projects WHERE id=$1', [id]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    // ─── Project Modules (modules for a specific project) ─────────────────────
    const projectModulesMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)\/modules$/);
    if (projectModulesMatch) {
      const projectId = parseInt(projectModulesMatch[1]);
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT m.*, mf.name as folder_name, pm.is_enabled
           FROM samrum_project_modules pm
           JOIN samrum_modules m ON m.id = pm.module_id
           LEFT JOIN samrum_module_folders mf ON mf.id = m.folder_id
           WHERE pm.project_id = $1
           ORDER BY mf.name NULLS LAST, m.name`, [projectId]
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows, total: r.rows.length }));
      } else if (req.method === 'POST') {
        // Toggle module: { module_id, is_enabled }
        const body = await readBody();
        const r = await client.query(
          `INSERT INTO samrum_project_modules (project_id, module_id, is_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_id, module_id) DO UPDATE SET is_enabled=$3
           RETURNING *`,
          [projectId, body.module_id, body.is_enabled !== false]
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: r.rows[0] }));
      } else { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); }
      return;
    }

    // ─── Project Module Folders (tree for a specific project) ─────────────────
    const projectFoldersMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)\/module-tree$/);
    if (projectFoldersMatch) {
      const projectId = parseInt(projectFoldersMatch[1]);
      const r = await client.query(
        `SELECT mf.*, COUNT(pm.module_id) as module_count
         FROM samrum_module_folders mf
         LEFT JOIN samrum_modules m ON m.folder_id = mf.id
         LEFT JOIN samrum_project_modules pm ON pm.module_id = m.id
           AND pm.project_id = $1 AND pm.is_enabled = true
         GROUP BY mf.id ORDER BY mf.name`, [projectId]
      );
      const modules = await client.query(
        `SELECT m.*, pm.is_enabled
         FROM samrum_modules m
         JOIN samrum_project_modules pm ON pm.module_id = m.id
         WHERE pm.project_id = $1 AND pm.is_enabled = true
         ORDER BY m.name`, [projectId]
      );
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, folders: r.rows, modules: modules.rows }));
      return;
    }


    // ─── B000: User Administration ──────────────────────────────────────────────
    if (pathname === '/api/admin/users') {
      if (req.method === 'GET') {
        const r = await client.query(`SELECT id, username, email, created_at FROM samrum_users ORDER BY username`);
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows, total: r.rows.length })); return;
      }
      if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(`INSERT INTO samrum_users (username, email) VALUES ($1,$2) RETURNING id,username,email,created_at`, [body.username, body.email || null]);
        res.writeHead(201); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
      }
    }
    const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userMatch) {
      const uid = parseInt(userMatch[1]);
      if (req.method === 'GET') {
        const r = await client.query(`SELECT id,username,email,created_at FROM samrum_users WHERE id=$1`, [uid]);
        if (!r.rows[0]) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
      }
      if (req.method === 'PUT') {
        const body = await readBody();
        await client.query(`UPDATE samrum_users SET username=$1, email=$2 WHERE id=$3`, [body.username, body.email, uid]);
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
      if (req.method === 'DELETE') {
        await client.query(`DELETE FROM samrum_users WHERE id=$1`, [uid]);
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
    }
    const userRolesMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/roles$/);
    if (userRolesMatch) {
      const uid = parseInt(userRolesMatch[1]);
      if (req.method === 'GET') {
        const r = await client.query(`SELECT role FROM samrum_user_roles WHERE user_id=$1`, [uid]);
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: { global_security_admin: true } })); return;
      }
      if (req.method === 'PUT') {
        const body = await readBody();
        await client.query(`DELETE FROM samrum_user_roles WHERE user_id=$1`, [uid]);
        if (body.global_security_admin) {
          await client.query(`INSERT INTO samrum_user_roles (user_id, role) VALUES ($1,'global_security_admin')`, [uid]);
        }
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
    }
    const userProjectsMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/projects$/);
    if (userProjectsMatch) {
      const uid = parseInt(userProjectsMatch[1]);
      if (req.method === 'GET') {
        const projects = await client.query(`SELECT id, name FROM samrum_projects ORDER BY name`);
        const access = await client.query(`SELECT project_id FROM samrum_user_projects WHERE user_id=$1`, [uid]);
        const accessIds = new Set(access.rows.map(r => r.project_id));
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: projects.rows.map(p => ({ ...p, has_access: accessIds.has(p.id) })) })); return;
      }
      if (req.method === 'PUT') {
        const body = await readBody();
        await client.query(`DELETE FROM samrum_user_projects WHERE user_id=$1`, [uid]);
        for (const pid of (body.project_ids || [])) {
          await client.query(`INSERT INTO samrum_user_projects (user_id, project_id) VALUES ($1,$2)`, [uid, pid]);
        }
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
    }
    const userPwdMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
    if (userPwdMatch && req.method === 'POST') {
      res.writeHead(200); res.end(JSON.stringify({ success: true, message: 'Nytt lösenord har skickats till användaren.' })); return;
    }

    // B014 — Import/Export ID Sets
    if (pathname === '/api/admin/import-export/id-sets') {
      if (req.method === 'GET') {
        const r = await client.query(`SELECT id, name, data_type, created_at FROM samrum_import_id_sets ORDER BY name`);
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows })); return;
      }
      if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(`INSERT INTO samrum_import_id_sets (name, data_type) VALUES ($1,$2) RETURNING id,name,data_type,created_at`, [body.name, body.data_type || 'IFCGlobalId']);
        res.writeHead(201); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
      }
    }
    const idSetMatch = pathname.match(/^\/api\/admin\/import-export\/id-sets\/(\d+)$/);
    if (idSetMatch && req.method === 'DELETE') {
      await client.query(`DELETE FROM samrum_import_id_sets WHERE id=$1`, [parseInt(idSetMatch[1])]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }

    // B014 — Import/Export Definitions
    if (pathname === '/api/admin/import-export/definitions') {
      if (req.method === 'GET') {
        const r = await client.query(`SELECT id, name, type, created_at FROM samrum_import_definitions ORDER BY name`);
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows })); return;
      }
      if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(`INSERT INTO samrum_import_definitions (name, type) VALUES ($1,$2) RETURNING id,name,type,created_at`, [body.name, body.type || 'IFC']);
        res.writeHead(201); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
      }
    }
    const defMatch = pathname.match(/^\/api\/admin\/import-export\/definitions\/(\d+)$/);
    if (defMatch) {
      const defId = parseInt(defMatch[1]);
      if (req.method === 'GET') {
        const r = await client.query(
          `SELECT d.*, ids.name as id_set_name FROM samrum_import_definitions d
           LEFT JOIN samrum_import_id_sets ids ON d.id_set_id = ids.id
           WHERE d.id = $1`, [defId]);
        if (!r.rows.length) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
        const entities = await client.query(
          `SELECT * FROM samrum_import_definition_entities WHERE definition_id=$1 ORDER BY id`, [defId]);
        const mods = await client.query(
          `SELECT dm.*, m.name as module_name FROM samrum_import_definition_modules dm
           JOIN samrum_modules m ON dm.module_id = m.id WHERE dm.definition_id=$1 ORDER BY m.name`, [defId]);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { ...r.rows[0], entities: entities.rows, module_rights: mods.rows } }));
        return;
      }
      if (req.method === 'PUT') {
        const body = await readBody();
        const r = await client.query(
          `UPDATE samrum_import_definitions SET name=$1, type=$2, id_set_id=$3, import_engine=$4, export_engine=$5, description=$6
           WHERE id=$7 RETURNING *`,
          [body.name, body.type || 'IFC', body.id_set_id || null, body.import_engine || null, body.export_engine || null, body.description || null, defId]);
        res.writeHead(r.rows.length ? 200 : 404);
        res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
        return;
      }
      if (req.method === 'DELETE') {
        await client.query(`DELETE FROM samrum_import_definitions WHERE id=$1`, [defId]);
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
    }
    // Definition entities
    const defEntMatch = pathname.match(/^\/api\/admin\/import-export\/definitions\/(\d+)\/entities$/);
    if (defEntMatch) {
      const defId = parseInt(defEntMatch[1]);
      if (req.method === 'POST') {
        const body = await readBody();
        // Lookup object type name if object_type_id provided
        let otName = body.object_type_name || null;
        if (body.object_type_id && !otName) {
          const ot = await client.query(`SELECT name_singular FROM samrum_object_types WHERE id=$1`, [body.object_type_id]);
          otName = ot.rows[0]?.name_singular || null;
        }
        const r = await client.query(
          `INSERT INTO samrum_import_definition_entities (definition_id, entity_type, object_type_id, object_type_name)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [defId, body.entity_type, body.object_type_id || null, otName]);
        res.writeHead(201); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
      }
    }
    const defEntItemMatch = pathname.match(/^\/api\/admin\/import-export\/definitions\/(\d+)\/entities\/(\d+)$/);
    if (defEntItemMatch && req.method === 'DELETE') {
      await client.query(`DELETE FROM samrum_import_definition_entities WHERE id=$1 AND definition_id=$2`,
        [parseInt(defEntItemMatch[2]), parseInt(defEntItemMatch[1])]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }
    // Definition module rights
    const defModMatch = pathname.match(/^\/api\/admin\/import-export\/definitions\/(\d+)\/modules$/);
    if (defModMatch && req.method === 'POST') {
      const body = await readBody();
      const defId = parseInt(defModMatch[1]);
      const r = await client.query(
        `INSERT INTO samrum_import_definition_modules (definition_id, module_id, allow_import, allow_export)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (definition_id, module_id) DO UPDATE SET allow_import=$3, allow_export=$4 RETURNING *`,
        [defId, body.module_id, body.allow_import !== false, body.allow_export !== false]);
      res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows[0] })); return;
    }
    const defModItemMatch = pathname.match(/^\/api\/admin\/import-export\/definitions\/(\d+)\/modules\/(\d+)$/);
    if (defModItemMatch && req.method === 'DELETE') {
      await client.query(`DELETE FROM samrum_import_definition_modules WHERE id=$1 AND definition_id=$2`,
        [parseInt(defModItemMatch[2]), parseInt(defModItemMatch[1])]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }

    // ─── IFC / BIM Sync ───────────────────────────────────────────────────────
    if (pathname === '/api/admin/import-export/ifc/sync' && req.method === 'POST') {
      const body = await readBody();
      const doors = body.doors || [];
      let synced = 0;

      // Get the "Door" object type ID (fallback to ID 1 if name lookup fails)
      const typeRes = await client.query(`SELECT id FROM object_types WHERE name = 'Door' LIMIT 1`);
      const objectTypeId = typeRes.rows[0]?.id ?? 1;

      if (doors.length > 0) {
        await client.query('BEGIN');
        try {
          for (const door of doors) {
            // Upsert by (object_type_id, external_id) unique constraint
            await client.query(`
              INSERT INTO object_instances (external_id, name, object_type_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (object_type_id, external_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
            `, [door.door_id, door.name, objectTypeId]);
            synced++;
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: `${synced} dörrar synkroniserade till OMS.`,
        synced
      }));
      return;
    }

    // ─── Analysis: Incomplete Objects (A006/A007) ────────────────────────────
    if (pathname === '/api/admin/analysis/incomplete' && req.method === 'GET') {
      const r = await client.query(`
        SELECT 
          oi.id, 
          oi.external_id, 
          oi.name as instance_name, 
          ot.name as object_type,
          json_agg(json_build_object(
            'id', oa.id,
            'name', oa.attribute_name
          )) as missing_attributes
        FROM object_instances oi
        JOIN object_types ot ON oi.object_type_id = ot.id
        JOIN object_attributes oa ON ot.id = oa.object_type_id
        LEFT JOIN attribute_values av ON oi.id = av.object_instance_id AND oa.id = av.object_attribute_id
        WHERE oa.is_required = true
        AND (av.value IS NULL OR av.value = '')
        GROUP BY oi.id, oi.external_id, oi.name, ot.name
        ORDER BY oi.id
      `);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: r.rows }));
      return;
    }

    // ─── Analysis: Validation Errors (A007) ──────────────────────────────────
    if (pathname === '/api/admin/analysis/validation' && req.method === 'GET') {
      // 1. Missing required attributes
      const missingR = await client.query(`
        SELECT oi.id as instance_id, oi.external_id, oi.name as instance_name,
               ot.name as object_type, oa.attribute_name as attribute,
               'Obligatoriskt attribut saknar värde' as description,
               'required_attribute' as error_type
        FROM object_instances oi
        JOIN object_types ot ON oi.object_type_id = ot.id
        JOIN object_attributes oa ON ot.id = oa.object_type_id
        LEFT JOIN attribute_values av ON oi.id = av.object_instance_id AND oa.id = av.object_attribute_id
        WHERE oa.is_required = true AND (av.value IS NULL OR av.value = '')
        ORDER BY ot.name, oi.external_id, oa.attribute_name
        LIMIT 200
      `);

      // 2. Missing required relationships (0:N or 1:1 where no children exist)
      const relR = await client.query(`
        SELECT oi.id as instance_id, oi.external_id, oi.name as instance_name,
               ot.name as object_type,
               ot2.name as attribute,
               CONCAT('Inga kopplade ', ot2.name, '-objekt (relation krävs: ', or2.cardinality, ')') as description,
               'required_relationship' as error_type
        FROM object_instances oi
        JOIN object_types ot ON oi.object_type_id = ot.id
        JOIN object_relationships or2 ON or2.parent_object_type_id = ot.id
        JOIN object_types ot2 ON ot2.id = or2.child_object_type_id
        WHERE or2.cardinality IN ('1:1', '1:N')
        AND NOT EXISTS (
          SELECT 1 FROM object_instance_relationships oir
          WHERE oir.parent_instance_id = oi.id AND oir.relationship_id = or2.id
        )
        ORDER BY ot.name, oi.external_id
        LIMIT 100
      `);

      const errors = [...missingR.rows, ...relR.rows].sort((a, b) =>
        (a.object_type || '').localeCompare(b.object_type || '') ||
        (a.external_id || '').localeCompare(b.external_id || ''));

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: errors }));
      return;
    }

    // ─── View Settings (in-memory store, keyed by module_id) ──────────────────

    const viewMatch = pathname.match(/^\/api\/admin\/views\/(\d+)$/);
    if (viewMatch) {
      const modId = parseInt(viewMatch[1]);
      if (req.method === 'GET') {
        const saved = viewSettings[modId] || null;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: saved }));
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody();
        viewSettings[modId] = body;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.method === 'DELETE') {
        delete viewSettings[modId];
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }
    }

    // ─── Reports: Spec Sheet (HTML for printing) ───────────────────────────────
    if (pathname === '/api/admin/reports/spec-sheet' && req.method === 'GET') {
      const idsParam = parsedUrl.query.ids;
      const ids = idsParam ? String(idsParam).split(',').map(Number).filter(Boolean) : [];

      if (ids.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ids query parameter is required' }));
        return;
      }

      // Fetch all instances with attributes
      const rows = [];
      for (const id of ids) {
        const r = await client.query(`
          SELECT oi.id, oi.external_id, oi.name, ot.name as object_type,
            json_agg(json_build_object(
              'name', oa.attribute_name,
              'value', av.value,
              'type', oa.attribute_type
            ) ORDER BY oa.attribute_name) FILTER (WHERE oa.id IS NOT NULL) as attributes
          FROM object_instances oi
          JOIN object_types ot ON oi.object_type_id = ot.id
          LEFT JOIN attribute_values av ON oi.id = av.object_instance_id
          LEFT JOIN object_attributes oa ON av.object_attribute_id = oa.id
          WHERE oi.id = $1
          GROUP BY oi.id, oi.external_id, oi.name, ot.name
        `, [id]);
        if (r.rows[0]) rows.push(r.rows[0]);
      }

      const attrLabel = (name) => name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>Dörrkort – Samrum</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #222; background: #fff; }
  .page { padding: 20mm 15mm; }
  .header { border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; color: #1d4ed8; }
  .header .logo { font-size: 22px; font-weight: 900; color: #1d4ed8; letter-spacing: -1px; }
  .door-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
  .door-card-header { background: #1d4ed8; color: #fff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
  .door-card-header h2 { font-size: 14px; font-weight: 700; }
  .door-card-header .ext-id { font-size: 12px; opacity: 0.8; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 99px; }
  .attrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; }
  .attr { padding: 6px 14px; border-bottom: 1px solid #f1f5f9; }
  .attr:nth-child(3n+1), .attr:nth-child(3n+2) { border-right: 1px solid #f1f5f9; }
  .attr-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 2px; }
  .attr-value { font-size: 11px; font-weight: 600; color: #1e293b; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: right; color: #94a3b8; font-size: 9px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">SAMRUM</div>
    <div>
      <h1>Dörrspecifikation</h1>
      <div style="font-size:10px;color:#64748b;margin-top:2px;">Genererad: ${new Date().toLocaleString('sv-SE')} · ${rows.length} dörr(ar)</div>
    </div>
  </div>
  <div class="no-print" style="margin-bottom:16px;padding:10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:12px;color:#0369a1;">
    Tryck Ctrl+P (eller Cmd+P) för att skriva ut eller spara som PDF
  </div>

  ${rows.map(door => {
        const attrs = door.attributes || [];
        return `
    <div class="door-card">
      <div class="door-card-header">
        <h2>${door.name || '—'}</h2>
        <span class="ext-id">${door.external_id || ''}</span>
      </div>
      <div class="attrs">
        ${attrs.map(a => `
          <div class="attr">
            <div class="attr-label">${attrLabel(a.name)}</div>
            <div class="attr-value">${a.value ?? '—'}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
      }).join('')}

  <div class="footer">Samrum Admin &copy; ${new Date().getFullYear()} · Utskrivet av system</div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(html);
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not Found',
      path: pathname,
      availableEndpoints: [
        'GET /health',
        'GET /api',
        'GET /api/objects/types',
        'GET /api/objects/instances',
        'GET /api/objects/instances/{id}',
        'GET /api/objects/attributes',
        'GET /api/stats'
      ]
    }));

  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║  🚀 Doorman API Demo Server Running!                 ║
║                                                        ║
║  API:       http://localhost:${PORT}                    ║
║  Database:  PostgreSQL doorman_db                     ║
║                                                        ║
║  Try these:                                            ║
║  - curl http://localhost:${PORT}/health                 ║
║  - curl http://localhost:${PORT}/api                    ║
║  - curl http://localhost:${PORT}/api/objects/types      ║
║  - curl http://localhost:${PORT}/api/objects/instances  ║
║  - curl http://localhost:${PORT}/api/stats              ║
║                                                        ║
║  Press Ctrl+C to stop                                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏸ Shutting down...');
  await client.end();
  server.close();
  process.exit(0);
});
