-- ============================================================
-- Migration 009: Add is_active flag to object_instances
-- ============================================================
-- Mirrors Samrum's "Aktivt" status toggle on each object.
-- Default TRUE so all existing instances stay active.

ALTER TABLE object_instances ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Verify
SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM object_instances;
