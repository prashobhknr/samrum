/**
 * External Task Worker for Operaton (Camunda 7 REST API)
 * 
 * Polls Operaton for external tasks, dispatches to delegate handlers,
 * and completes tasks with typed variables or reports failures as incidents.
 * 
 * Uses native fetch() — no external dependencies required.
 */

const CAMUNDA_BASE = process.env.CAMUNDA_BASE || 'http://localhost:8080/engine-rest';
const WORKER_ID = `doorman-worker-${process.pid}`;
const POLL_INTERVAL_MS = 5000;
const LOCK_DURATION_MS = 30000;
const MAX_TASKS = 10;
const DEFAULT_RETRIES = 3;

/** @type {import('pg').Client | null} */
let dbClient = null;

/** @type {Record<string, (execution: any, db: any) => Promise<any>>} */
const delegateHandlers = {};

/**
 * Register a delegate handler function.
 * @param {string} topic - The external task topic (matches BPMN camunda:topic)
 * @param {(execution: any, db: any) => Promise<{success: boolean, variables?: Record<string, {value: any, type: string}>, error?: string}>} handler
 */
export function registerDelegate(topic, handler) {
  delegateHandlers[topic] = handler;
}

/**
 * Set the database client for delegate execution.
 * @param {import('pg').Client} client
 */
export function setDbClient(client) {
  dbClient = client;
}

/**
 * Get all registered topic names for fetchAndLock.
 */
function getTopics() {
  return Object.keys(delegateHandlers).map(topic => ({
    topicName: topic,
    lockDuration: LOCK_DURATION_MS,
  }));
}

/**
 * Fetch and lock external tasks from Operaton.
 */
async function fetchAndLock() {
  const topics = getTopics();
  if (topics.length === 0) return [];

  const res = await fetch(`${CAMUNDA_BASE}/external-task/fetchAndLock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerId: WORKER_ID,
      maxTasks: MAX_TASKS,
      topics,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetchAndLock failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Complete an external task with typed variables.
 * @param {string} taskId
 * @param {Record<string, {value: any, type: string}>} variables
 */
async function completeTask(taskId, variables = {}) {
  // Convert to Operaton variable format
  const operatonVars = {};
  for (const [key, val] of Object.entries(variables)) {
    operatonVars[key] = { value: val.value, type: val.type };
  }

  const res = await fetch(`${CAMUNDA_BASE}/external-task/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerId: WORKER_ID,
      variables: operatonVars,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`complete failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }
}

/**
 * Report a task failure with retry decrement.
 * When retries reach 0, Operaton creates an incident.
 * @param {string} taskId
 * @param {string} errorMessage
 * @param {number} retries - remaining retries
 */
async function reportFailure(taskId, errorMessage, retries) {
  const res = await fetch(`${CAMUNDA_BASE}/external-task/${taskId}/failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerId: WORKER_ID,
      errorMessage: errorMessage.slice(0, 500),
      retries: Math.max(0, retries),
      retryTimeout: 10000, // 10s before retry
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Worker] failure report failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }
}

/**
 * Process a single external task.
 * @param {any} task - External task from fetchAndLock response
 */
async function processTask(task) {
  const { id, topicName, retries, variables } = task;

  const handler = delegateHandlers[topicName];
  if (!handler) {
    console.warn(`[Worker] No handler for topic "${topicName}", failing task`);
    await reportFailure(id, `No delegate handler registered for topic: ${topicName}`, 0);
    return;
  }

  // Build execution context matching DelegateExecution interface
  const execution = {
    processInstanceId: task.processInstanceId,
    processDefinitionKey: task.processDefinitionKey,
    activityId: task.activityId,
    taskId: id,
    variables: {},
  };

  // Flatten Operaton variables to simple key:value pairs
  if (variables) {
    for (const [key, val] of Object.entries(variables)) {
      execution.variables[key] = val.value;
    }
  }

  try {
    const result = await handler(execution, dbClient);

    if (result.success) {
      await completeTask(id, result.variables || {});
      console.log(`[Worker] ✓ ${topicName} (${task.activityId}) completed`);
    } else {
      const currentRetries = retries ?? DEFAULT_RETRIES;
      const nextRetries = currentRetries - 1;
      console.warn(`[Worker] ✗ ${topicName} failed: ${result.error} (retries left: ${nextRetries})`);
      await reportFailure(id, result.error || 'Delegate returned success=false', nextRetries);
    }
  } catch (err) {
    const currentRetries = retries ?? DEFAULT_RETRIES;
    const nextRetries = currentRetries - 1;
    console.error(`[Worker] ✗ ${topicName} threw: ${err.message} (retries left: ${nextRetries})`);
    await reportFailure(id, err.message, nextRetries);
  }
}

/**
 * Main poll loop. Runs indefinitely until stopWorker() is called.
 */
let running = false;
let pollTimeout = null;

export async function startWorker() {
  if (running) return;
  running = true;

  const topicCount = Object.keys(delegateHandlers).length;
  console.log(`[Worker] Started (${WORKER_ID}), polling ${topicCount} topics every ${POLL_INTERVAL_MS}ms`);

  async function poll() {
    if (!running) return;

    try {
      const tasks = await fetchAndLock();
      if (tasks.length > 0) {
        console.log(`[Worker] Fetched ${tasks.length} task(s)`);
        for (const task of tasks) {
          await processTask(task);
        }
      }
    } catch (err) {
      // Operaton may be offline — log and continue polling
      console.warn(`[Worker] Poll error: ${err.message}`);
    }

    if (running) {
      pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }

  poll();
}

export function stopWorker() {
  running = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  console.log('[Worker] Stopped');
}

/**
 * Get the number of registered delegate handlers.
 */
export function getDelegateCount() {
  return Object.keys(delegateHandlers).length;
}
