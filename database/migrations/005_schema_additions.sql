-- ============================================================
-- Migration 005: Schema additions – missing columns and tables
-- ============================================================

-- ── 1. samrum_modules: formalize columns that were added directly to DB ────────
ALTER TABLE samrum_modules ADD COLUMN IF NOT EXISTS oms_object_type_id  INT REFERENCES object_types(id);
ALTER TABLE samrum_modules ADD COLUMN IF NOT EXISTS created_by           VARCHAR(100);
ALTER TABLE samrum_modules ADD COLUMN IF NOT EXISTS changed_by           VARCHAR(100);
ALTER TABLE samrum_modules ADD COLUMN IF NOT EXISTS changed_at           TIMESTAMPTZ;

-- ── 2. samrum_relationships: add constraint/validation columns (from OTR in old system) ──
-- These were in OTR_ObjectTypeRelationship but missing from our samrum_relationships
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS max_chars                    INT;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS min_numeric_value            NUMERIC;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS max_numeric_value            NUMERIC;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS regex_pattern                VARCHAR(500);
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS nr_of_decimals               INT;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS copy_attribute               BOOLEAN DEFAULT FALSE;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS exists_only_in_parent        BOOLEAN DEFAULT FALSE;
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS required_in_locked_version   BOOLEAN DEFAULT FALSE;
-- Link samrum relationship to the OMS attribute that stores its data
ALTER TABLE samrum_relationships ADD COLUMN IF NOT EXISTS oms_attribute_id             INT REFERENCES object_attributes(id);

-- ── 3. object_instance_relationships: instance-level linking (critical gap) ────
-- Old system: OR_ObjectRelationship linked specific instances together.
-- e.g. Door instance 101 → Lock instance 5 (via relationship "contains")
-- Without this, related-object column groups always show null values.
CREATE TABLE IF NOT EXISTS object_instance_relationships (
  id                  SERIAL PRIMARY KEY,
  parent_instance_id  INT NOT NULL REFERENCES object_instances(id)   ON DELETE CASCADE,
  child_instance_id   INT NOT NULL REFERENCES object_instances(id)   ON DELETE CASCADE,
  relationship_id     INT NOT NULL REFERENCES object_relationships(id),
  created_by          VARCHAR(255),
  created_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE(parent_instance_id, child_instance_id, relationship_id)
);

CREATE INDEX IF NOT EXISTS idx_oir_parent       ON object_instance_relationships(parent_instance_id);
CREATE INDEX IF NOT EXISTS idx_oir_child        ON object_instance_relationships(child_instance_id);
CREATE INDEX IF NOT EXISTS idx_oir_relationship ON object_instance_relationships(relationship_id);
