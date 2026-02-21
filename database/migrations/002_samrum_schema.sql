-- Samrum Admin Schema
-- Migration 002: Create samrum_ prefixed tables

-- Drop tables if they exist (for re-running)
DROP TABLE IF EXISTS samrum_module_relationships CASCADE;
DROP TABLE IF EXISTS samrum_module_object_types CASCADE;
DROP TABLE IF EXISTS samrum_relationships CASCADE;
DROP TABLE IF EXISTS samrum_modules CASCADE;
DROP TABLE IF EXISTS samrum_module_folders CASCADE;
DROP TABLE IF EXISTS samrum_object_types CASCADE;
DROP TABLE IF EXISTS samrum_classifications CASCADE;
DROP TABLE IF EXISTS samrum_data_types CASCADE;
DROP TABLE IF EXISTS samrum_storage_types CASCADE;

-- Storage types (String, Numeric, Blob, Date, etc.)
CREATE TABLE samrum_storage_types (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

-- Data types (Text, Number, Image, etc.)
CREATE TABLE samrum_data_types (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(100),
  storage_type_id     INT REFERENCES samrum_storage_types(id),
  allow_user_create   BOOLEAN DEFAULT FALSE,
  is_complex          BOOLEAN DEFAULT FALSE,
  is_entity           BOOLEAN DEFAULT FALSE
);

-- Object type classifications
CREATE TABLE samrum_classifications (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255),
  description TEXT
);

-- Object types
CREATE TABLE samrum_object_types (
  id                          SERIAL PRIMARY KEY,
  data_type_id                INT REFERENCES samrum_data_types(id),
  name_singular               VARCHAR(255),
  name_plural                 VARCHAR(255),
  default_attr_caption        VARCHAR(255),
  description                 TEXT,
  is_abstract                 BOOLEAN DEFAULT FALSE,
  classification_id           INT REFERENCES samrum_classifications(id),
  database_id                 VARCHAR(100),
  exists_only_in_parent_scope BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Module folders (hierarchical)
CREATE TABLE samrum_module_folders (
  id          SERIAL PRIMARY KEY,
  parent_id   INT REFERENCES samrum_module_folders(id),
  name        VARCHAR(255),
  description TEXT
);

-- Modules
CREATE TABLE samrum_modules (
  id                       SERIAL PRIMARY KEY,
  name                     VARCHAR(255),
  description              TEXT,
  allow_incomplete_versions BOOLEAN DEFAULT FALSE,
  folder_id                INT REFERENCES samrum_module_folders(id),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships between object types
CREATE TABLE samrum_relationships (
  id                    SERIAL PRIMARY KEY,
  caption_singular      VARCHAR(255),
  caption_plural        VARCHAR(255),
  from_type_id          INT REFERENCES samrum_object_types(id),
  to_type_id            INT REFERENCES samrum_object_types(id),
  min_relations         INT DEFAULT 0,
  max_relations         INT,
  sort_order            INT DEFAULT 0,
  allow_in_lists        BOOLEAN DEFAULT TRUE,
  show_in_lists_default BOOLEAN DEFAULT FALSE,
  is_requirement        BOOLEAN DEFAULT FALSE,
  sys_caption           VARCHAR(255),
  guid                  UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Module <-> Object type assignments
CREATE TABLE samrum_module_object_types (
  id                  SERIAL PRIMARY KEY,
  module_id           INT REFERENCES samrum_modules(id),
  object_type_id      INT REFERENCES samrum_object_types(id),
  allow_edit          BOOLEAN DEFAULT TRUE,
  show_as_root        BOOLEAN DEFAULT FALSE,
  allow_insert        BOOLEAN DEFAULT TRUE,
  is_main_object_type BOOLEAN DEFAULT FALSE
);

-- Module <-> Relationship assignments
CREATE TABLE samrum_module_relationships (
  id              SERIAL PRIMARY KEY,
  module_id       INT REFERENCES samrum_modules(id),
  relationship_id INT REFERENCES samrum_relationships(id),
  allow_edit      BOOLEAN DEFAULT TRUE,
  read_only       BOOLEAN DEFAULT FALSE
);

-- Indexes for common lookups
CREATE INDEX idx_samrum_ot_data_type      ON samrum_object_types(data_type_id);
CREATE INDEX idx_samrum_ot_classification ON samrum_object_types(classification_id);
CREATE INDEX idx_samrum_rel_from          ON samrum_relationships(from_type_id);
CREATE INDEX idx_samrum_rel_to            ON samrum_relationships(to_type_id);
CREATE INDEX idx_samrum_mot_module        ON samrum_module_object_types(module_id);
CREATE INDEX idx_samrum_mot_ot            ON samrum_module_object_types(object_type_id);
CREATE INDEX idx_samrum_mr_module         ON samrum_module_relationships(module_id);
CREATE INDEX idx_samrum_mr_rel            ON samrum_module_relationships(relationship_id);
CREATE INDEX idx_samrum_modules_folder    ON samrum_modules(folder_id);
CREATE INDEX idx_samrum_folders_parent    ON samrum_module_folders(parent_id);
