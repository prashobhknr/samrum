import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

interface Field {
  key: string;
  label: string;
  type: string;
  col_order: number;
  is_required: boolean;
  is_editable: boolean;
  enum_values: string[] | null;
  oms_attribute_id: number | null;
  value: string | null;
}

interface RelatedInstance {
  link_id: number;
  id: number;
  external_id: string;
  name: string;
}

interface RelatedGroup {
  relationship_id: number;
  type_id: number;
  type_name: string;
  relationship_name: string | null;
  cardinality: string | null;
  instances: RelatedInstance[];
}

interface InstanceInfo {
  id: number;
  external_id: string;
  name: string;
  object_type_id: number;
  object_type_name: string;
  id_column_label: string;
  is_active: boolean;
  is_locked: boolean;
}

interface ModuleInfo {
  id: number;
  name: string;
}

interface DetailsData {
  instance: InstanceInfo;
  module: ModuleInfo | null;
  fields: Field[];
  related_groups: RelatedGroup[];
}

function ValueDisplay({ field }: { field: Field }) {
  const v = field.value;
  if (v === null || v === undefined || v.trim() === '') {
    return <span className="text-red-500 italic text-sm">EJ ANGIVET</span>;
  }
  if (field.type === 'boolean') {
    const isTrue = v === 'true' || v === '1' || v.toLowerCase() === 'ja';
    return isTrue
      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ja</span>
      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Nej</span>;
  }
  if (field.type === 'date') {
    try {
      return <span className="text-sm text-slate-800">{new Date(v).toLocaleDateString('sv-SE')}</span>;
    } catch { return <span className="text-sm text-slate-800">{v}</span>; }
  }
  return <span className="text-sm text-slate-800">{v}</span>;
}

