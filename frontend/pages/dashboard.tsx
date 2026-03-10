/**
 * Dashboard — Användaröversikt
 * Main user portal: tasks, processes, quick links.
 */

import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, Process, Task } from '@/lib/api';
import SamrumLayout from '@/components/SamrumLayout';

interface QuickLinkProps {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

function QuickLink({ href, label, desc, icon, color }: QuickLinkProps) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-lg border border-samrum-border p-5 hover:shadow-panel transition-shadow cursor-pointer group">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors ${color}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 group-hover:text-samrum-blue transition-colors">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </div>
          <svg className="w-4 h-4 text-slate-400 group-hover:text-samrum-blue transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    loadDashboard();
  }, [user, router]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [procsData, tasksData] = await Promise.all([
        api.listProcesses(),
        api.listMyTasks({}),
      ]);
      setProcesses(procsData);
      setMyTasks(tasksData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <SamrumLayout>
      <Head>
        <title>Översikt — Doorman</title>
      </Head>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Page Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Översikt</h1>
              <p className="text-slate-500 mt-1">Välkommen, {user.name}</p>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="bg-samrum-blue/10 text-samrum-blue rounded-full p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{user.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.groups.map(g => (
                    <span key={g} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {g.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Stäng</button>
            </div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <QuickLink href="/tasks" label="Uppgifter" desc="Visa och hantera dina uppgifter"
              color="text-blue-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            />
            <QuickLink href="/processes" label="Processer" desc="Tillgängliga BPMN-processer"
              color="text-purple-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
            />
            <QuickLink href="/timeline" label="Tidslinje" desc="Processinstanser och aktiviteter"
              color="text-green-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <QuickLink href="/admin" label="Administration" desc="Objekttyper, moduler och relationer"
              color="text-amber-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <QuickLink href="/admin/import-export" label="Import / Export" desc="ID-uppsättningar och definitioner"
              color="text-rose-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
            />
            <QuickLink href="/select-project" label="Välj projekt" desc="Byt aktivt projekt"
              color="text-indigo-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
            />
          </div>

          {/* My Tasks */}
          <div className="bg-white rounded-lg border border-samrum-border overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-samrum-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Mina uppgifter</h2>
              <Link href="/tasks" className="text-xs text-samrum-blue font-medium hover:underline">Visa alla →</Link>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-samrum-blue" />
                <p className="text-sm text-slate-500 mt-2">Laddar...</p>
              </div>
            ) : myTasks.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {myTasks.slice(0, 5).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                      <div>
                        <p className="font-medium text-slate-900 group-hover:text-samrum-blue transition-colors">{task.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{task.processDefinitionKey}</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-samrum-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Inga uppgifter tilldelade just nu.
              </div>
            )}
          </div>

          {/* Available Processes */}
          <div className="bg-white rounded-lg border border-samrum-border overflow-hidden">
            <div className="px-6 py-4 border-b border-samrum-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Starta en process</h2>
              <Link href="/processes" className="text-xs text-samrum-blue font-medium hover:underline">Alla processer →</Link>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-samrum-blue" />
                <p className="text-sm text-slate-500 mt-2">Laddar...</p>
              </div>
            ) : processes.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {processes.map((process) => (
                  <div key={process.key} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium text-slate-900">{process.name}</p>
                      {process.description && <p className="text-xs text-slate-500 mt-0.5">{process.description}</p>}
                    </div>
                    <Link
                      href={`/start-process/${process.key}`}
                      className="px-3 py-1.5 bg-samrum-blue text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      Starta →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Inga processer tillgängliga.
              </div>
            )}
          </div>
        </div>
      </div>
    </SamrumLayout>
  );
}
