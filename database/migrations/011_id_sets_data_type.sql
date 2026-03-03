-- B014 page 39: Add data_type column to samrum_import_id_sets
-- Matches the PDF UI which shows Datatyp dropdown (IFCGlobalId, Numerisk, Guid)
ALTER TABLE samrum_import_id_sets ADD COLUMN IF NOT EXISTS data_type VARCHAR(50) NOT NULL DEFAULT 'IFCGlobalId';
-- Migrate existing description-based rows: keep description, set data_type to default
