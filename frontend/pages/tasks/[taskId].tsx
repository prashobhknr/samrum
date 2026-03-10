/**
 * Task Execution Page — Utför uppgift
 * 
 * Loads a real Operaton user task, fetches the dynamic form via formKey or
 * task_permission_rules, and completes the task on submit.
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, FormSchema, DoorInstance, Task } from '@/lib/api';
import SamrumLayout from '@/components/SamrumLayout';
import DynamicForm from '@/components/DynamicForm';

export default function TaskPage() {
  const router = useRouter();
  const { taskId } = router.query;
  const { user, setIsLoading, setError } = useAppStore();
  const [task, setTask] = useState<Task | null>(null);
  const [form, setForm] = useState<FormSchema | null>(null);
  const [door, setDoor] = useState<DoorInstance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string | number | boolean> | null>(null);

  useEffect(() => {
    if (!user || !taskId) return;
    loadTask();
    checkAiConfig();
  }, [user, taskId]);

  async function checkAiConfig() {
    try {
      const config = await api.aiConfig();
      setAiAvailable(config.configured);
    } catch {
      // AI not available — button stays hidden
    }
  }

  async function handleAiSuggest() {
    if (!form) return;
    setAiLoading(true);
    try {
      const taskContext = task ? { taskName: task.name, processName: task.processName, taskKey: task.taskDefinitionKey } : undefined;
      const doorContext = door ? { externalId: door.external_id, name: door.name } : undefined;
      const result = await api.aiSuggest(form, taskContext, doorContext);
      if (Object.keys(result.suggestions).length > 0) {
        setSuggestions(result.suggestions);
      } else if (result.message) {
        setError(result.message);
      }
    } catch (err) {
      setError('AI-förslag kunde inte hämtas');
    } finally {
      setAiLoading(false);
    }
  }

  async function loadTask() {
    if (!taskId || typeof taskId !== 'string') return;

    setIsLoading(true);
    try {
      // Load real task from Operaton
      const taskData = await api.getTask(taskId);
      setTask(taskData);

      // Extract doorInstanceId from process variables
      const doorId = taskData.variables?.doorInstanceId
        || taskData.variables?.objectInstanceId
        || 1; // Fallback for processes without a door context

      // Load door/object instance
      try {
        const doorData = await api.getDoor(Number(doorId));
        setDoor(doorData);
      } catch {
        // Object may not exist — form still loads
      }

      // Build the form task ID: processKey_taskDefinitionKey
      const formTaskId = `${taskData.processDefinitionKey}_${taskData.taskDefinitionKey}`;
      const userGroup = user?.groups[0] || 'locksmiths';

      // Generate permission-filtered form
      const formData = await api.generateForm(
        formTaskId,
        Number(doorId),
        userGroup
      );
      setForm(formData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(formData: Record<string, any>) {
    if (!form || !taskId || typeof taskId !== 'string') return;

    setIsSubmitting(true);
    try {
      const userGroup = user?.groups[0] || 'locksmiths';
      const doorId = door?.id || 1;

      // Validate form data
      try {
        const validation = await api.validateForm(
          form.task_id,
          doorId,
          userGroup,
          formData
        );
        if (!validation.valid) {
          setError(validation.errors.join(', '));
          setIsSubmitting(false);
          return;
        }
      } catch {
        // Validation endpoint may not have rules configured — proceed
      }

      // Save form data to attribute_values
      try {
        await api.submitForm(form.task_id, doorId, userGroup, formData);
      } catch {
        // Save may fail if no matching attributes — proceed with task completion
      }

      // Complete the Operaton user task (advances process)
      await api.completeTask(taskId, formData);
      setSubmitted(true);

      // Redirect to inbox after brief confirmation
      setTimeout(() => router.push('/tasks'), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteWithoutForm() {
    if (!taskId || typeof taskId !== 'string') return;
    setIsSubmitting(true);
    try {
      await api.completeTask(taskId);
      setSubmitted(true);
      setTimeout(() => router.push('/tasks'), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  if (submitted) {
    return (
      <SamrumLayout>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-samrum-text">Uppgift slutförd</h2>
          <p className="text-samrum-muted mt-2">Återgår till uppgiftslistan...</p>
        </div>
      </SamrumLayout>
    );
  }

  return (
    <SamrumLayout>
      <Head>
        <title>{task?.name || 'Uppgift'} - Doorman</title>
      </Head>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Task header */}
        {task && (
          <div className="mb-6">
            <button
              onClick={() => router.push('/tasks')}
              className="text-sm text-samrum-blue hover:underline mb-3 inline-block"
            >
              ← Tillbaka till uppgifter
            </button>
            <h1 className="text-xl font-bold text-samrum-text">{task.name}</h1>
            <p className="text-sm text-samrum-muted mt-1">
              {task.processName} &middot; {task.taskDefinitionKey}
            </p>
          </div>
        )}

        {/* Door context */}
        {door && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900">Objektdetaljer</h3>
            <p className="text-sm text-blue-700 mt-1">
              {door.external_id} — {door.name}
            </p>
          </div>
        )}

        {/* Dynamic form */}
        {form ? (
          <>
            {aiAvailable && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="px-4 py-2 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <span className="inline-block animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full"></span>
                      Hämtar förslag...
                    </>
                  ) : (
                    <>✨ Föreslå värden</>
                  )}
                </button>
              </div>
            )}
            <DynamicForm
              schema={form}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              suggestions={suggestions}
            />
          </>
        ) : task ? (
          /* No form configured — show simple complete action */
          <div className="bg-samrum-panel border border-samrum-border rounded-lg p-6 text-center">
            <p className="text-samrum-muted mb-4">
              Inget formulär konfigurerat för denna uppgift.
            </p>
            <button
              onClick={handleCompleteWithoutForm}
              disabled={isSubmitting}
              className="px-4 py-2 bg-samrum-accent text-white rounded hover:bg-samrum-accent/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Slutför...' : 'Slutför uppgift'}
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-samrum-accent"></div>
            <p className="text-samrum-muted mt-4">Laddar uppgift...</p>
          </div>
        )}
      </div>
      </div>
    </SamrumLayout>
  );
}
