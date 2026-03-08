/**
 * Phase 3: Dynamic Forms API Routes
 * 
 * Endpoints for form generation with permission filtering
 * - GET  /api/forms/task/{taskId} - Generate form for task
 * - POST /api/forms/validate - Validate form submission
 * - POST /api/forms/submit - Save form submission
 */

import { Router, Request, Response } from 'express';
import { Client } from 'pg';
import { FormService } from '../services/formService';

export function createFormsRouter(db: Client): Router {
  const router = Router();
  const formService = new FormService(db);

  /**
   * GET /api/forms/task/:taskId
   * 
   * Generate form for a specific task and user
   * 
   * Query params:
   *   - doorInstanceId: number (required) - which door to load
   *   - userGroup: string (required) - which user group (e.g., 'locksmiths', 'supervisors')
   * 
   * Example: GET /api/forms/task/door-unlock_inspect-door?doorInstanceId=1&userGroup=locksmiths
   * 
   * Response:
   * {
   *   "task_id": "door-unlock_inspect-door",
   *   "door_instance_id": 1,
   *   "form_header": "Inspect the door and lock - read-only information",
   *   "fields": [
   *     {
   *       "attribute_id": 1,
   *       "attribute_name": "door_id",
   *       "type": "text",
   *       "value": "D-001",
   *       "visible": true,
   *       "editable": false,
   *       "required": true
   *     },
   *     ...
   *   ],
   *   "metadata": {
   *     "generated_at": "2026-02-20T16:30:00Z",
   *     "user_group": "locksmiths",
   *     "read_only": true
   *   }
   * }
   */
  router.get('/task/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { doorInstanceId, userGroup, formKey } = req.query;

      // Validate required params
      if (!userGroup) {
        return res.status(400).json({
          error: 'Missing required query parameter: userGroup'
        });
      }

      const instanceId = doorInstanceId ? parseInt(String(doorInstanceId), 10) : undefined;

      // If formKey is provided, use the unified router
      if (formKey) {
        const form = await formService.generateFormFromKey(
          String(formKey),
          taskId,
          String(userGroup),
          instanceId
        );
        return res.status(200).json(form);
      }

      // Legacy path: require doorInstanceId for task-based form generation
      if (!instanceId || isNaN(instanceId)) {
        return res.status(400).json({
          error: 'doorInstanceId is required when formKey is not provided'
        });
      }

      const form = await formService.generateFormForTask(
        taskId,
        instanceId,
        String(userGroup)
      );

      res.status(200).json(form);
    } catch (error) {
      const message = (error as Error).message;
      res.status(400).json({
        error: message
      });
    }
  });

  /**
   * POST /api/forms/validate
   * 
   * Validate form submission before saving
   * 
   * Body:
   * {
   *   "taskId": "door-unlock_perform-unlock",
   *   "doorInstanceId": 1,
   *   "userGroup": "locksmiths",
   *   "formData": {
   *     "door_id": "D-001",
   *     "status": "unlocked"
   *   }
   * }
   * 
   * Response:
   * {
   *   "valid": true,
   *   "errors": [],
   *   "warnings": []
   * }
   * 
   * Or:
   * {
   *   "valid": false,
   *   "errors": [
   *     "status must be one of: operational, maintenance, broken, decommissioned"
   *   ],
   *   "warnings": []
   * }
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { taskId, doorInstanceId, userGroup, formData } = req.body;

      // Validate request body
      if (!taskId || !doorInstanceId || !userGroup || !formData) {
        return res.status(400).json({
          error: 'Missing required fields: taskId, doorInstanceId, userGroup, formData'
        });
      }

      // Validate
      const result = await formService.validateFormSubmission(
        taskId,
        doorInstanceId,
        userGroup,
        formData
      );

      res.status(200).json(result);
    } catch (error) {
      const message = (error as Error).message;
      res.status(400).json({
        error: message
      });
    }
  });

  /**
   * POST /api/forms/submit
   * 
   * Submit and save form data
   * 
   * Body:
   * {
   *   "taskId": "door-unlock_perform-unlock",
   *   "doorInstanceId": 1,
   *   "userGroup": "locksmiths",
   *   "formData": {
   *     "status": "unlocked"
   *   }
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Updated 1 fields",
   *   "updatedFields": 1
   * }
   */
  router.post('/submit', async (req: Request, res: Response) => {
    try {
      const { taskId, doorInstanceId, userGroup, formData } = req.body;

      // Validate request
      if (!taskId || !doorInstanceId || !userGroup || !formData) {
        return res.status(400).json({
          error: 'Missing required fields: taskId, doorInstanceId, userGroup, formData'
        });
      }

      // First validate
      const validation = await formService.validateFormSubmission(
        taskId,
        doorInstanceId,
        userGroup,
        formData
      );

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Form validation failed',
          validation
        });
      }

      // Then save
      const result = await formService.saveFormSubmission(
        doorInstanceId,
        userGroup,
        formData
      );

      res.status(200).json(result);
    } catch (error) {
      const message = (error as Error).message;
      res.status(500).json({
        error: `Failed to submit form: ${message}`
      });
    }
  });

  return router;
}
