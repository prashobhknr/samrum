/**
 * Phase 4: Task Execution Page
 * 
 * Execute a single task with dynamic form rendering
 * - Load task details
 * - Generate dynamic form based on permissions
 * - Submit form and complete task
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, FormSchema, DoorInstance } from '@/lib/api';
import Layout from '@/components/Layout';
import DynamicForm from '@/components/DynamicForm';

export default function TaskPage() {
  const router = useRouter();
  const { taskId } = router.query;
  const { user, setIsLoading, setError } = useAppStore();
  const [form, setForm] = useState<FormSchema | null>(null);
  const [door, setDoor] = useState<DoorInstance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !taskId) return;
    loadTask();
  }, [user, taskId]);

  async function loadTask() {
    if (!taskId || typeof taskId !== 'string') return;

    setIsLoading(true);
    try {
      // In real implementation, would get task details from Camunda
      // For now, use mock task ID to demonstrate form generation
      
      // Mock: Parse task ID to get door instance
      const doorId = 1; // Would come from task variables

      // Load door instance
      const doorData = await api.getDoor(doorId);
      setDoor(doorData);

      // Generate form for this task
      // Parse taskId: should be like "door-unlock_perform-unlock"
      const formData = await api.generateForm(
        taskId,
        doorId,
        user?.groups[0] || 'locksmiths'
      );
      setForm(formData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(formData: Record<string, any>) {
    if (!form || !taskId || typeof taskId !== 'string' || !door) return;

    setIsSubmitting(true);
    try {
      // Validate form
      const validation = await api.validateForm(
        taskId,
        door.id,
        user?.groups[0] || 'locksmiths',
        formData
      );

      if (!validation.valid) {
        setError(validation.errors.join(', '));
        setIsSubmitting(false);
        return;
      }

      // Submit form
      await api.submitForm(
        taskId,
        door.id,
        user?.groups[0] || 'locksmiths',
        formData
      );

      // Complete task in Camunda
      await api.completeTask(taskId);

      router.push('/dashboard?message=Task completed successfully');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Layout>
      <Head>
        <title>Task - {taskId} - Doorman</title>
      </Head>

      <div className="max-w-2xl mx-auto">
        {door && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900">Door Details</h3>
            <p className="text-sm text-blue-700 mt-1">
              {door.external_id} - {door.name}
            </p>
          </div>
        )}

        {form ? (
          <DynamicForm
            schema={form}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        ) : (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-gray-600 mt-4">Loading form...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
