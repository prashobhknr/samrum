-- ============================================================
-- Migration 008: Object Relationships for Samrum OMS Types
-- ============================================================
-- Adds OMS-layer object_relationships derived from samrum_relationships
-- for all pairs where both from/to samrum_object_types have OMS counterparts.
-- This enables the /details endpoint to show related object sub-sections
-- (e.g. "ID tillträdesobjekt" type 6 → "Rum" type 9).

INSERT INTO object_relationships (parent_object_type_id, child_object_type_id, relationship_name, cardinality)
SELECT DISTINCT
  ot_from.id,
  ot_to.id,
  lower(regexp_replace(r.caption_singular, '[^a-zA-Z0-9]', '_', 'g')),
  CASE WHEN r.max_relations = 1 THEN '1:1' ELSE '0:N' END
FROM samrum_relationships r
JOIN object_types ot_from ON ot_from.samrum_ot_id = r.from_type_id
JOIN object_types ot_to   ON ot_to.samrum_ot_id  = r.to_type_id
WHERE ot_from.id != ot_to.id
ON CONFLICT DO NOTHING;

-- Verify
SELECT COUNT(*) AS new_relationships FROM object_relationships;