export default function ObjectDetailPage() {
  const router = useRouter();
  const { id, module: moduleParam } = router.query;
  const moduleId = moduleParam ? Number(moduleParam) : null;

  const [data, setData] = useState<DetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const qs = moduleId ? `?module=${moduleId}` : '';
    fetch(`${API_URL}/api/objects/instances/${id}/details${qs}`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
        else setError(d.error ?? 'Okänt fel');
      })
      .catch(() => setError('Kunde inte ladda objekt'))
      .finally(() => setLoading(false));
  }, [id, moduleId]);

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm(`Radera "${data.instance.external_id} — ${data.instance.name}"?`)) return;
    setDeleting(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await fetch(`${API_URL}/api/objects/instances/${id}`, { method: 'DELETE', headers });
      router.back();
    } catch {
      alert('Kunde inte radera objektet');
      setDeleting(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    if (!confirm(`Kopiera "${data.instance.external_id}"? En ny kopia skapas och öppnas för redigering.`)) return;
    setCopying(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const r = await fetch(`${API_URL}/api/objects/instances/${id}/copy`, { method: 'POST', headers });
      const d = await r.json();
      if (d.success) {
        const editUrl = moduleId ? `/objects/${d.id}/edit?module=${moduleId}` : `/objects/${d.id}/edit`;
        router.push(editUrl);
      } else { alert('Kopieringen misslyckades'); }
    } catch { alert('Kunde inte kopiera objektet'); }
    finally { setCopying(false); }
  };

  const handleLock = async () => {
    if (!data) return;
    const newLocked = !data.instance.is_locked;
    if (newLocked && !confirm(`Lås "${data.instance.external_id}"? Låsta objekt kan inte redigeras.`)) return;
    setLocking(true);
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const r = await fetch(`${API_URL}/api/objects/instances/${id}/lock`, {
        method: 'PATCH', headers, body: JSON.stringify({ is_locked: newLocked }),
      });
      const d = await r.json();
      if (d.success) setData(prev => prev ? { ...prev, instance: { ...prev.instance, is_locked: d.is_locked } } : prev);
    } catch { alert('Kunde inte ändra låsstatus'); }
    finally { setLocking(false); }
  };

  const editHref = moduleId
    ? `/objects/${id}/edit?module=${moduleId}`
    : `/objects/${id}/edit`;

  const backHref = moduleId
    ? `/admin/modules/${moduleId}`
    : '/admin/modules';

  // Left sidebar: Projektvy tree
  const leftPanel = data ? (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          {/* Root node */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50">
            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-semibold text-blue-700 truncate">
              {data.instance.object_type_name}: {data.instance.external_id}
            </span>
          </div>

          {/* Scalar fields */}
          {data.fields.map(f => (
            <div key={f.key} className="flex items-start gap-1 pl-6 pr-2 py-0.5 rounded hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-500 block truncate">{f.label}:</span>
                <span className={`text-xs block truncate ${f.value ? 'text-slate-700' : 'text-red-400 italic'}`}>
                  {f.value || 'EJ ANGIVET'}
                </span>
              </div>
            </div>
          ))}

          {/* Reference groups */}
          {data.related_groups.map(g => (
            <div key={g.relationship_id}>
              <div className="flex items-center gap-1 pl-4 pr-2 py-1 mt-1">
                <span className="text-xs font-semibold text-slate-500 truncate">[{g.type_name}]</span>
              </div>
              {g.instances.map(inst => (
                <div key={inst.link_id} className="flex items-start gap-1 pl-8 pr-2 py-0.5 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600 truncate">{inst.external_id} {inst.name}</span>
                </div>
              ))}
              {g.instances.length === 0 && (
                <div className="pl-8 pr-2 py-0.5">
                  <span className="text-xs text-slate-300 italic">Inga kopplade</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <SamrumLayout sidebar={leftPanel ?? undefined} sidebarTitle="Projektvy">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
          <Link href={backHref} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </Link>
          <div className="flex-1" />
          {data && (
            <>
              <Link
                href={moduleId
                  ? `/objects/new?module=${moduleId}`
                  : data ? `/objects/new?type=${data.instance.object_type_id}` : '/admin/modules'
                }
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Skapa ny
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting || data.instance.is_locked}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Radera
              </button>
              <Link
                href={data.instance.is_locked ? '#' : editHref}
                onClick={e => data.instance.is_locked && e.preventDefault()}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  data.instance.is_locked
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Ändra
              </Link>
              <button
                onClick={handleCopy}
                disabled={copying}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {copying ? 'Kopierar...' : 'Kopiera'}
              </button>
              <button
                onClick={handleLock}
                disabled={locking}
                title={data.instance.is_locked ? 'Lås upp objekt' : 'Lås version (A010)'}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  data.instance.is_locked
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {data.instance.is_locked
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
                </svg>
                {data.instance.is_locked ? 'Lås upp' : 'Lås version'}
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="text-slate-400 text-sm">Laddar...</div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-3xl px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {data && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <span>{data.instance.object_type_name}</span>
                  <span>›</span>
                  <span className="font-medium text-slate-800">{data.instance.external_id}</span>
                  {data.module && (
                    <>
                      <span>›</span>
                      <span className="text-slate-500">{data.module.name}</span>
                    </>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{data.instance.name || data.instance.external_id}</h1>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 mr-2">
                  {data.instance.object_type_name}
                </span>
                {data.instance.is_active === false ? (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">Inaktivt</span>
                ) : (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-600 border border-green-200">Aktivt</span>
                )}
                {data.instance.is_locked && (
                  <span className="inline-flex items-center mt-1 ml-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Låst version
                  </span>
                )}
              </div>

              {/* Scalar fields: two-column table */}
              {data.fields.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-700">Egenskaper</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {data.fields.map(f => (
                      <div key={f.key} className="grid grid-cols-2 gap-4 px-5 py-2.5 hover:bg-slate-50/50">
                        <div className="text-sm font-medium text-slate-600">{f.label}:</div>
                        <div><ValueDisplay field={f} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related object sub-sections */}
              {data.related_groups.map(g => (
                <div key={g.relationship_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-700">{g.type_name}</h2>
                    {g.relationship_name && (
                      <span className="text-xs text-slate-400 italic">({g.relationship_name.replace(/_/g, ' ')})</span>
                    )}
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                      {g.instances.length}
                    </span>
                  </div>
                  {g.instances.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {g.instances.map(inst => (
                        <div key={inst.link_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/50">
                          <Link
                            href={`/objects/${inst.id}`}
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            {inst.external_id}
                          </Link>
                          <span className="text-sm text-slate-600">{inst.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-sm text-slate-400 italic">
                      Inga kopplade objekt
                    </div>
                  )}
                </div>
              ))}

              {data.fields.length === 0 && data.related_groups.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-slate-400 italic text-sm">
                  Inga egenskaper hittades
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
