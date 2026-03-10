/**
 * Processes Page — Processer
 * Shows available process definitions (with Start button) and running instances.
 */

import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, Process, ProcessInstance } from '@/lib/api';
import SamrumLayout from '@/components/SamrumLayout';
import Link from 'next/link';

type ViewTab = 'definitions' | 'instances';

export default function ProcessesPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [definitions, setDefinitions] = useState<Process[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('definitions');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadData();
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defs, insts] = await Promise.all([
        api.listProcesses(),
        api.listProcessInstances(),
      ]);
      setDefinitions(defs);
      setInstances(insts);
    } catch (err) {
      setError((err as Error).message || 'Kunde inte ladda processdata');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredDefs = definitions.filter(
    (d) =>
      !search ||
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.key.toLowerCase().includes(search.toLowerCase())
  );

  const filteredInstances = instances.filter(
    (i) =>
      !search ||
      i.processDefinitionKey?.toLowerCase().includes(search.toLowerCase()) ||
      i.processName?.toLowerCase().includes(search.toLowerCase()) ||
      i.id.toLowerCase().includes(search.toLowerCase())
  );

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

  if (!user) return null;

  return (
    <SamrumLayout>
      <Head>
        <title>Processer — Doorman</title>
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-samrum-text">Processer</h1>
            <p className="text-samrum-muted text-sm">Starta nya processer och följ pågående</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-sm bg-samrum-bg border border-samrum-border rounded hover:bg-gray-100"
          >
            ↻ Uppdatera
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Sök process..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-samrum-border rounded text-sm focus:ring-2 focus:ring-samrum-accent focus:border-samrum-accent"
        />

        {/* Tabs */}
        <div className="flex border-b border-samrum-border">
          <button
            onClick={() => setActiveTab('definitions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'definitions'
                ? 'border-samrum-accent text-samrum-accent'
                : 'border-transparent text-samrum-muted hover:text-samrum-text'
            }`}
          >
            Tillgängliga processer ({filteredDefs.length})
          </button>
          <button
            onClick={() => setActiveTab('instances')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'instances'
                ? 'border-samrum-accent text-samrum-accent'
                : 'border-transparent text-samrum-muted hover:text-samrum-text'
            }`}
          >
            Pågående instanser ({filteredInstances.length})
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Stäng</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-samrum-accent"></div>
            <p className="text-samrum-muted mt-3">Laddar processer...</p>
          </div>
        )}

        {/* Definitions tab */}
        {!loading && activeTab === 'definitions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDefs.length > 0 ? (
              filteredDefs.map((def) => (
                <div
                  key={def.id}
                  className="p-4 bg-white border border-samrum-border rounded-lg hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-samrum-text">{def.name || def.key}</h3>
                  <p className="text-xs text-samrum-muted font-mono mt-1">{def.key} v{def.version}</p>
                  {def.description && (
                    <p className="text-sm text-samrum-muted mt-2">{def.description}</p>
                  )}
                  <Link
                    href={`/start-process/${def.key}`}
                    className="mt-3 inline-block px-4 py-1.5 bg-samrum-accent text-white rounded hover:opacity-90 transition text-sm font-medium"
                  >
                    Starta
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-samrum-muted">
                {search ? 'Inga processer matchar sökningen.' : 'Inga processdefinitioner tillgängliga.'}
              </div>
            )}
          </div>
        )}

        {/* Instances tab */}
        {!loading && activeTab === 'instances' && (
          <>
            {filteredInstances.length > 0 ? (
              <div className="bg-white border border-samrum-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-samrum-bg border-b border-samrum-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-samrum-text">Process</th>
                      <th className="text-left px-4 py-3 font-medium text-samrum-text">Instans-ID</th>
                      <th className="text-left px-4 py-3 font-medium text-samrum-text">Startad</th>
                      <th className="text-right px-4 py-3 font-medium text-samrum-text">Åtgärd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-samrum-border">
                    {filteredInstances.map((inst) => (
                      <tr key={inst.id} className="hover:bg-samrum-bg/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-samrum-text">
                          {inst.processName || inst.processDefinitionKey}
                        </td>
                        <td className="px-4 py-3 text-samrum-muted font-mono text-xs">
                          {inst.id.substring(0, 16)}...
                        </td>
                        <td className="px-4 py-3 text-samrum-muted whitespace-nowrap">
                          {formatDate(inst.startTime)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/timeline?id=${inst.id}`}
                            className="text-samrum-blue hover:underline text-sm"
                          >
                            Tidslinje →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-samrum-muted">
                {search ? 'Inga instanser matchar sökningen.' : 'Inga pågående processinstanser.'}
              </div>
            )}
          </>
        )}

        {/* Summary stats */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white border border-samrum-border rounded-lg">
              <p className="text-xs text-samrum-muted uppercase font-medium">Processdefinitioner</p>
              <p className="text-2xl font-bold text-samrum-text mt-1">{definitions.length}</p>
            </div>
            <div className="p-4 bg-white border border-samrum-border rounded-lg">
              <p className="text-xs text-samrum-muted uppercase font-medium">Pågående instanser</p>
              <p className="text-2xl font-bold text-samrum-accent mt-1">{instances.length}</p>
            </div>
          </div>
        )}
      </div>
    </SamrumLayout>
  );
}
