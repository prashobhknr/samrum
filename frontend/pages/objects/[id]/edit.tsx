import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SamrumLayout from '../../../components/SamrumLayout';
import { getStoredToken } from '../../../lib/auth';

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

export default function ObjectEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [obj, setObj] = useState<ObjectInstance | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API_URL}/api/objects/instances/${id}`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setObj(d.data);
          // Build initial form values from attributes
          const vals: Record<string, string> = {};
          (d.data.attributes ?? []).forEach((a: Attribute) => {
            vals[a.attribute_name] = a.value ?? '';
          });
          setFormValues(vals);
        } else {
          setError(d.error ?? 'Okänt fel');
        }
      })
      .catch(() => setError('Kunde inte ladda objekt'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!obj) return;
    setSaving(true);
    const token = getStoredToken();
    try {
      const res = await fetch(`${API_URL}/api/objects/instances/${obj.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          attribute_values: formValues,
        }),
      });
      const d = await res.json();
      if (d.success) {
        router.push(`/objects/${id}`);
      } else {
        alert('Kunde inte spara: ' + (d.error ?? 'Okänt fel'));
      }
    } catch {
      alert('Nätverksfel vid sparande');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/objects/${id}`);
  };

  // Left panel: attribute tree (same as read view)
  const leftPanel = obj ? (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50">
            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 12l5-5 5 5" />
            </svg>
            <span className="text-xs font-semibold text-blue-700 truncate">
              {obj.object_type}: {obj.external_id}
            </span>
          </div>
          {(obj.attributes ?? []).map(attr => (
            <div key={attr.attribute_id} className="flex items-start gap-1 pl-6 pr-2 py-1 rounded hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-500 block truncate">{toLabel(attr.attribute_name)}:</span>
                <span className={`text-xs block truncate ${formValues[attr.attribute_name] ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                  {formValues[attr.attribute_name] || 'EJ ANGIVET'}
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
          <span className="text-sm text-slate-500">Redigerar objekt</span>
          <div className="flex-1" />
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
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
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Redigeringsläge
                </span>
              </div>

              {/* Edit form */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-700">Egenskaper</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {(obj.attributes ?? []).map(attr => (
                    <div key={attr.attribute_id} className="grid grid-cols-2 gap-4 px-5 py-3 items-center">
                      <label
                        htmlFor={`attr-${attr.attribute_id}`}
                        className="text-sm font-medium text-slate-600"
                      >
                        {toLabel(attr.attribute_name)}:
                      </label>
                      <input
                        id={`attr-${attr.attribute_id}`}
                        type="text"
                        value={formValues[attr.attribute_name] ?? ''}
                        onChange={e =>
                          setFormValues(prev => ({
                            ...prev,
                            [attr.attribute_name]: e.target.value,
                          }))
                        }
                        placeholder="EJ ANGIVET"
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      />
                    </div>
                  ))}
                  {(!obj.attributes || obj.attributes.length === 0) && (
                    <div className="px-5 py-8 text-center text-slate-400 italic text-sm">
                      Inga egenskaper hittades
                    </div>
                  )}
                </div>
              </div>

              {/* Save bar */}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
