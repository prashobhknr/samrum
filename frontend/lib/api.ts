/**
 * Phase 4: API Client
 * 
 * Centralized API communication layer for all backend endpoints
 * Handles authentication, error handling, request/response transformation
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface FormSchema {
  task_id: string;
  door_instance_id: number;
  form_header: string;
  fields: FormField[];
  metadata: {
    generated_at: string;
    user_group: string;
    read_only: boolean;
  };
}

export interface FormField {
  attribute_id: number;
  attribute_name: string;
  type: 'text' | 'number' | 'date' | 'enum' | 'boolean';
  value: string | null;
  visible: boolean;
  editable: boolean;
  required: boolean;
  enum_values?: string[];
  help_text?: string;
  placeholder?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DoorInstance {
  id: number;
  object_type_id: number;
  external_id: string;
  name: string;
  attributes: {
    attribute_value_id: number;
    attribute_id: number;
    attribute_name: string;
    attribute_type: string;
    value: string;
    is_required: boolean;
  }[];
  created_at: string;
  updated_at: string;
}

export interface Process {
  id: string;
  name: string;
  key: string;
  description?: string;
  version: number;
}

export interface Task {
  id: string;
  name: string;
  processDefinitionKey: string;
  assignee?: string;
  created: string;
  variables?: Record<string, any>;
}

class ApiClient {
  private client: AxiosInstance;
  private token?: string;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor for auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Error handler
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  setToken(token: string) {
    this.token = token;
  }

  // ========== Forms API ==========

  async generateForm(
    taskId: string,
    doorInstanceId: number,
    userGroup: string
  ): Promise<FormSchema> {
    const response = await this.client.get<FormSchema>(
      `/api/forms/task/${taskId}`,
      {
        params: { doorInstanceId, userGroup },
      }
    );
    return response.data;
  }

  async validateForm(
    taskId: string,
    doorInstanceId: number,
    userGroup: string,
    formData: Record<string, any>
  ): Promise<ValidationResult> {
    const response = await this.client.post<ValidationResult>(
      '/api/forms/validate',
      {
        taskId,
        doorInstanceId,
        userGroup,
        formData,
      }
    );
    return response.data;
  }

  async submitForm(
    taskId: string,
    doorInstanceId: number,
    userGroup: string,
    formData: Record<string, any>
  ): Promise<{ success: boolean; message: string; updatedFields: number }> {
    const response = await this.client.post<{
      success: boolean;
      message: string;
      updatedFields: number;
    }>('/api/forms/submit', {
      taskId,
      doorInstanceId,
      userGroup,
      formData,
    });
    return response.data;
  }

  // ========== Objects API ==========

  async listObjectTypes() {
    const response = await this.client.get('/api/objects/types');
    return response.data;
  }

  async getObjectType(id: number) {
    const response = await this.client.get(`/api/objects/types/${id}`);
    return response.data;
  }

  async listDoors(limit = 50, offset = 0, search?: string) {
    const response = await this.client.get<{
      total: number;
      items: DoorInstance[];
      limit: number;
      offset: number;
    }>('/api/objects/instances', {
      params: { limit, offset, search },
    });
    return response.data;
  }

  async getDoor(id: number): Promise<DoorInstance> {
    const response = await this.client.get<DoorInstance>(
      `/api/objects/instances/${id}`
    );
    return response.data;
  }

  async createDoor(
    external_id: string,
    name: string,
    attributes?: Record<string, any>
  ): Promise<{ id: number; external_id: string; name: string }> {
    const response = await this.client.post<{
      id: number;
      external_id: string;
      name: string;
    }>('/api/objects/instances', {
      external_id,
      name,
      attributes,
    });
    return response.data;
  }

  async updateDoor(
    id: number,
    name?: string,
    attributes?: Record<string, any>
  ): Promise<{ message: string; id: number }> {
    const response = await this.client.put<{
      message: string;
      id: number;
    }>(`/api/objects/instances/${id}`, {
      name,
      attributes,
    });
    return response.data;
  }

  // ========== Camunda API (for task management) ==========

  async listProcesses(): Promise<Process[]> {
    const response = await this.client.get('/api/processes');
    return response.data;
  }

  async startProcess(processKey: string, variables?: Record<string, any>) {
    const response = await this.client.post(`/api/processes/${processKey}/start`, {
      variables,
    });
    return response.data;
  }

  async listMyTasks(userGroup: string): Promise<Task[]> {
    const response = await this.client.get('/api/tasks', {
      params: { assignee: userGroup },
    });
    return response.data;
  }

  async completeTask(taskId: string, variables?: Record<string, any>) {
    const response = await this.client.post(`/api/tasks/${taskId}/complete`, {
      variables,
    });
    return response.data;
  }
}

export const api = new ApiClient();
