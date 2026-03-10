import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, Process } from '@/lib/api';
import Layout from '@/components/Layout';

interface VariableField {
  name: string;
  value: string;
  type: string;
}

export default function StartProcessPage() {
  const router = useRouter();
  const { key } = router.query;
  const { user, setError } = useAppStore();
  const [process, setProcess] = useState<Process | null>(null);
  const [variables, setVariables] = useState<VariableField[]>([
    { name: 'buildingId', value: '', type: 'String' },
    { name: 'buildingName', value: '', type: 'String' },
  ]);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (key) loadProcess();
  }, [user, key]);

  async function loadProcess() {
    try {
      const processes = await api.listProcesses();
      const found = processes.find((p) => p.key === key);
      setProcess(found || null);
    } catch {
      // ignore
    }
  }

  function updateVariable(index: number, field: keyof VariableField, value: string) {
    setVariables((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addVariable() {
    setVariables((prev) => [...prev, { name: '', value: '', type: 'String' }]);
  }

  function removeVariable(index: number) {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    if (!key || starting) return;
    setStarting(true);
    setError(null);

    try {
      const vars: Record<string, { value: string; type: string }> = {};
      for (const v of variables) {
        if (v.name.trim()) {
          vars[v.name.trim()] = { value: v.value, type: v.type };
        }
      }

      const data = await api.startProcess(key as string, vars);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Kunde inte starta process');
    } finally {
      setStarting(false);
    }
  }

  if (!user) return null;

  return (
    <Layout>
      <Head>
        <title>Starta process — {process?.name || key} — Doorman</title>
      </Head>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Tillbaka
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Starta process: {process?.name || key}
          </h1>
          {process?.description && (
            <p className="text-gray-500 mt-1">{process.description}</p>
          )}
        </div>

        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-green-800">Processen startad!</h2>
            <p className="text-sm text-green-700 font-mono">ID: {result.id}</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/timeline')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
              >
                Visa tidslinje
              </button>
              <button
                onClick={() => router.push('/tasks')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-semibold"
              >
                Gå till uppgifter
              </button>
              <button
                onClick={() => { setResult(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-semibold"
              >
                Starta en till
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Processvariabler</h2>
            <p className="text-sm text-gray-500">
              Ange startvärden för processen. Lämna tomt om inga variabler behövs.
            </p>

            <div className="space-y-3">
              {variables.map((v, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Variabelnamn"
                    value={v.name}
                    onChange={(e) => updateVariable(i, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Värde"
                    value={v.value}
                    onChange={(e) => updateVariable(i, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={v.type}
                    onChange={(e) => updateVariable(i, 'type', e.target.value)}
                    className="w-28 px-2 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="String">String</option>
                    <option value="Boolean">Boolean</option>
                    <option value="Integer">Integer</option>
                    <option value="Long">Long</option>
                  </select>
                  <button
                    onClick={() => removeVariable(i)}
                    className="px-2 py-2 text-red-500 hover:text-red-700 text-sm"
                    title="Ta bort"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addVariable}
              className="text-sm text-blue-600 hover:underline"
            >
              + Lägg till variabel
            </button>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleStart}
                disabled={starting}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {starting ? 'Startar...' : 'Starta process'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
