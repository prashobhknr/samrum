/**
 * Phase 3: FormService
 * 
 * Core business logic for dynamic form generation with permission-based field filtering
 * 
 * Algorithm:
 * 1. Load task permission rules (what fields this task exposes)
 * 2. Load user's permissions (what fields this user can access)
 * 3. Load door instance data (current values)
 * 4. For each field: determine visible, editable, required status
 * 5. Return JSON form schema
 */

import { Client } from 'pg';

interface FormField {
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

interface FormSchema {
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

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class FormService {
  constructor(private db: Client) {}

  /**
   * Generate form for a specific task and user group
   */
  async generateFormForTask(
    taskId: string,
    doorInstanceId: number,
    userGroup: string
  ): Promise<FormSchema> {
    // 1. Load task permission rules
    const taskRules = await this.getTaskPermissionRules(taskId, userGroup);
    
    // 2. Load user's base permissions
    const userPermissions = await this.getUserPermissions(userGroup, 1); // object_type_id = 1 (Door)
    
    // 3. Load door instance and current attribute values
    const doorData = await this.getDoorInstanceData(doorInstanceId);
    
    // 4. Build form fields
    const fields = await this.buildFormFields(
      taskRules,
      userPermissions,
      doorData
    );

    // 5. Return complete form schema
    return {
      task_id: taskId,
      door_instance_id: doorInstanceId,
      form_header: taskRules.form_header_text || `Task: ${taskId}`,
      fields,
      metadata: {
        generated_at: new Date().toISOString(),
        user_group: userGroup,
        read_only: fields.every(f => !f.editable)
      }
    };
  }

  /**
   * Load task-specific permission rules
   */
  private async getTaskPermissionRules(
    taskId: string,
    userGroup: string
  ): Promise<any> {
    // Parse task_id into process_definition_key and task_name
    const [processKey, taskName] = taskId.split('_');

    const query = `
      SELECT 
        visible_attributes,
        editable_attributes,
        required_attributes,
        form_header_text,
        field_order
      FROM task_permission_rules
      WHERE process_definition_key = $1
        AND task_name = $2
        AND user_group_id = $3
    `;

    const result = await this.db.query(query, [processKey, taskName, userGroup]);
    
    if (result.rows.length === 0) {
      throw new Error(`No permission rules found for task ${taskId} and group ${userGroup}`);
    }

    return result.rows[0];
  }

  /**
   * Get user's base permissions for an object type
   */
  private async getUserPermissions(
    userGroup: string,
    objectTypeId: number
  ): Promise<Map<number, { read: boolean; write: boolean; delete: boolean }>> {
    const query = `
      SELECT 
        object_attribute_id,
        operation
      FROM permissions
      WHERE user_group_id = $1
        AND object_type_id = $2
      ORDER BY object_attribute_id, operation
    `;

    const result = await this.db.query(query, [userGroup, objectTypeId]);
    
    const permMap = new Map<number, { read: boolean; write: boolean; delete: boolean }>();

    for (const row of result.rows) {
      if (!permMap.has(row.object_attribute_id)) {
        permMap.set(row.object_attribute_id, { read: false, write: false, delete: false });
      }

      const perm = permMap.get(row.object_attribute_id)!;
      if (row.operation === 'READ') perm.read = true;
      if (row.operation === 'WRITE') perm.write = true;
      if (row.operation === 'DELETE') perm.delete = true;
    }

    return permMap;
  }

  /**
   * Load door instance data
   */
  private async getDoorInstanceData(doorInstanceId: number): Promise<Map<number, string>> {
    const query = `
      SELECT 
        object_attribute_id,
        value
      FROM attribute_values
      WHERE object_instance_id = $1
    `;

    const result = await this.db.query(query, [doorInstanceId]);
    
    const dataMap = new Map<number, string>();
    for (const row of result.rows) {
      dataMap.set(row.object_attribute_id, row.value);
    }

    return dataMap;
  }

  /**
   * Build form fields by combining task rules + user permissions + data
   */
  private async buildFormFields(
    taskRules: any,
    userPermissions: Map<number, any>,
    doorData: Map<number, string>
  ): Promise<FormField[]> {
    const visibleAttrIds = taskRules.visible_attributes || [];
    const editableAttrIds = taskRules.editable_attributes || [];
    const requiredAttrIds = taskRules.required_attributes || [];

    // Get all attribute definitions
    const attrQuery = `
      SELECT 
        id,
        attribute_name,
        attribute_type,
        enum_values,
        help_text,
        placeholder
      FROM object_attributes
      WHERE id = ANY($1)
      ORDER BY id
    `;

    const result = await this.db.query(attrQuery, [visibleAttrIds]);
    
    const fields: FormField[] = [];

    for (const attr of result.rows) {
      const userPerm = userPermissions.get(attr.id) || { read: false, write: false };
      
      fields.push({
        attribute_id: attr.id,
        attribute_name: attr.attribute_name,
        type: attr.attribute_type,
        value: doorData.get(attr.id) || null,
        visible: visibleAttrIds.includes(attr.id) && userPerm.read,
        editable: editableAttrIds.includes(attr.id) && userPerm.write,
        required: requiredAttrIds.includes(attr.id),
        enum_values: attr.enum_values ? (attr.enum_values as string[]) : undefined,
        help_text: attr.help_text,
        placeholder: attr.placeholder
      });
    }

    return fields;
  }

  /**
   * Generate form for a specific Samrum module + object type
   * Used when formKey = doorman:{moduleId}:{objectTypeId} (moduleId != 'generic')
   *
   * Pulls columns from module_view_columns instead of task_permission_rules,
   * allowing each of the 271 Samrum modules to render its specific column set.
   */
  async generateFormForModule(
    taskId: string,
    moduleId: number,
    objectTypeId: number,
    userGroup: string,
    instanceId?: number
  ): Promise<FormSchema> {
    // 1. Load module columns (the module's field definitions)
    const columnsQuery = `
      SELECT
        mvc.column_key,
        mvc.label,
        mvc.col_order,
        mvc.col_type,
        mvc.is_editable,
        mvc.is_required,
        mvc.show_by_default,
        mvc.oms_attribute_id,
        oa.attribute_name,
        oa.attribute_type,
        oa.enum_values,
        oa.help_text,
        oa.placeholder
      FROM module_view_columns mvc
      LEFT JOIN object_attributes oa ON oa.id = mvc.oms_attribute_id
      WHERE mvc.module_id = $1
        AND mvc.oms_attribute_id IS NOT NULL
      ORDER BY mvc.col_order
    `;
    const columnsResult = await this.db.query(columnsQuery, [moduleId]);

    // 2. Load user's base permissions for this object type
    const userPermissions = await this.getUserPermissions(userGroup, objectTypeId);

    // 3. Load instance data if provided
    let instanceData = new Map<number, string>();
    if (instanceId) {
      instanceData = await this.getDoorInstanceData(instanceId);
    }

    // 4. Load module name for header
    const moduleNameResult = await this.db.query(
      'SELECT name FROM samrum_modules WHERE id = $1',
      [moduleId]
    );
    const moduleName = moduleNameResult.rows[0]?.name || `Module ${moduleId}`;

    // 5. Build fields from module columns
    const fields: FormField[] = [];
    for (const col of columnsResult.rows) {
      const attrId = col.oms_attribute_id;
      const userPerm = userPermissions.get(attrId) || { read: true, write: false };

      fields.push({
        attribute_id: attrId,
        attribute_name: col.attribute_name || col.column_key,
        type: this.mapColType(col.col_type || col.attribute_type),
        value: instanceData.get(attrId) || null,
        visible: userPerm.read,
        editable: col.is_editable && userPerm.write,
        required: col.is_required || false,
        enum_values: col.enum_values ? (col.enum_values as string[]) : undefined,
        help_text: col.help_text,
        placeholder: col.placeholder
      });
    }

    return {
      task_id: taskId,
      door_instance_id: instanceId || 0,
      form_header: moduleName,
      fields: fields.filter(f => f.visible),
      metadata: {
        generated_at: new Date().toISOString(),
        user_group: userGroup,
        read_only: fields.every(f => !f.editable)
      }
    };
  }

  /**
   * Parse a Camunda formKey and route to the appropriate form generator
   */
  async generateFormFromKey(
    formKey: string,
    taskId: string,
    userGroup: string,
    instanceId?: number
  ): Promise<FormSchema> {
    const parts = formKey.split(':');
    if (parts.length !== 3 || parts[0] !== 'doorman') {
      throw new Error(`Invalid formKey format: ${formKey}. Expected doorman:{moduleId}:{objectTypeId}`);
    }

    const [, moduleIdStr, typeIdStr] = parts;
    const objectTypeId = parseInt(typeIdStr, 10);

    if (moduleIdStr === 'generic') {
      // Generic form: use task_permission_rules + object_attributes
      return this.generateFormForTask(taskId, instanceId || 0, userGroup);
    } else {
      // Module-specific form: use module_view_columns
      const moduleId = parseInt(moduleIdStr, 10);
      return this.generateFormForModule(taskId, moduleId, objectTypeId, userGroup, instanceId);
    }
  }

  private mapColType(colType: string): 'text' | 'number' | 'date' | 'enum' | 'boolean' {
    switch (colType) {
      case 'number': return 'number';
      case 'date': return 'date';
      case 'boolean': return 'boolean';
      case 'enum': case 'reference': return 'enum';
      default: return 'text';
    }
  }

  /**
   * Validate form submission
   */
  async validateFormSubmission(
    taskId: string,
    doorInstanceId: number,
    userGroup: string,
    formData: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get the form schema to validate against
      const form = await this.generateFormForTask(taskId, doorInstanceId, userGroup);

      // Validate each field
      for (const field of form.fields) {
        const submittedValue = formData[field.attribute_name];

        // Check required fields
        if (field.required && !submittedValue) {
          errors.push(`${field.attribute_name} is required`);
        }

        // Check if field is editable (prevent tampering)
        if (!field.editable && submittedValue && submittedValue !== field.value) {
          errors.push(`${field.attribute_name} is read-only and cannot be modified`);
        }

        // Type validation
        if (submittedValue) {
          switch (field.type) {
            case 'number':
              if (isNaN(Number(submittedValue))) {
                errors.push(`${field.attribute_name} must be a number`);
              }
              break;
            case 'date':
              if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedValue)) {
                errors.push(`${field.attribute_name} must be in YYYY-MM-DD format`);
              }
              break;
            case 'enum':
              if (field.enum_values && !field.enum_values.includes(submittedValue)) {
                errors.push(`${field.attribute_name} must be one of: ${field.enum_values.join(', ')}`);
              }
              break;
            case 'boolean':
              if (!['true', 'false', '1', '0'].includes(String(submittedValue))) {
                errors.push(`${field.attribute_name} must be true or false`);
              }
              break;
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Save form submission (update door attributes)
   */
  async saveFormSubmission(
    doorInstanceId: number,
    userGroup: string,
    formData: Record<string, any>
  ): Promise<{ success: boolean; message: string; updatedFields: number }> {
    let updatedCount = 0;

    const client = this.db;
    await client.query('BEGIN');

    try {
      for (const [attrName, value] of Object.entries(formData)) {
        // Get attribute ID by name
        const attrResult = await client.query(
          'SELECT id FROM object_attributes WHERE attribute_name = $1',
          [attrName]
        );

        if (attrResult.rows.length === 0) {
          continue; // Skip unknown attributes
        }

        const attrId = attrResult.rows[0].id;

        // Update or insert attribute value
        const upsertQuery = `
          INSERT INTO attribute_values (object_instance_id, object_attribute_id, value)
          VALUES ($1, $2, $3)
          ON CONFLICT(object_instance_id, object_attribute_id) 
          DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `;

        await client.query(upsertQuery, [doorInstanceId, attrId, String(value)]);
        updatedCount++;
      }

      await client.query('COMMIT');
      return {
        success: true,
        message: `Updated ${updatedCount} fields`,
        updatedFields: updatedCount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}
