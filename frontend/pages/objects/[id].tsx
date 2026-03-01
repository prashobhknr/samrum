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
                disabled={deleting}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Radera
              </button>
              <Link
                href={editHref}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ändra
              </Link>
              <button
                onClick={() => alert('Kopiera')}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Kopiera
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
