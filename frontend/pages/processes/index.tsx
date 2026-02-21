/**
 * Processes List Page - Tier 2 (User Portal)
 * View all running Camunda processes with filtering and status tracking
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';

import Layout from '@/components/Layout';
import Link from 'next/link';

interface ProcessInstance {
  id: string;
  processDefinitionKey: string;
  state: string;
  startTime: string;
  endTime?: string;
  taskCount?: number;
  completedTaskCount?: number;
}

export default function ProcessesPage() {
  const router = useRouter();
  const { user, setIsLoading, setError } = useAppStore();
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessInstance[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'door-unlock' | 'door-maintenance'>('all');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadProcesses();
  }, [user, router]);

  async function loadProcesses() {
    setIsLoading(true);
    setError(null);
    try {
      // In real implementation, would call Camunda API
      // For now, using mock data
      const mockProcesses: ProcessInstance[] = [
        {
          id: 'proc-001',
          processDefinitionKey: 'door-unlock',
          state: 'ACTIVE',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          taskCount: 5,
          completedTaskCount: 2,
        },
        {
          id: 'proc-002',
          processDefinitionKey: 'door-maintenance',
          state: 'ACTIVE',
          startTime: new Date(Date.now() - 7200000).toISOString(),
          taskCount: 4,
          completedTaskCount: 1,
        },
        {
          id: 'proc-003',
          processDefinitionKey: 'door-unlock',
          state: 'COMPLETED',
          startTime: new Date(Date.now() - 86400000).toISOString(),
          endTime: new Date(Date.now() - 82800000).toISOString(),
          taskCount: 5,
          completedTaskCount: 5,
        },
      ];

      setProcesses(mockProcesses);

      // Apply filters
      let filtered = mockProcesses;

      if (statusFilter !== 'all') {
        filtered = filtered.filter((p) =>
          statusFilter === 'active' ? p.state === 'ACTIVE' : p.state === 'COMPLETED'
        );
      }

      if (typeFilter !== 'all') {
        filtered = filtered.filter((p) => p.processDefinitionKey === typeFilter);
      }

      setFilteredProcesses(filtered);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleFilterChange = () => {
    let filtered = processes;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) =>
        statusFilter === 'active' ? p.state === 'ACTIVE' : p.state === 'COMPLETED'
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.processDefinitionKey === typeFilter);
    }

    setFilteredProcesses(filtered);
  };

  useEffect(() => {
    handleFilterChange();
  }, [statusFilter, typeFilter]);

  if (!user) return null;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800';
      case 'TERMINATED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercent = (process: ProcessInstance) => {
    if (!process.taskCount) return 0;
    return Math.round((process.completedTaskCount || 0) / process.taskCount * 100);
  };

  return (
    <Layout>
      <Head>
        <title>Processes - Doorman</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Processes</h1>
          <p className="text-gray-500">Manage Camunda workflow processes</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Process Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Types</option>
                <option value="door-unlock">Door Unlock</option>
                <option value="door-maintenance">Door Maintenance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Process List */}
        <div className="space-y-4">
          {filteredProcesses.length > 0 ? (
            filteredProcesses.map((process) => (
              <div
                key={process.id}
                className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {process.processDefinitionKey.replace(/-/g, ' ').toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">{process.id}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStateColor(process.state)}`}>
                    {process.state}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 uppercase font-semibold">Started</p>
                    <p className="text-sm text-gray-900">
                      {new Date(process.startTime).toLocaleString()}
                    </p>
                  </div>
                  {process.endTime && (
                    <div>
                      <p className="text-sm text-gray-500 uppercase font-semibold">Completed</p>
                      <p className="text-sm text-gray-900">
                        {new Date(process.endTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 uppercase font-semibold">Progress</p>
                    <p className="text-sm text-gray-900">
                      {process.completedTaskCount || 0} of {process.taskCount || 0} tasks
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                {process.state === 'ACTIVE' && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${getProgressPercent(process)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action */}
                <div>
                  <Link
                    href={`/processes/${process.id}`}
                    className="text-primary hover:underline font-semibold text-sm"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 bg-white border border-gray-200 rounded-lg text-center">
              <p className="text-gray-500">No processes found matching your filters</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500 uppercase font-semibold">Total Processes</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{processes.length}</p>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500 uppercase font-semibold">Active</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {processes.filter((p) => p.state === 'ACTIVE').length}
            </p>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500 uppercase font-semibold">Completed</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {processes.filter((p) => p.state === 'COMPLETED').length}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
