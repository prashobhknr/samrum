-- Migration 013: Portfolio Management + BIM Integration Tables
-- Supports building-portfolio.bpmn and bim-coordination.bpmn processes

-- ============================================================================
-- BUILDING PORTFOLIO TABLE
-- Tracks all buildings in the portfolio with their lifecycle status
-- ============================================================================
CREATE TABLE IF NOT EXISTS building_portfolio (
  id SERIAL PRIMARY KEY,
  building_instance_id INTEGER NOT NULL REFERENCES object_instances(id),
  portfolio_name VARCHAR(255) NOT NULL,
  building_address TEXT,
  building_type VARCHAR(50) NOT NULL DEFAULT 'residential'
    CHECK (building_type IN ('residential', 'commercial', 'mixed', 'industrial', 'public')),
  lifecycle_phase VARCHAR(50) NOT NULL DEFAULT 'pre_portfolio',
  master_process_instance_id VARCHAR(255),
  registration_date TIMESTAMP NOT NULL DEFAULT NOW(),
  geographic_zone VARCHAR(100),
  total_area_sqm NUMERIC(12,2),
  floor_count INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_lifecycle ON building_portfolio(lifecycle_phase);
CREATE INDEX idx_portfolio_zone ON building_portfolio(geographic_zone);
CREATE INDEX idx_portfolio_active ON building_portfolio(is_active);

-- ============================================================================
-- PORTFOLIO CAMPAIGNS
-- Bulk maintenance, inspection, or audit campaigns across buildings
-- ============================================================================
CREATE TABLE IF NOT EXISTS portfolio_campaigns (
  id SERIAL PRIMARY KEY,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL
    CHECK (campaign_type IN ('maintenance', 'inspection', 'audit', 'energy_review', 'fire_safety', 'accessibility')),
  status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  target_building_ids INTEGER[] NOT NULL,
  process_instance_ids VARCHAR(255)[],
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  created_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- BIM MODELS
-- Tracks IFC model uploads and versions per building
-- ============================================================================
CREATE TABLE IF NOT EXISTS bim_models (
  id SERIAL PRIMARY KEY,
  building_instance_id INTEGER NOT NULL REFERENCES object_instances(id),
  model_name VARCHAR(255) NOT NULL,
  ifc_schema VARCHAR(20) NOT NULL DEFAULT 'IFC4'
    CHECK (ifc_schema IN ('IFC2x3', 'IFC4', 'IFC4x3')),
  version INTEGER NOT NULL DEFAULT 1,
  file_path TEXT,
  file_size_bytes BIGINT,
  authoring_tool VARCHAR(100),
  upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(30) NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'parsing', 'parsed', 'validated', 'approved', 'rejected')),
  parsed_entity_count INTEGER DEFAULT 0,
  validation_issues JSONB DEFAULT '[]',
  process_instance_id VARCHAR(255),
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bim_building ON bim_models(building_instance_id);
CREATE INDEX idx_bim_status ON bim_models(status);

-- ============================================================================
-- BIM ENTITY MAPPINGS
-- Maps IFC entities to OMS object instances for bidirectional sync
-- ============================================================================
CREATE TABLE IF NOT EXISTS bim_entity_mappings (
  id SERIAL PRIMARY KEY,
  bim_model_id INTEGER NOT NULL REFERENCES bim_models(id) ON DELETE CASCADE,
  ifc_entity_type VARCHAR(50) NOT NULL,
  ifc_global_id VARCHAR(64) NOT NULL,
  ifc_name VARCHAR(255),
  oms_object_instance_id INTEGER REFERENCES object_instances(id),
  oms_object_type_id INTEGER NOT NULL,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'skipped')),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bim_entity_model ON bim_entity_mappings(bim_model_id);
CREATE INDEX idx_bim_entity_ifc ON bim_entity_mappings(ifc_global_id);
CREATE INDEX idx_bim_entity_oms ON bim_entity_mappings(oms_object_instance_id);
CREATE UNIQUE INDEX idx_bim_entity_unique ON bim_entity_mappings(bim_model_id, ifc_global_id);

-- ============================================================================
-- BIM CLASH RESULTS
-- Stores clash detection results for review and resolution tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS bim_clash_results (
  id SERIAL PRIMARY KEY,
  bim_model_id INTEGER NOT NULL REFERENCES bim_models(id) ON DELETE CASCADE,
  clash_type VARCHAR(50) NOT NULL
    CHECK (clash_type IN ('hard', 'soft', 'clearance', 'duplicate')),
  severity VARCHAR(20) NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('critical', 'warning', 'info')),
  entity_a_global_id VARCHAR(64) NOT NULL,
  entity_a_type VARCHAR(50),
  entity_b_global_id VARCHAR(64) NOT NULL,
  entity_b_type VARCHAR(50),
  description TEXT,
  location_x NUMERIC(12,4),
  location_y NUMERIC(12,4),
  location_z NUMERIC(12,4),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'accepted', 'ignored')),
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clash_model ON bim_clash_results(bim_model_id);
CREATE INDEX idx_clash_status ON bim_clash_results(status);
