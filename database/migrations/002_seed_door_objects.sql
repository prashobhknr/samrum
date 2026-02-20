-- Phase 1: Seed Door Module Objects
-- Inserts Door, Lock, Frame, Automation, WallType object types and their attributes
-- Run: psql -U doorman_user -d doorman_db -f 002_seed_door_objects.sql

-- 1. INSERT OBJECT TYPES
INSERT INTO object_types (name, description) VALUES
('Door', 'Physical door in building'),
('Lock', 'Locking mechanism in a door'),
('Door Frame', 'Frame/casing surrounding a door'),
('Door Automation', 'Motorized door opener system'),
('Wall Type', 'Classification of wall where door is installed')
ON CONFLICT (name) DO NOTHING;

-- Get IDs for reference
-- Door: 1, Lock: 2, Door Frame: 3, Door Automation: 4, Wall Type: 5

-- 2. DOOR ATTRIBUTES (14 attributes)
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key, default_value, help_text) VALUES
(1, 'door_id', 'text', true, true, NULL, 'Unique identifier for this door'),
(1, 'door_name', 'text', false, false, NULL, 'Display name (e.g., Main Entrance)'),
(1, 'location_description', 'text', false, false, NULL, 'Where in building (e.g., Building A, 2nd floor)'),
(1, 'has_access_control', 'boolean', false, false, 'false', 'Does door have advanced access control?'),
(1, 'has_automation', 'boolean', false, false, 'false', 'Is door motorized?'),
(1, 'door_closer_count', 'number', false, false, NULL, 'Number of door closers'),
(1, 'installed_date', 'date', false, false, NULL, 'When door was installed'),
(1, 'last_maintenance_date', 'date', false, false, NULL, 'Last maintenance date'),
(1, 'maintenance_frequency_months', 'number', false, false, '12', 'Maintenance interval in months'),
(1, 'fire_class', 'enum', false, false, NULL, 'Fire resistance rating (EI30, EI60, etc.)'),
(1, 'security_class', 'enum', false, false, NULL, 'Security classification (A, B, C, etc.)'),
(1, 'notes', 'text', false, false, NULL, 'Additional notes')
ON CONFLICT DO NOTHING;

-- 3. LOCK ATTRIBUTES (10 attributes)
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key) VALUES
(2, 'lock_id', 'text', true, true),
(2, 'lock_type', 'enum', true, false),
(2, 'lock_manufacturer', 'text', false, false),
(2, 'lock_model', 'text', false, false),
(2, 'is_night_lock', 'boolean', false, false),
(2, 'primary_lock_position', 'number', false, false),
(2, 'battery_powered', 'boolean', false, false),
(2, 'battery_replacement_months', 'number', false, false),
(2, 'last_service_date', 'date', false, false),
(2, 'service_next_due_date', 'date', false, false)
ON CONFLICT DO NOTHING;

-- 4. DOOR FRAME ATTRIBUTES (10 attributes)
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key) VALUES
(3, 'frame_id', 'text', true, true),
(3, 'frame_depth', 'number', true, false),
(3, 'frame_material', 'enum', true, false),
(3, 'frame_paint_color', 'text', false, false),
(3, 'impact_protection', 'boolean', false, false),
(3, 'impact_protection_height', 'number', false, false),
(3, 'threshold_type', 'enum', false, false),
(3, 'threshold_material', 'enum', false, false),
(3, 'frame_extra_components', 'text', false, false),
(3, 'installation_date', 'date', false, false)
ON CONFLICT DO NOTHING;

-- 5. DOOR AUTOMATION ATTRIBUTES (9 attributes)
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key) VALUES
(4, 'automation_id', 'text', true, true),
(4, 'automation_manufacturer', 'text', true, false),
(4, 'automation_model', 'text', true, false),
(4, 'power_type', 'enum', true, false),
(4, 'opening_force', 'enum', false, false),
(4, 'closing_time_seconds', 'number', false, false),
(4, 'backup_power_source', 'boolean', false, false),
(4, 'backup_battery_status', 'enum', false, false),
(4, 'last_maintenance_date', 'date', false, false)
ON CONFLICT DO NOTHING;

-- 6. WALL TYPE ATTRIBUTES (7 attributes)
INSERT INTO object_attributes (object_type_id, attribute_name, attribute_type, is_required, is_key) VALUES
(5, 'wall_type_id', 'text', true, true),
(5, 'wall_type_name', 'text', true, false),
(5, 'wall_material', 'enum', true, false),
(5, 'wall_thickness_mm', 'number', false, false),
(5, 'fireproof_rating', 'enum', false, false),
(5, 'insulation_type', 'enum', false, false),
(5, 'sound_insulation_rating', 'enum', false, false)
ON CONFLICT DO NOTHING;

-- 7. INSERT OBJECT RELATIONSHIPS
INSERT INTO object_relationships (parent_object_type_id, child_object_type_id, relationship_name, cardinality, parent_level) VALUES
(1, 2, 'contains', '1:N', 2),
(1, 3, 'has_frame', '1:1', 2),
(1, 4, 'uses', '0:1', 2),
(1, 5, 'placed_in', 'N:1', 2)
ON CONFLICT DO NOTHING;

-- 8. INSERT SAMPLE DOOR INSTANCE (for testing)
INSERT INTO object_instances (object_type_id, external_id, name) VALUES
(1, 'D-001', 'Main Entrance Door')
ON CONFLICT DO NOTHING;

-- 9. SET SAMPLE ATTRIBUTE VALUES FOR D-001
INSERT INTO attribute_values (object_instance_id, object_attribute_id, value) VALUES
(1, 1, 'D-001'),
(1, 2, 'Main Entrance'),
(1, 3, 'Building A, 2nd Floor'),
(1, 4, 'true'),
(1, 5, 'true'),
(1, 9, '12'),
(1, 10, 'EI30'),
(1, 11, 'HIGH')
ON CONFLICT DO NOTHING;

-- Verification queries (run after seed)
-- SELECT COUNT(*) as "Object Types" FROM object_types;
-- SELECT COUNT(*) as "Attributes" FROM object_attributes;
-- SELECT COUNT(*) as "Relationships" FROM object_relationships;
-- SELECT COUNT(*) as "Instances" FROM object_instances;
-- SELECT COUNT(*) as "Attribute Values" FROM attribute_values;

-- Expected results:
-- Object Types: 5
-- Attributes: 50+
-- Relationships: 4
-- Instances: 1 (D-001)
-- Attribute Values: 8 (for D-001)

-- Seed complete!
