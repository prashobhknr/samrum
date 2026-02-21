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
