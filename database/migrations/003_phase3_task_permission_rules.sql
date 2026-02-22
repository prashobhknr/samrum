-- Phase 3: Task Permission Rules & Object Mappings
-- Defines what each user role can see/edit for each process task
-- Based on legacy Samrum door attributes and real-world process flows

-- ============================================================================
-- 1. TASK PERMISSION RULES - door-unlock process
-- ============================================================================

INSERT INTO task_permission_rules (
  process_definition_key, 
  task_name, 
  user_group_id, 
  visible_attributes, 
  editable_attributes, 
  required_attributes,
  form_header_text,
  dropdown_scope
) VALUES
-- TASK: door-unlock_select-door (Start task - user picks which door)
-- All users can see basic door info and select one
('door-unlock', 'Select Door', 'locksmiths',
 '[1,2,3,4,5]',  -- visible: door_id, door_name, location, fire_class, security_class
 '[1]',           -- editable: door_id (select which door)
 '[1]',           -- required: door_id
 'Select the door to unlock',
 'ALL'),

('door-unlock', 'Select Door', 'supervisors',
 '[1,2,3,4,5,6,7,8]',  -- supervisors see more (fire_class through lock_type)
 '[1]',
 '[1]',
 'Select the door to unlock',
 'ALL'),

('door-unlock', 'Select Door', 'security_admin',
 '[1,2,3,4,5,6,7,8,9,10]',  -- security admins see even more
 '[1]',
 '[1]',
 'Select the door to unlock',
 'ALL'),

-- TASK: door-unlock_inspect-door (Locksmith inspects)
-- Locksmith sees lock-specific info, cannot edit
('door-unlock', 'Inspect Door', 'locksmiths',
 '[1,2,3,4,5,6,7,11]',  -- door_id, name, location, fire_class, security_class, lock_type, wing_section, door_swing
 '[]',                    -- read-only
 '[1]',                   -- door_id required
 'Inspect the door and lock mechanism - Read-only',
 'ALL'),

('door-unlock', 'Inspect Door', 'supervisors',
 '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]',  -- more fields
 '[]',                                                       -- read-only
 '[1]',
 'Inspect the door - Full visibility - Read-only',
 'ALL'),

-- TASK: door-unlock_perform-unlock (Locksmith performs unlock)
-- Locksmith can update status field
('door-unlock', 'Perform Unlock', 'locksmiths',
 '[1,2,3,4,5,6,7,33]',  -- door_id, name, location, fire_class, security_class, lock_type, wing_section, status
 '[33]',                 -- editable: status
 '[1,33]',               -- required: door_id, status
 'Mark door as unlocked',
 'ALL'),

('door-unlock', 'Perform Unlock', 'supervisors',
 '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,33]',  -- all + status
 '[33]',                                                         -- editable: status
 '[1,33]',
 'Approve door unlock',
 'ALL'),

-- TASK: door-unlock_verify-status (Supervisor final approval)
-- Supervisor can see everything and approve/complete
('door-unlock', 'Verify Status', 'supervisors',
 '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]',  -- ALL fields
 '[33]',                                                                                                 -- editable: status only
 '[1,33]',                                                                                               -- required
 'Final verification - All information visible',
 'ALL'),

('door-unlock', 'Verify Status', 'security_admin',
 '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]',  -- ALL
 '[33]',                                                                                                 -- editable: status
 '[1,33]',
 'Security admin verification - All fields visible',
 'ALL'),

-- ============================================================================
-- 2. TASK PERMISSION RULES - door-maintenance process
-- ============================================================================

('door-maintenance', 'Select Door', 'maintenance',
 '[1,2,3,4,5,6,7,24,25,26]',  -- door_id, name, location, fire, security, lock, wing, maintenance dates
 '[1]',                         -- select door
 '[1]',
 'Select the door to service',
 'ALL'),

('door-maintenance', 'Inspect Door', 'maintenance',
 '[1,2,3,4,5,6,7,24,25,26,27,28,29,30]',  -- visible: door + maintenance fields + manufacturer, model, etc
 '[]',                                       -- read-only
 '[1]',
 'Inspect door and document condition',
 'ALL'),

('door-maintenance', 'Schedule Maintenance', 'maintenance',
 '[1,2,3,4,5,6,24,25,26,27,28,29,30]',  -- maintenance-related fields
 '[24,25,26]',                            -- editable: maintenance dates and interval
 '[1,25,26]',                             -- required
 'Schedule next maintenance',
 'ALL'),

('door-maintenance', 'Verify Maintenance', 'supervisors',
 '[1,2,3,4,5,6,24,25,26,27,28,29,30,31,32]',  -- all relevant fields
 '[26]',                                        -- editable: maintenance interval
 '[1,26]',
 'Approve maintenance schedule',
 'ALL');

-- ============================================================================
-- 3. TASK OBJECT MAPPINGS - Link tasks to door objects
-- ============================================================================

INSERT INTO task_object_mappings (
  process_definition_key,
  task_name,
  object_type_id,
  process_variable_name
) VALUES
-- door-unlock process
('door-unlock', 'Select Door', 1, 'doorInstance'),
('door-unlock', 'Inspect Door', 1, 'doorInstance'),
('door-unlock', 'Perform Unlock', 1, 'doorInstance'),
('door-unlock', 'Verify Status', 1, 'doorInstance'),

