/**
 * Task Inbox — Uppgifter
 * 
 * Lists Operaton user tasks assigned to or claimable by the logged-in user.
 * Supports claim/unclaim and navigating to the task execution form.
 */

import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, Task } from '@/lib/api';
import SamrumLayout from '@/components/SamrumLayout';

type TabKey = 'mine' | 'claimable';

export default function TaskInbox() {
  const router = useRouter();
  const { user } = useAppStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('mine');
  const [claiming, setClaiming] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let result: Task[];
      if (activeTab === 'mine') {
        result = await api.listMyTasks({ assignee: user.username });
      } else {
        // Load tasks claimable by any of the user's groups
        const group = user.groups[0] || 'locksmiths';
        result = await api.listMyTasks({ candidateGroup: group });
      }
      setTasks(result);
    } catch (err) {
      setError((err as Error).message || 'Kunde inte ladda uppgifter');
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleClaim(taskId: string) {
    if (!user) return;
    setClaiming(taskId);
    try {
      await api.claimTask(taskId, user.username);
      // Switch to "mine" tab to see claimed task
      setActiveTab('mine');
    } catch (err) {
      setError((err as Error).message || 'Kunde inte ta uppgiften');
    } finally {
      setClaiming(null);
    }
  }

  async function handleUnclaim(taskId: string) {
    setClaiming(taskId);
    try {
      await api.unclaimTask(taskId);
      await loadTasks();
    } catch (err) {
      setError((err as Error).message || 'Kunde inte släppa uppgiften');
    } finally {
      setClaiming(null);
    }
  }

  function handleOpenTask(taskId: string) {
    router.push(`/tasks/${taskId}`);
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleString('sv-SE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  if (!user) {
    return (
      <SamrumLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-samrum-muted">Logga in för att se dina uppgifter.</p>
        </div>
      </SamrumLayout>
    );
  }

  return (
    <SamrumLayout>
      <Head>
        <title>Uppgifter - Doorman</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-samrum-text mb-6">Uppgifter</h1>

        {/* Tabs */}
        <div className="flex border-b border-samrum-border mb-4">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mine'
                ? 'border-samrum-accent text-samrum-accent'
                : 'border-transparent text-samrum-muted hover:text-samrum-text'
            }`}
          >
            Mina uppgifter
          </button>
          <button
            onClick={() => setActiveTab('claimable')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'claimable'
                ? 'border-samrum-accent text-samrum-accent'
                : 'border-transparent text-samrum-muted hover:text-samrum-text'
            }`}
          >
            Lediga uppgifter
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Stäng</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-samrum-accent"></div>
            <p className="text-samrum-muted mt-3">Laddar uppgifter...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-12 text-samrum-muted">
            {activeTab === 'mine'
              ? 'Du har inga tilldelade uppgifter just nu.'
              : 'Inga lediga uppgifter att ta.'}
          </div>
        )}

        {/* Task list */}
        {!loading && tasks.length > 0 && (
          <div className="bg-white border border-samrum-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-samrum-bg border-b border-samrum-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-samrum-text">Uppgift</th>
                  <th className="text-left px-4 py-3 font-medium text-samrum-text">Process</th>
                  <th className="text-left px-4 py-3 font-medium text-samrum-text">Skapad</th>
                  {activeTab === 'mine' && (
                    <th className="text-right px-4 py-3 font-medium text-samrum-text">Åtgärd</th>
                  )}
                  {activeTab === 'claimable' && (
                    <th className="text-right px-4 py-3 font-medium text-samrum-text">Åtgärd</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-samrum-border">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-samrum-bg/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenTask(task.id)}
                        className="text-samrum-blue hover:underline font-medium text-left"
                      >
                        {task.name}
                      </button>
                      <p className="text-xs text-samrum-muted mt-0.5">
                        {task.taskDefinitionKey}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-samrum-text">
                      {task.processName}
                    </td>
                    <td className="px-4 py-3 text-samrum-muted whitespace-nowrap">
                      {formatDate(task.created)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {activeTab === 'mine' ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleOpenTask(task.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-samrum-accent text-white rounded hover:bg-samrum-accent/90 transition-colors"
                          >
                            Öppna
                          </button>
                          <button
                            onClick={() => handleUnclaim(task.id)}
                            disabled={claiming === task.id}
                            className="px-3 py-1.5 text-xs font-medium border border-samrum-border text-samrum-muted rounded hover:bg-samrum-bg transition-colors disabled:opacity-50"
                          >
                            {claiming === task.id ? '...' : 'Släpp'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaim(task.id)}
                          disabled={claiming === task.id}
                          className="px-3 py-1.5 text-xs font-medium bg-samrum-blue text-white rounded hover:bg-samrum-blue/90 transition-colors disabled:opacity-50"
                        >
                          {claiming === task.id ? 'Tar...' : 'Ta uppgift'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Task count */}
        {!loading && tasks.length > 0 && (
          <p className="text-xs text-samrum-muted mt-3">
            {tasks.length} uppgift{tasks.length !== 1 ? 'er' : ''}
          </p>
        )}
      </div>
    </SamrumLayout>
  );
}
