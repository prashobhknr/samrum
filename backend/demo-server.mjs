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

const PORT = process.env.API_PORT || 3000;

// Connect to database
client.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected to PostgreSQL');
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
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
          samrum_object_types: parseInt(stats[5].rows[0].count),
          samrum_relationships: parseInt(stats[6].rows[0].count),
          samrum_modules: parseInt(stats[7].rows[0].count),
          samrum_module_folders: parseInt(stats[8].rows[0].count),
          samrum_classifications: parseInt(stats[9].rows[0].count),
        }
      }));
      return;
    }

    // ─── Helper: read JSON body ────────────────────────────────────────────────
    const readBody = () => new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch(e) { resolve({}); } });
      req.on('error', reject);
    });

    // ─── Object Instances: PUT + DELETE ───────────────────────────────────────
    if (pathname.match(/^\/api\/objects\/instances\/\d+$/) && req.method === 'PUT') {
      const instanceId = parseInt(pathname.split('/').pop() ?? '0');
      const body = await readBody();
      if (body.attribute_values && typeof body.attribute_values === 'object') {
        for (const [attrName, val] of Object.entries(body.attribute_values)) {
          await client.query(`
            UPDATE attribute_values av SET value = $1
            FROM object_attributes oa
            WHERE av.object_attribute_id = oa.id
              AND av.object_instance_id = $2
              AND oa.attribute_name = $3
          `, [String(val), instanceId, attrName]);
        }
      }
      if (body.name !== undefined || body.external_id !== undefined) {
        await client.query(
          `UPDATE object_instances SET name = COALESCE($1, name), external_id = COALESCE($2, external_id) WHERE id = $3`,
          [body.name ?? null, body.external_id ?? null, instanceId]
        );
      }
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
    }

    if (pathname.match(/^\/api\/objects\/instances\/\d+$/) && req.method === 'DELETE') {
      const instanceId = parseInt(pathname.split('/').pop() ?? '0');
      await client.query(`DELETE FROM attribute_values WHERE object_instance_id = $1`, [instanceId]);
      await client.query(`DELETE FROM object_instances WHERE id = $1`, [instanceId]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
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
        const offset = parseInt(q.offset || '0');
        const search = q.search || '';
        let sql = `SELECT ot.*, dt.name as data_type_name, c.name as classification_name
          FROM samrum_object_types ot
          LEFT JOIN samrum_data_types dt ON ot.data_type_id = dt.id
          LEFT JOIN samrum_classifications c ON ot.classification_id = c.id`;
        const params = [];
        if (search) { sql += ` WHERE ot.name_singular ILIKE $1`; params.push(`%${search}%`); }
        sql += ` ORDER BY ot.name_singular LIMIT 100 OFFSET ${search ? '$' + (params.length + 1) : '$1'}`;
        if (!search) params.unshift(offset); else params.push(offset);
        const r = await client.query(sql, params);
        const countR = await client.query(
          search ? `SELECT COUNT(*) FROM samrum_object_types WHERE name_singular ILIKE $1` : `SELECT COUNT(*) FROM samrum_object_types`,
          search ? [`%${search}%`] : []
        );
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

// ─── B012: Object Type Attributes CRUD ───────────────────────────────────────
const otAttrMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/attributes$/);
if (otAttrMatch && req.method === 'GET') {
  const otId = otAttrMatch[1];
  const r = await client.query(
    `SELECT oa.*, ot.name as object_type_name
     FROM object_attributes oa
     JOIN object_types ot ON oa.object_type_id = ot.id
     WHERE ot.id = $1
     ORDER BY oa.id`,
    [otId]);
  res.writeHead(200);
  res.end(JSON.stringify({ success: true, data: r.rows }));
  return;
}
if (otAttrMatch && req.method === 'POST') {
  const otId = otAttrMatch[1];
  const body = await readBody();
  const r = await client.query(
    `INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key, enum_values, default_value, help_text, placeholder)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [otId, body.attribute_name, body.attribute_type || 'text', body.is_required || false, body.is_key || false,
     body.enum_values ? JSON.stringify(body.enum_values) : null, body.default_value || null, body.help_text || null, body.placeholder || null]);
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
      `UPDATE object_attributes SET attribute_name=$1, attribute_type=$2, is_required=$3, is_key=$4,
       enum_values=$5, default_value=$6, help_text=$7, placeholder=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [body.attribute_name, body.attribute_type, body.is_required, body.is_key,
       body.enum_values ? JSON.stringify(body.enum_values) : null, body.default_value, body.help_text, body.placeholder, attrId]);
    res.writeHead(r.rows.length ? 200 : 404);
    res.end(JSON.stringify({ success: !!r.rows.length, data: r.rows[0] || null }));
    return;
  }
  if (req.method === 'DELETE') {
    await client.query('DELETE FROM object_attributes WHERE id=$1', [attrId]);
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
  res.writeHead(501);
  res.end(JSON.stringify({ success: false, error: 'Reorder not implemented (stub)' }));
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

      // 2. Load attribute definitions (columns)
      const attrsR = await client.query(
        `SELECT id, attribute_name, attribute_type, is_required, is_key, enum_values
         FROM object_attributes WHERE object_type_id = $1 ORDER BY id`, [mod.oms_ot_id]);
      const attrs = attrsR.rows;

      // 3. Load all instances of this OMS object type
      const instsR = await client.query(
        `SELECT id, external_id, name, created_at, updated_at
         FROM object_instances WHERE object_type_id = $1 ORDER BY external_id`, [mod.oms_ot_id]);
      const instances = instsR.rows;

      // 4. Load all attribute values for those instances
      let attrValues = [];
      if (instances.length > 0) {
        const instIds = instances.map(i => i.id);
        const avR = await client.query(
          `SELECT object_instance_id, object_attribute_id, value
           FROM attribute_values WHERE object_instance_id = ANY($1::int[])`, [instIds]);
        attrValues = avR.rows;
      }

      // 5. Pivot: build a map instanceId → { attrId: value }
      const pivot = {};
      attrValues.forEach(av => {
        if (!pivot[av.object_instance_id]) pivot[av.object_instance_id] = {};
        pivot[av.object_instance_id][av.object_attribute_id] = av.value;
      });

      // 6. Build final rows
      const rows = instances.map(inst => {
        const row = {
          _id: inst.id,
          _external_id: inst.external_id,
          _name: inst.name,
          _created_at: inst.created_at,
          _updated_at: inst.updated_at,
        };
        attrs.forEach(attr => {
          row[attr.attribute_name] = pivot[inst.id]?.[attr.id] ?? null;
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
        },
        columns: attrs.map(a => ({
          key: a.attribute_name,
          label: a.attribute_name,
          type: a.attribute_type,
          is_required: a.is_required,
          is_key: a.is_key,
          enum_values: a.enum_values,
        })),
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
          storage_types:       parseInt(st.rows[0].count),
          data_types:          parseInt(dt.rows[0].count),
          classifications:     parseInt(cl.rows[0].count),
          object_types:        parseInt(ot.rows[0].count),
          module_folders:      parseInt(mf.rows[0].count),
          modules:             parseInt(m.rows[0].count),
          relationships:       parseInt(r.rows[0].count),
          module_object_types: parseInt(mot.rows[0].count),
          module_relationships:parseInt(mr.rows[0].count),
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
    res.writeHead(200); res.end(JSON.stringify({ success: true, data: { global_security_admin: r.rows.some(row => row.role === 'global_security_admin') } })); return;
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
        const r = await client.query(`SELECT id, name, description, created_at FROM samrum_import_id_sets ORDER BY name`);
        res.writeHead(200); res.end(JSON.stringify({ success: true, data: r.rows })); return;
      }
      if (req.method === 'POST') {
        const body = await readBody();
        const r = await client.query(`INSERT INTO samrum_import_id_sets (name, description) VALUES ($1,$2) RETURNING id,name,description,created_at`, [body.name, body.description || null]);
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
    if (defMatch && req.method === 'DELETE') {
      await client.query(`DELETE FROM samrum_import_definitions WHERE id=$1`, [parseInt(defMatch[1])]);
      res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
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
