-- ============================================================
-- Migration 003: Samrum Projects + Project-Module assignments
-- ============================================================

-- Projects table (mirrors PDB_ProjectDatabase from master DB)
CREATE TABLE IF NOT EXISTS samrum_projects (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  database_name   VARCHAR(255),         -- original SQL Server DB name
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      VARCHAR(100) DEFAULT 'system',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Project-Module junction (which modules are enabled per project)
CREATE TABLE IF NOT EXISTS samrum_project_modules (
  id              SERIAL PRIMARY KEY,
  project_id      INT NOT NULL REFERENCES samrum_projects(id) ON DELETE CASCADE,
  module_id       INT NOT NULL REFERENCES samrum_modules(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_project_modules_project ON samrum_project_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_modules_module  ON samrum_project_modules(module_id);

-- ── Seed: Projects from Samrum PDF wireframes ──────────────────────────────
INSERT INTO samrum_projects (name, database_name, description) VALUES
  ('BuildingSmart (gemensam, ny)',     'SAMRUM_BuildingSmart',    'Databas för BuildingSmart'),
  ('Dokument',                         'SAMRUM_Dokument',         'Dokumentdatabas'),
  ('Häggström programmering',          'SAMRUM_Haggstrom',        'Programmeringsdatabas för Lars Häggström'),
  ('KGK Logistikcenter, Enköping',    'SAMRUM_KGK',              'Databas för KGK Logistikcenter, Enköping'),
  ('Kv Slägel 8 (gemensam, ny)',      'SAMRUM_KvSlagel8',        'Databas för Kv Slägel 8'),
  ('Kv Vallgossen Ny (Skarp)',        'SAMRUM_KvVallgossen',     'Databas för Kv Vallgossen (Ny)'),
  ('Lars Häggström',                   'SAMRUM_LarsH',            'Databas för Lars Häggström'),
  ('Mats programmering',               'SAMRUM_MatsPrg',          'Programmeringsdatabas för Mats'),
  ('Mats Programmering 1',             'SAMRUM_MatsPrg1',         'Mats Programmering 1'),
  ('Mats Programmering 2',             'SAMRUM_MatsPrg2',         'Mats Programmering 2'),
  ('Västerås lasarett (gemensam, ny)','SAMRUM_VasterasLasarett', 'Databas för Västerås lasarett'),
  ('Comdatabas',                       'SAMRUM_Comdatabas',       NULL),
  ('GarantLås',                        'SAMRUM_GarantLas',        NULL),
  ('IFC-test',                         'SAMRUM_IFCTest',          'IFC import/export test'),
  ('KTH 1',                            'SAMRUM_KTH1',             NULL),
  ('KTH 2',                            'SAMRUM_KTH2',             NULL),
  ('Linnen 7, Sundbyberg',             'SAMRUM_Linnen7',          NULL),
  ('NCC',                              'SAMRUM_NCC',              NULL),
  ('Samrum Demo',                      'SAMRUM_Demo',             'Demo-databas'),
  ('Västerås lasarett',                'SAMRUM_Project_20210505', 'Produktion 2021'),
  ('Övningsdatabas LarssonArk',        'SAMRUM_OvningLarsson',   NULL)
ON CONFLICT DO NOTHING;

-- ── Seed: Assign ALL modules to ALL projects (Option A) ────────────────────
INSERT INTO samrum_project_modules (project_id, module_id)
SELECT p.id, m.id
FROM samrum_projects p
CROSS JOIN samrum_modules m
ON CONFLICT DO NOTHING;
