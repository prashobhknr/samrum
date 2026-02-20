/**
 * Doorman Demo Server - Quick Working API
 * No TypeScript, no build step needed
 * Uses native Node.js + PostgreSQL
 */

const http = require('http');
const url = require('url');
const { Client } = require('pg');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

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
        client.query('SELECT COUNT(*) FROM object_relationships')
      ]);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        stats: {
          object_types: parseInt(stats[0].rows[0].count),
          attributes: parseInt(stats[1].rows[0].count),
          instances: parseInt(stats[2].rows[0].count),
          attribute_values: parseInt(stats[3].rows[0].count),
          relationships: parseInt(stats[4].rows[0].count)
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
