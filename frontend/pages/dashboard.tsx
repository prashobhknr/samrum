/**
 * Phase 4: Dashboard Page (Tier 2 - Process Portal)
 * 
 * Main user portal showing:
 * - Available processes
 * - My tasks
 * - Recent doors
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, Process, Task, DoorInstance } from '@/lib/api';
import Layout from '@/components/Layout';

export default function DashboardPage() {
  const router = useRouter();
  const { user, setIsLoading, setError } = useAppStore();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [recentDoors, setRecentDoors] = useState<DoorInstance[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadDashboard();
  }, [user, router]);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      // Load available processes
      const procsData = await api.listProcesses();
      setProcesses(procsData);

      // Load user's tasks
      const tasksData = await api.listMyTasks(user?.groups[0] || 'locksmiths');
      setMyTasks(tasksData);

      // Load recent doors
      const doorsData = await api.listDoors(5, 0);
      setRecentDoors(doorsData.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Layout>
      <Head>
        <title>Dashboard - Doorman Portal</title>
      </Head>

      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 rounded-lg">
          <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
          <p className="mt-2 opacity-90">Your role: {user.groups.join(', ')}</p>
        </div>

        {/* My Tasks */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">My Tasks</h2>
          {myTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg hover:border-primary transition"
                >
                  <h3 className="font-semibold text-gray-900">{task.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">ID: {task.id}</p>
                  <p className="text-sm text-gray-500">Process: {task.processDefinitionKey}</p>
                  <button className="mt-4 text-primary font-semibold hover:underline">
                    Open Task →
                  </button>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              No tasks assigned to you at the moment.
            </div>
          )}
        </div>

        {/* Available Processes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Start a Process</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processes.length > 0 ? (
              processes.map((process) => (
                <div
                  key={process.key}
                  className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition"
                >
                  <h3 className="font-semibold text-gray-900">{process.name}</h3>
                  {process.description && (
                    <p className="text-sm text-gray-600 mt-2">{process.description}</p>
                  )}
                  <Link
                    href={`/start-process/${process.key}`}
                    className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded hover:bg-blue-700 transition font-semibold"
                  >
                    Start Process
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-2 p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                No processes available.
              </div>
            )}
          </div>
        </div>

        {/* Recent Doors */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Doors</h2>
          {recentDoors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">Door ID</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">Fire Class</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentDoors.map((door) => {
                    const status = door.attributes.find((a) => a.attribute_name === 'status');
                    return (
                      <tr key={door.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono text-sm">{door.external_id}</td>
                        <td className="px-6 py-3 text-sm">{door.name}</td>
                        <td className="px-6 py-3 text-sm">
                          {door.attributes.find((a) => a.attribute_name === 'fire_class')?.value || '-'}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            {status?.value || 'operational'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              No doors found.
            </div>
          )}
          <Link
            href="/doors"
            className="mt-4 inline-block text-primary font-semibold hover:underline"
          >
            View All Doors →
          </Link>
        </div>
      </div>
    </Layout>
  );
}
