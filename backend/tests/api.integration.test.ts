/**
 * Phase 3: API Integration Tests
 * 
 * Test complete API flows:
 * - Forms API
 * - Objects API
 * - Permission checking
 * - Form validation
 */

import { Express } from 'express';
import request from 'supertest';
import { Client } from 'pg';

describe('Doorman API - Phase 3 Integration Tests', () => {
  let app: Express;
  let db: Client;

  beforeAll(async () => {
    // In real setup, create Express app with routes
    // For now, mock structure
    db = new Client({
      user: process.env.DB_USER || 'doorman_user',
      password: process.env.DB_PASSWORD || 'doorman_pass',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'doorman_db'
    });

    await db.connect();

    // app would be initialized here
  });

  afterAll(async () => {
    await db.end();
  });

  describe('Forms API', () => {
    it('GET /api/forms/task/:taskId should return form for locksmith', async () => {
      // This is a conceptual test - actual implementation would use supertest
      // with a real Express app
      
      const response = await request(app)
        .get('/api/forms/task/door-unlock_inspect-door')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('task_id', 'door-unlock_inspect-door');
      expect(response.body).toHaveProperty('fields');
      expect(Array.isArray(response.body.fields)).toBe(true);
      expect(response.body.fields.length).toBeGreaterThan(0);

      // Verify specific fields are visible
      const fieldNames = response.body.fields.map((f: any) => f.attribute_name);
      expect(fieldNames).toContain('door_id');
      expect(fieldNames).toContain('lock_type');

      // Verify non-visible fields are not included
      expect(fieldNames).not.toContain('cost_eur');
    });

    it('POST /api/forms/validate should validate form submission', async () => {
      const response = await request(app)
        .post('/api/forms/validate')
        .send({
          taskId: 'door-unlock_perform-unlock',
          doorInstanceId: 1,
          userGroup: 'locksmiths',
          formData: {
            door_id: 'D-001',
            status: 'unlocked'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('warnings');
    });

    it('POST /api/forms/validate should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/forms/validate')
        .send({
          taskId: 'door-unlock_perform-unlock',
          doorInstanceId: 1,
          userGroup: 'locksmiths',
          formData: {
            door_id: 'D-001'
            // missing required status
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('POST /api/forms/submit should save form data', async () => {
      const response = await request(app)
        .post('/api/forms/submit')
        .send({
          taskId: 'door-unlock_perform-unlock',
          doorInstanceId: 1,
          userGroup: 'locksmiths',
          formData: {
            door_id: 'D-001',
            status: 'unlocked'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('updatedFields');
    });
  });

  describe('Objects API', () => {
    it('GET /api/objects/types should list all object types', async () => {
      const response = await request(app)
        .get('/api/objects/types');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Should include Door type
      const doorType = response.body.find((t: any) => t.name === 'Door');
      expect(doorType).toBeDefined();
    });

    it('GET /api/objects/types/:id should return type with attributes', async () => {
      const response = await request(app)
        .get('/api/objects/types/1');  // Door type

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('attributes');
      expect(Array.isArray(response.body.attributes)).toBe(true);
      expect(response.body.attributes.length).toBeGreaterThanOrEqual(34);
    });

    it('GET /api/objects/instances should list doors', async () => {
      const response = await request(app)
        .get('/api/objects/instances')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('GET /api/objects/instances/:id should return door with attributes', async () => {
      const response = await request(app)
        .get('/api/objects/instances/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('external_id');
      expect(response.body).toHaveProperty('attributes');
      expect(Array.isArray(response.body.attributes)).toBe(true);
    });

    it('POST /api/objects/instances should create new door', async () => {
      const response = await request(app)
        .post('/api/objects/instances')
        .send({
          external_id: 'D-TEST-001',
          name: 'Test Door',
          attributes: {
            fire_class: 'EI30',
            security_class: 'MEDIUM',
            lock_type: 'mortise'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success || response.body.message).toBeDefined();
    });

    it('PUT /api/objects/instances/:id should update door', async () => {
      const response = await request(app)
        .put('/api/objects/instances/1')
        .send({
          name: 'Updated Door Name',
          attributes: {
            status: 'maintenance'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Permission-based Form Generation', () => {
    it('should generate different forms for different user groups', async () => {
      const locksmiths = await request(app)
        .get('/api/forms/task/door-unlock_inspect-door')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      const supervisors = await request(app)
        .get('/api/forms/task/door-unlock_inspect-door')
        .query({ doorInstanceId: 1, userGroup: 'supervisors' });

      // Both should be valid
      expect(locksmiths.status).toBe(200);
      expect(supervisors.status).toBe(200);

      // Supervisors should see more fields
      expect(supervisors.body.fields.length).toBeGreaterThan(locksmiths.body.fields.length);
    });

    it('should prevent unauthorized field editing', async () => {
      // Locksmith tries to edit cost_eur (which should be hidden)
      const validateResponse = await request(app)
        .post('/api/forms/validate')
        .send({
          taskId: 'door-unlock_inspect-door',
          doorInstanceId: 1,
          userGroup: 'locksmiths',
          formData: {
            door_id: 'D-001',
            cost_eur: '5000'  // Unauthorized
          }
        });

      // Validation should fail because cost_eur is not visible/editable for locksmiths
      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.valid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/api/forms/task/some-task');
        // Missing doorInstanceId and userGroup

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent door', async () => {
      const response = await request(app)
        .get('/api/objects/instances/99999');

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid task', async () => {
      const response = await request(app)
        .get('/api/forms/task/invalid_task')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      expect(response.status).toBe(400);
    });
  });

  describe('End-to-End Process Flow', () => {
    it('should complete full door-unlock process', async () => {
      // Step 1: User selects door
      const selectForm = await request(app)
        .get('/api/forms/task/door-unlock_select-door')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      expect(selectForm.status).toBe(200);

      // Step 2: Locksmith inspects
      const inspectForm = await request(app)
        .get('/api/forms/task/door-unlock_inspect-door')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      expect(inspectForm.status).toBe(200);

      // Step 3: Locksmith performs unlock (update status)
      const performForm = await request(app)
        .get('/api/forms/task/door-unlock_perform-unlock')
        .query({ doorInstanceId: 1, userGroup: 'locksmiths' });

      expect(performForm.status).toBe(200);

      // Submit form
      const submitResponse = await request(app)
        .post('/api/forms/submit')
        .send({
          taskId: 'door-unlock_perform-unlock',
          doorInstanceId: 1,
          userGroup: 'locksmiths',
          formData: {
            door_id: 'D-001',
            status: 'unlocked'
          }
        });

      expect(submitResponse.status).toBe(200);
      expect(submitResponse.body.success).toBe(true);

      // Step 4: Supervisor verifies
      const verifyForm = await request(app)
        .get('/api/forms/task/door-unlock_verify-status')
        .query({ doorInstanceId: 1, userGroup: 'supervisors' });

      expect(verifyForm.status).toBe(200);
    });
  });
});
