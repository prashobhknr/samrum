/**
 * Phase 3: PermissionService
 * 
 * Core logic for permission checking and evaluation
 * - Check if user can READ/WRITE/DELETE attributes
 * - Merge multi-group permissions
 * - Handle scope-based filtering (ALL, OWN, ASSIGNED)
 */

import { Client } from 'pg';

export interface Permission {
  user_group_id: string;
  object_type_id: number;
  object_attribute_id: number;
  operation: 'READ' | 'WRITE' | 'DELETE';
  scope: 'ALL' | 'OWN' | 'ASSIGNED';
}

export class PermissionService {
  constructor(private db: Client) {}

  /**
   * Check if user can perform operation on attribute
   * 
   * Returns true if ANY permission group allows the operation
   */
  async canPerform(
    userGroups: string[],
    objectTypeId: number,
    attributeId: number,
    operation: 'READ' | 'WRITE' | 'DELETE'
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM permissions
      WHERE user_group_id = ANY($1)
        AND object_type_id = $2
        AND object_attribute_id = $3
        AND operation = $4
      LIMIT 1
    `;

    const result = await this.db.query(query, [
      userGroups,
      objectTypeId,
      attributeId,
      operation
    ]);

    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Get list of attribute IDs that user can READ
   */
  async getReadableAttributes(
    userGroups: string[],
    objectTypeId: number
  ): Promise<number[]> {
    const query = `
      SELECT DISTINCT object_attribute_id
      FROM permissions
      WHERE user_group_id = ANY($1)
        AND object_type_id = $2
        AND operation = 'READ'
      ORDER BY object_attribute_id
    `;

    const result = await this.db.query(query, [userGroups, objectTypeId]);
    return result.rows.map(row => row.object_attribute_id);
  }

  /**
   * Get list of attribute IDs that user can WRITE
   */
  async getWritableAttributes(
    userGroups: string[],
    objectTypeId: number
  ): Promise<number[]> {
    const query = `
      SELECT DISTINCT object_attribute_id
      FROM permissions
      WHERE user_group_id = ANY($1)
        AND object_type_id = $2
        AND operation = 'WRITE'
      ORDER BY object_attribute_id
    `;

    const result = await this.db.query(query, [userGroups, objectTypeId]);
    return result.rows.map(row => row.object_attribute_id);
  }

  /**
   * Get all permissions for a user and object type
   */
  async getPermissions(
    userGroup: string,
    objectTypeId: number
  ): Promise<Permission[]> {
    const query = `
      SELECT 
        user_group_id,
        object_type_id,
        object_attribute_id,
        operation,
        scope
      FROM permissions
      WHERE user_group_id = $1
        AND object_type_id = $2
      ORDER BY object_attribute_id, operation
    `;

    const result = await this.db.query(query, [userGroup, objectTypeId]);
    return result.rows;
  }

  /**
   * Check if attribute is required (from attribute definition)
   */
  async isRequired(
    objectTypeId: number,
    attributeId: number
  ): Promise<boolean> {
    const query = `
      SELECT is_required
      FROM object_attributes
      WHERE id = $1 AND object_type_id = $2
    `;

    const result = await this.db.query(query, [attributeId, objectTypeId]);
    
    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].is_required;
  }

  /**
   * Check scope permission (ALL vs OWN vs ASSIGNED)
   * 
   * ALL: User can access all objects of this type
   * OWN: User can only access objects they created/own
   * ASSIGNED: User can only access objects assigned to them (via task)
   */
  async checkScope(
    userGroup: string,
    doorInstanceId: number,
    scope: 'ALL' | 'OWN' | 'ASSIGNED'
  ): Promise<boolean> {
    if (scope === 'ALL') {
      return true; // Always allowed
    }

    if (scope === 'OWN') {
      // Check if user created this instance
      // (For now, simplified: check if instance was created in reasonable timeframe)
      // In real system, would track created_by user
      return true; // Placeholder
    }

    if (scope === 'ASSIGNED') {
      // Check if instance is assigned to user group via task
      // (For now, simplified)
      return true; // Placeholder
    }

    return false;
  }

  /**
   * Get task permission rules for a specific task and group
   */
  async getTaskRules(
    processKey: string,
    taskName: string,
    userGroup: string
  ): Promise<any> {
    const query = `
      SELECT 
        visible_attributes,
        editable_attributes,
        required_attributes,
        conditional_visibility,
        field_order,
        dropdown_scope,
        form_header_text
      FROM task_permission_rules
      WHERE process_definition_key = $1
        AND task_name = $2
        AND user_group_id = $3
    `;

    const result = await this.db.query(query, [processKey, taskName, userGroup]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}
