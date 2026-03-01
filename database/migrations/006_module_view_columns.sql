-- ============================================================
-- Migration 006: module_view_columns
-- Per-module column definitions populated from samrum_module_relationships.
-- Each module gets its own ordered column list sourced from the legacy
-- samrum_relationships configuration data.
-- ============================================================

-- ── 1. Create the table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS module_view_columns (
  id                     SERIAL PRIMARY KEY,
  module_id              INT          NOT NULL REFERENCES samrum_modules(id) ON DELETE CASCADE,
  column_key             VARCHAR(255) NOT NULL,   -- normalized sys_caption (lowercase ASCII)
  label                  VARCHAR(255),             -- display label (Swedish caption_singular)
  col_order              INT          DEFAULT 0,   -- from samrum_relationships.sort_order
  col_type               VARCHAR(50)  DEFAULT 'text', -- 'text','number','date','boolean','reference','file'
  is_editable            BOOLEAN      DEFAULT TRUE,  -- NOT samrum_module_relationships.read_only
  is_required            BOOLEAN      DEFAULT FALSE, -- from samrum_relationships.is_requirement
  show_by_default        BOOLEAN      DEFAULT FALSE, -- from samrum_relationships.show_in_lists_default
  oms_attribute_id       INT          REFERENCES object_attributes(id), -- null until mapped
  samrum_relationship_id INT          REFERENCES samrum_relationships(id),
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(module_id, column_key)
);

CREATE INDEX IF NOT EXISTS idx_mvc_module   ON module_view_columns(module_id);
CREATE INDEX IF NOT EXISTS idx_mvc_oms_attr ON module_view_columns(oms_attribute_id);
CREATE INDEX IF NOT EXISTS idx_mvc_samrum_rel ON module_view_columns(samrum_relationship_id);

-- ── 2. Populate from samrum_module_relationships ──────────────────────────────
-- For each module, take all its samrum relationships and convert to column defs.
-- column_key = lowercase, ASCII-safe version of sys_caption.
-- col_type mapped from the samrum data type of the to_type object type.
-- DISTINCT ON handles the rare case of duplicate normalized keys within a module
-- (keeps the one with lowest sort_order via ORDER BY).
INSERT INTO module_view_columns (
  module_id, column_key, label,
  col_order, col_type,
  is_editable, is_required, show_by_default,
  samrum_relationship_id
)
SELECT DISTINCT ON (mr.module_id, normalized_key)
  mr.module_id,
  normalized_key  AS column_key,
  r.caption_singular AS label,
  COALESCE(r.sort_order, 0) AS col_order,
  CASE dt.name
    WHEN 'Text'                           THEN 'text'
    WHEN 'Nummer'                         THEN 'number'
    WHEN 'Datum'                          THEN 'date'
    WHEN 'Ja/Nej'                         THEN 'boolean'
    WHEN 'Komplex Ja/Nej (adderar attribut)' THEN 'boolean'
    WHEN 'Länk'                           THEN 'text'
    WHEN 'Komplex typ med text-id'        THEN 'reference'
    WHEN 'Bild'                           THEN 'file'
    WHEN 'PDF-dokument'                   THEN 'file'
    WHEN 'Word-Dokument'                  THEN 'file'
    WHEN 'Excel-dokument'                 THEN 'file'
    WHEN 'Powerpointpresentation'         THEN 'file'
    WHEN 'Övriga filtyper'                THEN 'file'
    WHEN 'Film'                           THEN 'file'
    ELSE 'text'
  END AS col_type,
  NOT mr.read_only    AS is_editable,
  r.is_requirement    AS is_required,
  r.show_in_lists_default AS show_by_default,
  r.id                AS samrum_relationship_id
FROM samrum_module_relationships mr
JOIN samrum_relationships r  ON r.id  = mr.relationship_id
JOIN samrum_object_types ot_to ON ot_to.id = r.to_type_id
LEFT JOIN samrum_data_types dt ON dt.id = ot_to.data_type_id
-- Normalize sys_caption to a safe lowercase ASCII key.
-- Steps: (1) replace Swedish chars, (2) keep only [A-Za-z0-9_], (3) lowercase.
-- The regex uses [^a-zA-Z0-9_] (not [^a-z0-9_]) so uppercase ASCII is preserved
-- before the final lower() call, avoiding leading underscores on e.g. "AAr_..." → "aar_...".
CROSS JOIN LATERAL (
  SELECT lower(
    regexp_replace(
      translate(
        COALESCE(r.sys_caption, r.caption_singular, 'col_' || r.id::text),
        'öäåÖÄÅéèüÜïîôõ',
        'oaaOAAeeuUiioo'
      ),
      '[^a-zA-Z0-9_]', '_', 'g'
    )
  ) AS normalized_key
) k
WHERE r.sys_caption IS NOT NULL
  OR r.caption_singular IS NOT NULL
ORDER BY mr.module_id, normalized_key, r.sort_order
ON CONFLICT (module_id, column_key) DO NOTHING;

-- ── 3. Auto-link to OMS object_attributes by name match ──────────────────────
-- Where a module's column_key exactly matches an object_attribute.attribute_name
-- for the OMS type linked to that module, set oms_attribute_id automatically.
-- This means data from attribute_values will flow through for matched columns.
UPDATE module_view_columns mvc
SET oms_attribute_id = oa.id
FROM object_attributes oa
JOIN object_types ot     ON ot.id = oa.object_type_id
JOIN samrum_modules sm   ON sm.oms_object_type_id = ot.id
WHERE mvc.module_id = sm.id
  AND mvc.column_key = oa.attribute_name
  AND mvc.oms_attribute_id IS NULL;

-- ── 4. Summary ────────────────────────────────────────────────────────────────
-- SELECT m.id, m.name, COUNT(mvc.id) as columns, COUNT(mvc.oms_attribute_id) as mapped
-- FROM samrum_modules m
-- LEFT JOIN module_view_columns mvc ON mvc.module_id = m.id
-- GROUP BY m.id, m.name ORDER BY columns DESC LIMIT 10;
