-- Migration 012: Task Permission Rules for Building Lifecycle Phases
-- Seeds task_permission_rules for the 8-phase building lifecycle process,
-- enabling FormService to determine field visibility per task + user group.
--
-- Uses OMS attribute IDs from object_attributes (type 6 = ID tillträdesobjekt).
-- Attribute categories:
--   Location/Space: 718 (rumsbeteckning), 725 (våningsplan), 199 (benämning)
--   Dimensions: 200 (bredd), 205 (höjd)
--   Fire class: 520 (brandklass)
--   Lock/hardware: 688 (låskistetyp), 692 (elektronik i låskistan)
--   Access control: 368 (passagekontroll)
--   Status: 180 (status)

-- ============================================================================
-- INVESTIGATION PHASE TASKS
-- ============================================================================

INSERT INTO task_permission_rules (
  process_definition_key, task_name, user_group_id,
  visible_attributes, editable_attributes, required_attributes,
  form_header_text, dropdown_scope
) VALUES
-- Review space program
('investigation-phase', 'review_space_program', 'project_managers',
 '[718,725,199,200,205]',
 '[]',
 '[]',
 'Granska rumsprogram - Läs alla rumsattribut',
 'ALL'),

('investigation-phase', 'review_space_program', 'designers_architect',
 '[718,725,199,200,205]',
 '[200,205]',
 '[]',
 'Granska rumsprogram - Kan ange dimensioner',
 'ALL'),

-- Risk assessment
('investigation-phase', 'risk_assessment', 'project_managers',
 '[718,725,199,520,368,180]',
 '[180]',
 '[]',
 'Riskanalys - Granska brandklass och passagekontroll',
 'ALL'),

-- Budget estimate
('investigation-phase', 'budget_estimate', 'project_managers',
 '[718,725,199,200,205,520,688]',
 '[]',
 '[]',
 'Budgetuppskattning - Läs alla relevanta attribut',
 'ALL'),

-- Owner approval
('investigation-phase', 'owner_approval', 'owners',
 '[718,725,199,200,205,520,368,688,180]',
 '[180]',
 '[180]',
 'Beställarens godkännande',
 'ALL'),

-- ============================================================================
-- DESIGN PHASE TASKS
-- ============================================================================

-- System design
('design-phase', 'system_design', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[]',
 '[]',
 'Systemhandling - Läs alla designattribut',
 'ALL'),

('design-phase', 'system_design', 'designers_architect',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[200,205,520,688,692,368]',
 '[200,205]',
 'Systemhandling - Ange design- och brandkrav',
 'ALL'),

-- Baseline review
('design-phase', 'baseline_review', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[]',
 '[]',
 'Granskingsmöte Fas A - Läs alla attribut',
 'ALL'),

-- Approve design
('design-phase', 'approve_design', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[180]',
 '[180]',
 'Godkänn projektering',
 'ALL'),

-- ============================================================================
-- PRODUCTION PHASE TASKS
-- ============================================================================

-- Preconstruction meeting
('production-phase', 'preconstruction_meeting', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[]',
 '[]',
 'Byggstartsmöte - Granska alla specifikationer',
 'ALL'),

-- Final inspection
('production-phase', 'final_inspection', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[180]',
 '[180]',
 'Slutbesiktning',
 'ALL'),

('production-phase', 'final_inspection', 'contractors',
 '[718,725,199,200,205,520,688,180]',
 '[]',
 '[]',
 'Slutbesiktning - Entreprenörsvy',
 'ALL'),

-- As-built documentation
('production-phase', 'asbuilt_documentation', 'contractors',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[200,205,688,692]',
 '[200,205]',
 'Relationshandlingar - Registrera uppmätta värden',
 'ALL'),

-- ============================================================================
-- PROCUREMENT PHASE TASKS
-- ============================================================================

('procurement-phase', 'evaluate_bids', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[]',
 '[]',
 'Utvärdera anbud',
 'ALL'),

('procurement-phase', 'select_supplier', 'project_managers',
 '[718,725,199,200,205,520,688,180]',
 '[180]',
 '[]',
 'Välj entreprenör',
 'ALL'),

