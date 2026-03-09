-- A010: Lock object (version) – add is_locked column to object_instances
ALTER TABLE object_instances ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