-- door-maintenance process
('door-maintenance', 'Select Door', 1, 'doorInstance'),
('door-maintenance', 'Inspect Door', 1, 'doorInstance'),
('door-maintenance', 'Schedule Maintenance', 1, 'doorInstance'),
('door-maintenance', 'Verify Maintenance', 1, 'doorInstance');

-- ============================================================================
-- 4. DEFAULT PERMISSIONS FOR USER GROUPS
-- ============================================================================
-- Populate the permissions table with type-level access rules

INSERT INTO permissions (
  user_group_id,
  object_type_id,
  object_attribute_id,
  operation,
  scope
) VALUES
-- LOCKSMITHS - Access lock-related fields
('locksmiths', 1, 1, 'READ', 'ALL'),    -- door_id
('locksmiths', 1, 2, 'READ', 'ALL'),    -- door_name
('locksmiths', 1, 3, 'READ', 'ALL'),    -- location
('locksmiths', 1, 4, 'READ', 'ALL'),    -- fire_class
('locksmiths', 1, 5, 'READ', 'ALL'),    -- security_class
('locksmiths', 1, 6, 'READ', 'ALL'),    -- lock_type
('locksmiths', 1, 7, 'READ', 'ALL'),    -- automation_model
('locksmiths', 1, 11, 'READ', 'ALL'),   -- wing_section
('locksmiths', 1, 33, 'WRITE', 'ALL'),  -- status (can update)

-- SUPERVISORS - Access most fields
('supervisors', 1, 1, 'READ', 'ALL'),
('supervisors', 1, 2, 'READ', 'ALL'),
('supervisors', 1, 3, 'READ', 'ALL'),
('supervisors', 1, 4, 'READ', 'ALL'),
('supervisors', 1, 5, 'READ', 'ALL'),
('supervisors', 1, 6, 'READ', 'ALL'),
('supervisors', 1, 7, 'READ', 'ALL'),
('supervisors', 1, 8, 'READ', 'ALL'),
('supervisors', 1, 9, 'READ', 'ALL'),
('supervisors', 1, 10, 'READ', 'ALL'),
('supervisors', 1, 11, 'READ', 'ALL'),
('supervisors', 1, 12, 'READ', 'ALL'),
('supervisors', 1, 13, 'READ', 'ALL'),
('supervisors', 1, 14, 'READ', 'ALL'),
('supervisors', 1, 15, 'READ', 'ALL'),
('supervisors', 1, 16, 'READ', 'ALL'),
('supervisors', 1, 17, 'READ', 'ALL'),
('supervisors', 1, 18, 'READ', 'ALL'),
('supervisors', 1, 19, 'READ', 'ALL'),
('supervisors', 1, 20, 'READ', 'ALL'),
('supervisors', 1, 33, 'WRITE', 'ALL'),  -- status

-- MAINTENANCE - Access maintenance-related fields
('maintenance', 1, 1, 'READ', 'ALL'),
('maintenance', 1, 2, 'READ', 'ALL'),
('maintenance', 1, 3, 'READ', 'ALL'),
('maintenance', 1, 6, 'READ', 'ALL'),
('maintenance', 1, 24, 'READ', 'ALL'),   -- last_maintenance_date
('maintenance', 1, 25, 'WRITE', 'ALL'),  -- maintenance_interval_months (can edit)
('maintenance', 1, 26, 'WRITE', 'ALL'),  -- warranty_expiry_date (can edit)
('maintenance', 1, 27, 'READ', 'ALL'),   -- manufacturer
('maintenance', 1, 28, 'READ', 'ALL'),   -- model_number
('maintenance', 1, 29, 'READ', 'ALL'),   -- batch_number
('maintenance', 1, 30, 'READ', 'ALL'),   -- serial_number

-- SECURITY_ADMIN - Access all fields
('security_admin', 1, 1, 'READ', 'ALL'),
('security_admin', 1, 2, 'READ', 'ALL'),
('security_admin', 1, 3, 'READ', 'ALL'),
('security_admin', 1, 4, 'READ', 'ALL'),
('security_admin', 1, 5, 'READ', 'ALL'),
('security_admin', 1, 6, 'READ', 'ALL'),
('security_admin', 1, 7, 'READ', 'ALL'),
('security_admin', 1, 8, 'READ', 'ALL'),
('security_admin', 1, 9, 'READ', 'ALL'),
('security_admin', 1, 10, 'READ', 'ALL'),
('security_admin', 1, 11, 'READ', 'ALL'),
('security_admin', 1, 12, 'READ', 'ALL'),
('security_admin', 1, 13, 'READ', 'ALL'),
('security_admin', 1, 14, 'READ', 'ALL'),
('security_admin', 1, 15, 'READ', 'ALL'),
('security_admin', 1, 16, 'READ', 'ALL'),
('security_admin', 1, 17, 'READ', 'ALL'),
('security_admin', 1, 18, 'READ', 'ALL'),
('security_admin', 1, 19, 'READ', 'ALL'),
('security_admin', 1, 20, 'READ', 'ALL'),
('security_admin', 1, 33, 'WRITE', 'ALL');  -- status
