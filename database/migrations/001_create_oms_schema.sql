-- Phase 1: Object Management System (OMS) Schema
-- Creates 11 core tables for door module
-- Run: psql -U doorman_user -d doorman_db -f 001_create_oms_schema.sql

-- 1. Object Types - Define what kinds of objects exist
CREATE TABLE object_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Object Attributes - Define attributes of each object type
CREATE TABLE object_attributes (
  id SERIAL PRIMARY KEY,
  object_type_id INTEGER NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  attribute_name VARCHAR(255) NOT NULL,
  attribute_type VARCHAR(50) NOT NULL, -- 'text', 'number', 'date', 'enum', 'reference', 'boolean'
  is_required BOOLEAN DEFAULT FALSE,
  is_key BOOLEAN DEFAULT FALSE,
  enum_values JSONB, -- JSON array for enums: ["mortise", "rim", "electronic"]
  default_value TEXT,
  help_text TEXT,
  placeholder TEXT,
  reference_object_type_id INTEGER REFERENCES object_types(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(object_type_id, attribute_name)
);

-- 3. Object Relationships - Define how objects relate
CREATE TABLE object_relationships (
  id SERIAL PRIMARY KEY,
  parent_object_type_id INTEGER NOT NULL REFERENCES object_types(id),
  child_object_type_id INTEGER NOT NULL REFERENCES object_types(id),
  relationship_name VARCHAR(255),
  cardinality VARCHAR(50), -- '1:1', '1:N', 'N:M'
  parent_level INTEGER, -- Hierarchy depth (1-4)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Object Instances - Actual objects (e.g., specific doors)
CREATE TABLE object_instances (
  id SERIAL PRIMARY KEY,
  object_type_id INTEGER NOT NULL REFERENCES object_types(id),
  external_id VARCHAR(255), -- Legacy door_id from Samrum
  name VARCHAR(255),
  parent_instance_id INTEGER REFERENCES object_instances(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(object_type_id, external_id)
);

-- 5. Attribute Values - Actual attribute values for instances
CREATE TABLE attribute_values (
  id SERIAL PRIMARY KEY,
  object_instance_id INTEGER NOT NULL REFERENCES object_instances(id) ON DELETE CASCADE,
  object_attribute_id INTEGER NOT NULL REFERENCES object_attributes(id) ON DELETE CASCADE,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(object_instance_id, object_attribute_id)
);

-- 6. Permissions - Fine-grained access control
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  user_group_id VARCHAR(255) NOT NULL,
  object_type_id INTEGER REFERENCES object_types(id),
  object_attribute_id INTEGER REFERENCES object_attributes(id),
  operation VARCHAR(50) NOT NULL, -- 'READ', 'WRITE', 'DELETE'
  scope VARCHAR(50) DEFAULT 'ALL', -- 'ALL', 'OWN', 'ASSIGNED'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_group_id, object_type_id, object_attribute_id, operation)
);

-- 7. Task Object Mappings - Link Camunda tasks to objects
CREATE TABLE task_object_mappings (
  id SERIAL PRIMARY KEY,
  process_definition_key VARCHAR(255) NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  object_type_id INTEGER NOT NULL REFERENCES object_types(id),
  process_variable_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Task Permission Rules - Per-task visibility rules
CREATE TABLE task_permission_rules (
  id SERIAL PRIMARY KEY,
  process_definition_key VARCHAR(255) NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  user_group_id VARCHAR(255) NOT NULL,
  visible_attributes JSONB DEFAULT '[]', -- JSON array of attribute IDs
  editable_attributes JSONB DEFAULT '[]',
  required_attributes JSONB DEFAULT '[]',
  conditional_visibility JSONB,
  field_order JSONB,
  dropdown_scope VARCHAR(50) DEFAULT 'ALL', -- 'ALL', 'OWN', 'ASSIGNED'
  form_header_text TEXT,
  form_footer_text TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_group_id VARCHAR(255),
  task_timeout_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(process_definition_key, task_name, user_group_id)
);

-- 9. Attribute Validators - Validation rules per attribute
CREATE TABLE attribute_validators (
  id SERIAL PRIMARY KEY,
  object_attribute_id INTEGER NOT NULL REFERENCES object_attributes(id) ON DELETE CASCADE,
  validator_type VARCHAR(100) NOT NULL, -- 'required', 'min_length', 'pattern', 'enum', etc.
  validator_params JSONB NOT NULL,
  error_message TEXT,
  applies_to_groups JSONB, -- null = all groups
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(object_attribute_id, validator_type)
);

-- 10. Field Dependencies - Conditional field logic
CREATE TABLE field_dependencies (
  id SERIAL PRIMARY KEY,
  process_definition_key VARCHAR(255),
  source_attribute_id INTEGER NOT NULL REFERENCES object_attributes(id),
  source_value VARCHAR(255),
  dependent_attribute_id INTEGER NOT NULL REFERENCES object_attributes(id),
  dependency_type VARCHAR(50), -- 'SHOW', 'HIDE', 'REQUIRE', 'DISABLE', 'ENABLE'
  applies_to_groups JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(process_definition_key, source_attribute_id, source_value, dependent_attribute_id, dependency_type)
);

-- 11. Audit Log - Complete change history (immutable)
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(100), -- 'ATTRIBUTE_UPDATED', 'PERMISSION_CHANGED', 'FORM_VIEWED', etc.
  object_instance_id INTEGER,
  object_type_id INTEGER,
  attribute_id INTEGER,
  task_id VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_object_instances_type ON object_instances(object_type_id);
CREATE INDEX idx_object_instances_external_id ON object_instances(external_id);
CREATE INDEX idx_attribute_values_instance ON attribute_values(object_instance_id);
CREATE INDEX idx_attribute_values_attribute ON attribute_values(object_attribute_id);
CREATE INDEX idx_permissions_group ON permissions(user_group_id);
CREATE INDEX idx_task_permission_rules_lookup ON task_permission_rules(process_definition_key, task_name, user_group_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_field_dependencies_source ON field_dependencies(source_attribute_id, source_value);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO doorman_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO doorman_user;

-- Schema created successfully!
-- Next: Run 002_seed_door_objects.sql
