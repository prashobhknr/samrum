import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

interface Attribute {
  attribute_id: number;
  attribute_name: string;
  value: string | null;
}

interface ObjectInstance {
  id: number;
  external_id: string;
  name: string;
  object_type: string;
  attributes: Attribute[];
}

function toLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function ValueDisplay({ value }: { value: string | null | undefined }) {
  if (!value || value.trim() === '') {
    return <span className="text-slate-400 italic text-sm">EJ ANGIVET</span>;
  }
  return <span className="text-sm text-slate-800">{value}</span>;
}

export default function ObjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [obj, setObj] = useState<ObjectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API_URL}/api/objects/instances/${id}`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) setObj(d.data);
        else setError(d.error ?? 'Okänt fel');
      })
      .catch(() => setError('Kunde inte ladda objekt'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!obj) return;
    if (!confirm(`Radera "${obj.external_id} — ${obj.name}"?`)) return;
    setDeleting(true);
    try {
      const token = getStoredToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
      await fetch(`${API_URL}/api/objects/instances/${obj.id}`, { method: 'DELETE', headers });
      router.back();
    } catch {
      alert('Kunde inte radera objektet');
      setDeleting(false);
    }
  };

  // Left panel: attribute tree
  const leftPanel = obj ? (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          {/* Root node */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50">
            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 12l5-5 5 5" />
            </svg>
            <span className="text-xs font-semibold text-blue-700 truncate">
              {obj.object_type}: {obj.external_id}
            </span>
          </div>
          {/* Attributes */}
          {(obj.attributes ?? []).map(attr => (
            <div key={attr.attribute_id} className="flex items-start gap-1 pl-6 pr-2 py-1 rounded hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-500 block truncate">{toLabel(attr.attribute_name)}:</span>
                <span className={`text-xs block truncate ${attr.value ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                  {attr.value ?? 'EJ ANGIVET'}
                </span>
              </div>
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
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
          <Link href="/admin/modules" className="text-sm text-slate-500 hover:text-slate-700">← Tillbaka</Link>
          <div className="flex-1" />
          {obj && (
            <>
              <Link
                href={`/objects/${id}/edit`}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ändra
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Radera
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
            <div className="mx-auto max-w-2xl px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {obj && (
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <span>{obj.object_type}</span>
                  <span>›</span>
                  <span className="font-medium text-slate-800">{obj.external_id}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{obj.name || obj.external_id}</h1>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                  {obj.object_type}
                </span>
              </div>

              {/* Attribute grid */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-700">Egenskaper</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {(obj.attributes ?? []).map(attr => (
                    <div key={attr.attribute_id} className="grid grid-cols-2 gap-4 px-5 py-3 hover:bg-slate-50/50">
                      <div className="text-sm font-medium text-slate-600">{toLabel(attr.attribute_name)}:</div>
                      <div><ValueDisplay value={attr.value} /></div>
                    </div>
                  ))}
                  {(!obj.attributes || obj.attributes.length === 0) && (
                    <div className="px-5 py-8 text-center text-slate-400 italic text-sm">
                      Inga egenskaper hittades
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