-- ============================================================================
-- HANDOVER PHASE TASKS
-- ============================================================================

('handover-phase', 'validate_documentation', 'project_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[]',
 '[]',
 'Validera dokumentation',
 'ALL'),

('handover-phase', 'fm_acceptance', 'facility_managers',
 '[718,725,199,200,205,520,688,692,368,180]',
 '[180]',
 '[180]',
 'Förvaltningsövertagande',
 'ALL'),

('handover-phase', 'handover_keys_access', 'security_admin',
 '[718,725,199,368,688,180]',
 '[368,180]',
 '[368]',
 'Överlämna nycklar och behörighet',
 'ALL'),

-- ============================================================================
-- ACCESS MANAGEMENT TASKS (operations)
-- ============================================================================

('operations-access-management', 'new_access_request', 'security_admin',
 '[718,725,199,368,180]',
 '[368]',
 '[368]',
 'Ny behörighetsansökan',
 'ALL'),

('operations-access-management', 'new_access_request', 'facility_managers',
 '[718,725,199,368,180]',
 '[368]',
 '[368]',
 'Ny behörighetsansökan',
 'ALL'),

('operations-access-management', 'approve_access', 'security_admin',
 '[718,725,199,368,688,180]',
 '[368,180]',
 '[368]',
 'Godkänn behörighet',
 'ALL'),

('operations-access-management', 'modify_access', 'security_admin',
 '[718,725,199,368,180]',
 '[368]',
 '[368]',
 'Ändra behörighet',
 'ALL'),

-- ============================================================================
-- ENERGY MANAGEMENT TASKS (operations)
-- ============================================================================

('operations-energy', 'energy_analysis', 'facility_managers',
 '[718,725,199,180]',
 '[]',
 '[]',
 'Årlig energianalys',
 'ALL'),

('operations-energy', 'approve_measures', 'facility_managers',
 '[718,725,199,180]',
 '[180]',
 '[]',
 'Godkänn energiåtgärder',
 'ALL'),

('operations-energy', 'approve_measures', 'owners',
 '[718,725,199,180]',
 '[180]',
 '[]',
 'Godkänn energiåtgärder - Ägarbeslut',
 'ALL');

-- ============================================================================
-- TASK OBJECT MAPPINGS for lifecycle phases
-- ============================================================================

INSERT INTO task_object_mappings (
  process_definition_key, task_name, object_type_id, process_variable_name
) VALUES
-- Investigation
('investigation-phase', 'review_space_program', 9, 'roomInstance'),
('investigation-phase', 'risk_assessment', 6, 'accessObjectInstance'),
('investigation-phase', 'budget_estimate', 1, 'doorInstance'),
('investigation-phase', 'owner_approval', 1, 'doorInstance'),
-- Design
('design-phase', 'system_design', 6, 'accessObjectInstance'),
('design-phase', 'baseline_review', 6, 'accessObjectInstance'),
('design-phase', 'approve_design', 6, 'accessObjectInstance'),
-- Production
('production-phase', 'preconstruction_meeting', 6, 'accessObjectInstance'),
('production-phase', 'final_inspection', 6, 'accessObjectInstance'),
('production-phase', 'asbuilt_documentation', 6, 'accessObjectInstance'),
-- Procurement
('procurement-phase', 'evaluate_bids', 6, 'accessObjectInstance'),
('procurement-phase', 'select_supplier', 6, 'accessObjectInstance'),
-- Handover
('handover-phase', 'validate_documentation', 6, 'accessObjectInstance'),
('handover-phase', 'fm_acceptance', 6, 'accessObjectInstance'),
('handover-phase', 'handover_keys_access', 6, 'accessObjectInstance'),
-- Operations: Access Management
('operations-access-management', 'new_access_request', 6, 'accessObjectInstance'),
('operations-access-management', 'approve_access', 6, 'accessObjectInstance'),
('operations-access-management', 'modify_access', 6, 'accessObjectInstance'),
-- Operations: Energy
('operations-energy', 'energy_analysis', 1, 'buildingInstance'),
('operations-energy', 'approve_measures', 1, 'buildingInstance');
