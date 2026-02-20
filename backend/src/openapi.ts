/**
 * Phase 3: OpenAPI/Swagger Specification
 * 
 * Complete API documentation for Form Generation, Permission Checking, and Door Management
 * Compatible with Swagger UI
 */

const openapi = {
  openapi: '3.0.0',
  info: {
    title: 'Doorman API - Phase 3: Dynamic Forms & Permission Management',
    description: 'REST API for permission-aware dynamic form generation with Camunda process integration',
    version: '1.0.0',
    contact: {
      name: 'Doorman Team',
      email: 'doorman@example.com'
    },
    license: {
      name: 'MIT'
    }
  },

  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development Server'
    },
    {
      url: 'http://production.example.com',
      description: 'Production Server'
    }
  ],

  paths: {
    '/api/forms/task/{taskId}': {
      get: {
        tags: ['Forms'],
        summary: 'Generate dynamic form for task',
        description: 'Generate a permission-filtered form for a specific Camunda task and user group',
        parameters: [
          {
            name: 'taskId',
            in: 'path',
            required: true,
            description: 'Task ID in format: process-key_task-name (e.g., door-unlock_inspect-door)',
            schema: {
              type: 'string'
            }
          },
          {
            name: 'doorInstanceId',
            in: 'query',
            required: true,
            description: 'ID of the door instance to load',
            schema: {
              type: 'integer'
            }
          },
          {
            name: 'userGroup',
            in: 'query',
            required: true,
            description: 'User group (e.g., locksmiths, supervisors, maintenance, security_admin)',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Form schema with permission-filtered fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task_id: { type: 'string' },
                    door_instance_id: { type: 'integer' },
                    form_header: { type: 'string' },
                    fields: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          attribute_id: { type: 'integer' },
                          attribute_name: { type: 'string' },
                          type: { type: 'string', enum: ['text', 'number', 'date', 'enum', 'boolean'] },
                          value: { type: ['string', 'null'] },
                          visible: { type: 'boolean' },
                          editable: { type: 'boolean' },
                          required: { type: 'boolean' },
                          enum_values: { type: 'array', items: { type: 'string' } }
                        }
                      }
                    },
                    metadata: {
                      type: 'object',
                      properties: {
                        generated_at: { type: 'string', format: 'date-time' },
                        user_group: { type: 'string' },
                        read_only: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request - missing parameters or invalid task'
          },
          '500': {
            description: 'Server error'
          }
        }
      }
    },

    '/api/forms/validate': {
      post: {
        tags: ['Forms'],
        summary: 'Validate form submission',
        description: 'Validate form data before saving (check types, permissions, required fields)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskId', 'doorInstanceId', 'userGroup', 'formData'],
                properties: {
                  taskId: { type: 'string' },
                  doorInstanceId: { type: 'integer' },
                  userGroup: { type: 'string' },
                  formData: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Validation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean' },
                    errors: { type: 'array', items: { type: 'string' } },
                    warnings: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/forms/submit': {
      post: {
        tags: ['Forms'],
        summary: 'Submit and save form',
        description: 'Validate and save form submission to database',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskId', 'doorInstanceId', 'userGroup', 'formData'],
                properties: {
                  taskId: { type: 'string' },
                  doorInstanceId: { type: 'integer' },
                  userGroup: { type: 'string' },
                  formData: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Form submitted and saved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    updatedFields: { type: 'integer' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation failed'
          }
        }
      }
    },

    '/api/objects/types': {
      get: {
        tags: ['Objects'],
        summary: 'List all object types',
        description: 'Get all object types (Door, Lock, Frame, Automation, WallType)',
        responses: {
          '200': {
            description: 'List of object types',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      icon_url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/objects/types/{id}': {
      get: {
        tags: ['Objects'],
        summary: 'Get object type with attributes',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Object type with all attribute definitions'
          }
        }
      }
    },

    '/api/objects/instances': {
      get: {
        tags: ['Objects'],
        summary: 'List door instances',
        parameters: [
          {
            name: 'type',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Object type ID (default: 1 for Door)'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Search in door_id and name'
          }
        ],
        responses: {
          '200': {
            description: 'List of door instances with pagination'
          }
        }
      },
      post: {
        tags: ['Objects'],
        summary: 'Create new door instance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['external_id', 'name'],
                properties: {
                  external_id: { type: 'string' },
                  name: { type: 'string' },
                  attributes: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Door instance created'
          }
        }
      }
    },

    '/api/objects/instances/{id}': {
      get: {
        tags: ['Objects'],
        summary: 'Get door instance with attributes',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Door instance with all current attribute values'
          },
          '404': {
            description: 'Door not found'
          }
        }
      },
      put: {
        tags: ['Objects'],
        summary: 'Update door instance',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  attributes: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Door updated'
          }
        }
      }
    }
  },

  components: {
    schemas: {
      FormField: {
        type: 'object',
        properties: {
          attribute_id: { type: 'integer' },
          attribute_name: { type: 'string' },
          type: { type: 'string' },
          value: { type: ['string', 'null'] },
          visible: { type: 'boolean' },
          editable: { type: 'boolean' },
          required: { type: 'boolean' },
          enum_values: { type: 'array' }
        }
      },

      ValidationResult: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          errors: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  },

  tags: [
    {
      name: 'Forms',
      description: 'Dynamic form generation with permission filtering'
    },
    {
      name: 'Objects',
      description: 'Door instance management (CRUD)'
    }
  ]
};

export default openapi;
