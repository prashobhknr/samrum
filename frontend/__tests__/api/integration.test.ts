/**
 * Backend Integration Tests
 * Test complete user workflows from frontend to backend
 */

import { api } from '@/lib/api';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Backend Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    it('authenticates user successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          token: 'mock-token',
          user: { id: 'user-1', name: 'John Locksmith', role: 'locksmith' },
        },
      });

      const result = await api.authenticate('john@example.com', 'password123');

      expect(result).toEqual({
        token: 'mock-token',
        user: expect.objectContaining({ id: 'user-1' }),
      });
    });

    it('handles authentication errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 401, data: { message: 'Invalid credentials' } },
      });

      await expect(
        api.authenticate('wrong@example.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Form API', () => {
    it('generates form for task', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          taskId: 'task-1',
          fields: [
            { id: 'field-1', name: 'door_id', type: 'text', required: true },
            { id: 'field-2', name: 'lock_type', type: 'enum', required: true },
          ],
        },
      });

      const result = await api.generateFormForTask('task-1', 'user-1');

      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].name).toBe('door_id');
    });

    it('validates form submission', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { valid: true, errors: [] },
      });

      const result = await api.validateForm('task-1', {
        door_id: 'D-001',
        lock_type: 'MORTICE',
      });

      expect(result.valid).toBe(true);
    });

    it('detects validation errors', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          valid: false,
          errors: [
            { field: 'door_id', message: 'Door not found' },
          ],
        },
      });

      const result = await api.validateForm('task-1', {
        door_id: 'INVALID',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('submits form and triggers workflow', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          submissionId: 'sub-1',
          processInstanceId: 'proc-1',
          nextTask: 'verify-action',
        },
      });

      const result = await api.submitForm('task-1', {
        door_id: 'D-001',
        action: 'unlock',
      });

      expect(result.processInstanceId).toBe('proc-1');
    });
  });

  describe('Object/Door API', () => {
    it('lists doors with pagination', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          items: [
            { id: '1', external_id: 'D-001', name: 'Main Entrance' },
            { id: '2', external_id: 'D-002', name: 'Fire Exit' },
          ],
          total: 100,
        },
      });

      const result = await api.listDoors(10, 0);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(100);
    });

    it('retrieves door details', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          id: '1',
          external_id: 'D-001',
          name: 'Main Entrance',
          attributes: [
            { attribute_name: 'fire_class', value: 'EI60' },
            { attribute_name: 'lock_type', value: 'MORTICE' },
          ],
        },
      });

      const result = await api.getDoor('1');

      expect(result.external_id).toBe('D-001');
      expect(result.attributes).toHaveLength(2);
    });

    it('creates new door', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          id: '3',
          external_id: 'D-003',
          name: 'New Door',
        },
      });

      const result = await api.createDoor('D-003', 'New Door');

      expect(result.id).toBe('3');
    });

    it('updates door attributes', async () => {
      mockedAxios.put.mockResolvedValue({
        data: {
          id: '1',
          external_id: 'D-001',
          attributes: [
            { attribute_name: 'fire_class', value: 'EI90' },
          ],
        },
      });

      const result = await api.updateDoor('1', { fire_class: 'EI90' });

      expect(result.attributes[0].value).toBe('EI90');
    });
  });

  describe('Process API', () => {
    it('lists running processes', async () => {
      mockedAxios.get.mockResolvedValue({
        data: [
          { id: 'proc-1', processDefinitionKey: 'door-unlock', state: 'ACTIVE' },
          { id: 'proc-2', processDefinitionKey: 'door-maintenance', state: 'ACTIVE' },
        ],
      });

      const result = await api.getProcesses();

      expect(result).toHaveLength(2);
      expect(result[0].processDefinitionKey).toBe('door-unlock');
    });

    it('retrieves process details', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'proc-1',
          processDefinitionKey: 'door-unlock',
          state: 'ACTIVE',
          tasks: [
            { id: 'task-1', name: 'Select Door', state: 'COMPLETED' },
            { id: 'task-2', name: 'Inspect', state: 'ACTIVE' },
          ],
        },
      });

      const result = await api.getProcessDetails('proc-1');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].state).toBe('COMPLETED');
    });
  });

  describe('Error Handling', () => {
    it('retries on network timeout', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ data: { success: true } });

      const result = await api.retryGet('/api/test');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result.data.success).toBe(true);
    });

    it('handles 401 Unauthorized', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 401, data: { message: 'Token expired' } },
      });

      await expect(api.listDoors(10, 0)).rejects.toThrow('Token expired');
    });

    it('handles 403 Forbidden', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 403, data: { message: 'Insufficient permissions' } },
      });

      await expect(api.getDoor('1')).rejects.toThrow('Insufficient permissions');
    });

    it('handles server errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal server error' } },
      });

      await expect(api.listDoors(10, 0)).rejects.toThrow();
    });
  });
});
