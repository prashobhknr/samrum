// B012: Object Type Attributes API
// Add these endpoints to demo-server.mjs after the relationships section
// (after line where otRelMatch handling ends, before Module Folders section)

// Object Type Attributes CRUD
const otAttrMatch = pathname.match(/^\/api\/admin\/object-types\/(\d+)\/attributes$/);
// GET /api/admin/object-types/:id/attributes - list OMS attributes
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
// POST /api/admin/object-types/:id/attributes - create attribute
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
// PUT /api/admin/object-types/attributes/:id - update attribute
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
// PUT /api/admin/object-types/attributes/:id/reorder - move up/down (stub)
const attrReorderMatch = pathname.match(/^\/api\/admin\/object-types\/attributes\/(\d+)\/reorder$/);
if (attrReorderMatch && req.method === 'PUT') {
  // In real implementation: update sort_order field
  res.writeHead(501);
  res.end(JSON.stringify({ success: false, error: 'Reorder not implemented (stub)' }));
  return;
}