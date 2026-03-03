-- Migration 009: Add detail fields and sub-tables for import/export definitions

-- Add extra fields to samrum_import_definitions
ALTER TABLE samrum_import_definitions
  ADD COLUMN IF NOT EXISTS id_set_id INTEGER REFERENCES samrum_import_id_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_engine VARCHAR(100),
  ADD COLUMN IF NOT EXISTS export_engine VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Entities connected to a definition (mapping of IFC entity types → OMS object types)
CREATE TABLE IF NOT EXISTS samrum_import_definition_entities (
  id          SERIAL PRIMARY KEY,
  definition_id INTEGER NOT NULL REFERENCES samrum_import_definitions(id) ON DELETE CASCADE,
  entity_type VARCHAR(100) NOT NULL,       -- e.g. 'IFCDOOR', 'IFCSPACE', etc.
  object_type_id INTEGER REFERENCES samrum_object_types(id) ON DELETE SET NULL,
  object_type_name VARCHAR(255),           -- cached display name
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-module rights for a definition (which modules can import/export using this definition)
CREATE TABLE IF NOT EXISTS samrum_import_definition_modules (
  id            SERIAL PRIMARY KEY,
  definition_id INTEGER NOT NULL REFERENCES samrum_import_definitions(id) ON DELETE CASCADE,
  module_id     INTEGER NOT NULL REFERENCES samrum_modules(id) ON DELETE CASCADE,
  allow_import  BOOLEAN NOT NULL DEFAULT TRUE,
  allow_export  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (definition_id, module_id)
);

-- Grant access
GRANT ALL ON samrum_import_definition_entities, samrum_import_definition_modules TO doorman_user;
GRANT USAGE, SELECT ON SEQUENCE samrum_import_definition_entities_id_seq, samrum_import_definition_modules_id_seq TO doorman_user;
