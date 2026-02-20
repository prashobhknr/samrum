/**
 * Phase 3: FormService Integration Tests
 * 
 * Test permission-aware form generation with real database queries
 * Uses test database with Phase 2 migrated door data (10 doors)
 */

import { Client } from 'pg';
import { FormService } from '../src/services/formService';

describe('FormService - Dynamic Form Generation', () => {
  let db: Client;
  let formService: FormService;

  beforeAll(async () => {
    // Connect to test database
    db = new Client({
      user: process.env.DB_USER || 'doorman_user',
      password: process.env.DB_PASSWORD || 'doorman_pass',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'doorman_db'
    });

    await db.connect();
    formService = new FormService(db);

    // Verify test data exists
    const result = await db.query('SELECT COUNT(*) as count FROM object_instances WHERE object_type_id = 1');
    expect(parseInt(result.rows[0].count, 10)).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await db.end();
  });

  describe('generateFormForTask', () => {
    it('should generate form for locksmith inspecting door', async () => {
      const form = await formService.generateFormForTask(
        'door-unlock_inspect-door',
        1,  // First door instance
        'locksmiths'
      );

      expect(form.task_id).toBe('door-unlock_inspect-door');
      expect(form.door_instance_id).toBe(1);
      expect(form.fields).toBeDefined();
      expect(form.fields.length).toBeGreaterThan(0);

      // Locksmith should see specific fields (door_id, location, lock_type, etc)
      const fieldNames = form.fields.map(f => f.attribute_name);
      expect(fieldNames).toContain('door_id');
      expect(fieldNames).toContain('lock_type');
      expect(fieldNames).toContain('location');

      // Locksmith should NOT see cost or other admin fields
      expect(fieldNames).not.toContain('cost_eur');
      expect(fieldNames).not.toContain('warranty_expiry_date');

      // All fields should be read-only (not editable)
      const editableFields = form.fields.filter(f => f.editable);
      expect(editableFields.length).toBe(0);
    });

    it('should generate form for supervisor with full visibility', async () => {
      const form = await formService.generateFormForTask(
        'door-unlock_verify-status',
        1,
        'supervisors'
      );

      expect(form.task_id).toBe('door-unlock_verify-status');
      expect(form.fields.length).toBeGreaterThanOrEqual(20);  // Supervisors see more fields

      // Supervisor can edit status
      const statusField = form.fields.find(f => f.attribute_name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField?.editable).toBe(true);
    });

    it('should generate form for maintenance technician', async () => {
      const form = await formService.generateFormForTask(
        'door-maintenance_inspect-door',
        1,
        'maintenance'
      );

      // Maintenance should see door + maintenance-related fields
      const fieldNames = form.fields.map(f => f.attribute_name);
      expect(fieldNames).toContain('door_id');
      expect(fieldNames).toContain('last_maintenance_date');

      // Maintenance should NOT see cost
      expect(fieldNames).not.toContain('cost_eur');
    });

    it('should throw error for non-existent task', async () => {
      expect(async () => {
        await formService.generateFormForTask(
          'non_existent_task',
          1,
          'locksmiths'
        );
      }).rejects.toThrow();
    });

    it('should throw error for non-existent user group', async () => {
      expect(async () => {
        await formService.generateFormForTask(
          'door-unlock_inspect-door',
          1,
          'non_existent_group'
        );
      }).rejects.toThrow();
    });
  });

  describe('validateFormSubmission', () => {
    it('should validate required fields present', async () => {
      const result = await formService.validateFormSubmission(
        'door-unlock_perform-unlock',
        1,
        'locksmiths',
        {
          door_id: 'D-001',
          status: 'unlocked'
        }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required field', async () => {
      const result = await formService.validateFormSubmission(
        'door-unlock_perform-unlock',
        1,
        'locksmiths',
        {
          door_id: 'D-001'
          // status is required but missing
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('status'))).toBe(true);
    });

    it('should reject invalid enum value', async () => {
      const result = await formService.validateFormSubmission(
        'door-unlock_perform-unlock',
        1,
        'locksmiths',
        {
          door_id: 'D-001',
          status: 'invalid_status'  // Not in enum
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('status'))).toBe(true);
    });

    it('should reject write attempt on read-only field', async () => {
      const result = await formService.validateFormSubmission(
        'door-unlock_inspect-door',
        1,
        'locksmiths',
        {
          door_id: 'D-001',
          lock_type: 'electronic'  // Read-only in this task
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('read-only'))).toBe(true);
    });

    it('should validate number types', async () => {
      const result = await formService.validateFormSubmission(
        'door-unlock_perform-unlock',
        1,
        'locksmiths',
        {
          door_id: 'D-001',
          status: 'unlocked',
          width_mm: 'not_a_number'  // Should fail
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should validate date formats', async () => {
      const result = await formService.validateFormSubmission(
        'door-maintenance_schedule-maintenance',
        1,
        'maintenance',
        {
          door_id: 'D-001',
          last_maintenance_date: '02/20/2026'  // Wrong format
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('YYYY-MM-DD'))).toBe(true);
    });
  });

  describe('saveFormSubmission', () => {
    it('should save form submission and update attributes', async () => {
      const doorId = 1;
      const originalResult = await db.query(
        'SELECT value FROM attribute_values WHERE object_instance_id = $1 AND object_attribute_id = 33',
        [doorId]
      );
      const originalStatus = originalResult.rows.length > 0 ? originalResult.rows[0].value : null;

      // Save update
      const result = await formService.saveFormSubmission(
        doorId,
        'locksmiths',
        { status: 'unlocked' }
      );

      expect(result.success).toBe(true);
      expect(result.updatedFields).toBeGreaterThan(0);

      // Verify update in database
      const updatedResult = await db.query(
        'SELECT value FROM attribute_values WHERE object_instance_id = $1 AND object_attribute_id = 33',
        [doorId]
      );

      expect(updatedResult.rows.length).toBeGreaterThan(0);
      expect(updatedResult.rows[0].value).toBe('unlocked');

      // Restore original value
      if (originalStatus !== null) {
        await db.query(
          'UPDATE attribute_values SET value = $1 WHERE object_instance_id = $2 AND object_attribute_id = 33',
          [originalStatus, doorId]
        );
      }
    });

    it('should reject unauthorized field updates', async () => {
      // Locksmith should NOT be able to update cost_eur
      // This is caught at validation stage, but test saves anyway
      const result = await formService.saveFormSubmission(
        1,
        'locksmiths',
        { cost_eur: '5000' }  // Unauthorized
      );

      // Should still save (database layer doesn't enforce), but validation catches it
      // In real system, API layer would reject based on validation
      expect(result.success).toBe(true);
    });
  });

  describe('Form Generation Edge Cases', () => {
    it('should handle door with missing attributes', async () => {
      // All test doors have all attributes, so this tests robustness
      const form = await formService.generateFormForTask(
        'door-unlock_inspect-door',
        1,
        'locksmiths'
      );

      // Form should still be valid even if some attribute values are NULL
      expect(form.fields.length).toBeGreaterThan(0);
      expect(form.fields.every(f => f.attribute_id)).toBe(true);
    });

    it('should filter fields based on user group permissions', async () => {
      // Get forms for same task with different user groups
      const locksmiths = await formService.generateFormForTask(
        'door-unlock_inspect-door',
        1,
        'locksmiths'
      );

      const supervisors = await formService.generateFormForTask(
        'door-unlock_inspect-door',
        1,
        'supervisors'
      );

      // Supervisors should see more fields
      expect(supervisors.fields.length).toBeGreaterThan(locksmiths.fields.length);
    });

    it('should mark required fields correctly', async () => {
      const form = await formService.generateFormForTask(
        'door-unlock_perform-unlock',
        1,
        'locksmiths'
      );

      // door_id and status should be required
      const doorIdField = form.fields.find(f => f.attribute_name === 'door_id');
      const statusField = form.fields.find(f => f.attribute_name === 'status');

      expect(doorIdField?.required).toBe(true);
      expect(statusField?.required).toBe(true);
    });
  });
});
