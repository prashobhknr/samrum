import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import SamrumLayout from '../../../components/SamrumLayout';
import { getStoredToken } from '../../../lib/auth';

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
  is_active: boolean;
  object_type_name: string;
  id_column_label: string;
}

interface TypeInstance {
  id: number;
  external_id: string;
  name: string;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = 'w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';

  if (!field.is_editable) {
    return <span className="text-sm text-slate-400 italic">{value || 'EJ ANGIVET'}</span>;
  }

  if (field.type === 'boolean') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        <option value="true">Ja</option>
        <option value="false">Nej</option>
      </select>
    );
  }

  if (field.type === 'text' && field.enum_values && field.enum_values.length > 0) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        {field.enum_values.map(ev => (
          <option key={ev} value={ev}>{ev}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="EJ ANGIVET"
        className={cls}
      />
    );
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cls}
      />
    );
  }

  if (field.type === 'file') {
    return <span className="text-sm text-slate-400 italic">Filuppladdning ej tillgänglig</span>;
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="EJ ANGIVET"
      className={cls}
    />
  );
}

interface RelatedGroupEditorProps {
  group: RelatedGroup;
  parentId: number;
  onUpdated: () => void;
}

function RelatedGroupEditor({ group, parentId, onUpdated }: RelatedGroupEditorProps) {
  const [typeInstances, setTypeInstances] = useState<TypeInstance[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const openPicker = useCallback(async () => {
    if (typeInstances.length === 0) {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(`${API_URL}/api/objects/types/${group.type_id}/instances`, { headers });
      const d = await r.json();
      if (d.success) setTypeInstances(d.data);
    }
    setSearch('');
    setPickerOpen(true);
  }, [group.type_id, typeInstances.length]);

  const handleAdd = async (childId: number) => {
    setBusy(true);
    setPickerOpen(false);
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await fetch(`${API_URL}/api/objects/instances/${parentId}/relationships`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ child_instance_id: childId, relationship_id: group.relationship_id }),
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (linkId: number) => {
    if (!confirm('Ta bort kopplingen?')) return;
    setBusy(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await fetch(`${API_URL}/api/objects/instances/${parentId}/relationships/${linkId}`, {
        method: 'DELETE',
        headers,
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const filtered = typeInstances.filter(i =>
    !search || i.external_id.toLowerCase().includes(search.toLowerCase()) || (i.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{group.type_name}</h2>
        {group.relationship_name && (
          <span className="text-xs text-slate-400 italic">({group.relationship_name.replace(/_/g, ' ')})</span>
        )}
        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
          {group.instances.length}
        </span>
      </div>

      {group.instances.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {group.instances.map(inst => (
            <div key={inst.link_id} className="flex items-center gap-3 px-5 py-2 hover:bg-slate-50/50">
              <span className="text-sm font-medium text-slate-700">{inst.external_id}</span>
              <span className="text-sm text-slate-500 flex-1">{inst.name}</span>
              <button
                onClick={() => handleRemove(inst.link_id)}
                disabled={busy}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-0.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Koppla bort"
              >
                Koppla bort
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-3 text-sm text-slate-400 italic">Inga kopplade objekt</div>
      )}

      {/* Add button */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={openPicker}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Lägg till {group.type_name}
        </button>
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setPickerOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[480px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <h3 className="font-semibold text-slate-800 text-sm">Välj {group.type_name}</h3>
              <button onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-2 border-b border-slate-100">
              <input
                type="text"
                placeholder="Sök..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-slate-400 text-sm italic">Inga objekt hittades</div>
              )}
              {filtered.map(inst => {
                const alreadyLinked = group.instances.some(i => i.id === inst.id);
                return (
                  <button
                    key={inst.id}
                    onClick={() => !alreadyLinked && handleAdd(inst.id)}
                    disabled={alreadyLinked}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-sm font-medium text-blue-600">{inst.external_id}</span>
                    <span className="text-sm text-slate-600 flex-1 truncate">{inst.name}</span>
                    {alreadyLinked && <span className="text-xs text-slate-400 italic">kopplad</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ObjectEditPage() {
  const router = useRouter();
  const { id, module: moduleParam } = router.query;
  const moduleId = moduleParam ? Number(moduleParam) : null;

  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [relatedGroups, setRelatedGroups] = useState<RelatedGroup[]>([]);
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [savedValues, setSavedValues] = useState<Record<number, string>>({});
  const [isActive, setIsActive] = useState(true);
  const [savedIsActive, setSavedIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
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
        if (d.success) {
          setInstance(d.instance);
          setFields(d.fields);
          setRelatedGroups(d.related_groups);
          const active = d.instance.is_active !== false;
          setIsActive(active);
          setSavedIsActive(active);
          // Init form values from current field values (keyed by oms_attribute_id)
          const vals: Record<number, string> = {};
          (d.fields as Field[]).forEach(f => {
            if (f.oms_attribute_id !== null) {
              vals[f.oms_attribute_id] = f.value ?? '';
            }
          });
          setFormValues(vals);
          setSavedValues({ ...vals });
        } else {
          setError(d.error ?? 'Okänt fel');
        }
      })
      .catch(() => setError('Kunde inte ladda objekt'))
      .finally(() => setLoading(false));
  }, [id, moduleId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getFieldValue = (f: Field): string => {
    if (f.oms_attribute_id !== null) return formValues[f.oms_attribute_id] ?? '';
    return '';
  };

  const setFieldValue = (f: Field, v: string) => {
    if (f.oms_attribute_id !== null) {
      setFormValues(prev => ({ ...prev, [f.oms_attribute_id!]: v }));
    }
  };

  const handleSave = async (andClose = false) => {
    if (!instance) return;
    setSaving(true);
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API_URL}/api/objects/instances/${instance.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ attribute_values_by_id: formValues, is_active: isActive }),
      });
      const d = await res.json();
      if (d.success) {
        if (andClose) {
          const backHref = moduleId ? `/objects/${id}?module=${moduleId}` : `/objects/${id}`;
          router.push(backHref);
        }
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
    const backHref = moduleId ? `/objects/${id}?module=${moduleId}` : `/objects/${id}`;
    router.push(backHref);
  };

  // Återkall — revert unsaved changes to last loaded values
  const handleRevert = () => {
    setFormValues({ ...savedValues });
    setIsActive(savedIsActive);
  };

  // Left sidebar: live preview of form values
  const leftPanel = instance ? (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-amber-50">
            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-xs font-semibold text-amber-700 truncate">
              {instance.object_type_name}: {instance.external_id}
            </span>
          </div>
          {fields.map(f => {
            const val = getFieldValue(f);
            return (
              <div key={f.key} className="flex items-start gap-1 pl-6 pr-2 py-0.5 rounded hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block truncate">{f.label}:</span>
                  <span className={`text-xs block truncate ${val ? 'text-slate-700' : 'text-red-400 italic'}`}>
                    {val || 'EJ ANGIVET'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <SamrumLayout sidebar={leftPanel ?? undefined} sidebarTitle="Projektvy">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            Ändringsläge
          </span>

          {/* Aktivt toggle */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-slate-500">Aktivt:</span>
            <select
              value={isActive ? 'true' : 'false'}
              onChange={e => setIsActive(e.target.value === 'true')}
              className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="true">Ja</option>
              <option value="false">Nej</option>
            </select>
          </div>

          <div className="flex-1" />
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Avbryt
          </button>
          <button
            onClick={handleRevert}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            title="Återkall — ångra alla ej sparade ändringar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Återkall
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            Spara och stäng
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
            <div className="mx-auto max-w-3xl px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {instance && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <span>{instance.object_type_name}</span>
                  <span>›</span>
                  <span className="font-medium text-slate-800">{instance.external_id}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{instance.name || instance.external_id}</h1>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Redigeringsläge
                </span>
              </div>

              {/* Edit form */}
              {fields.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-700">Egenskaper</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {fields.map(f => (
                      <div key={f.key} className="grid grid-cols-2 gap-4 px-5 py-2.5 items-center">
                        <label className="text-sm font-medium text-slate-600">
                          {f.label}:
                          {f.is_required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <FieldInput
                          field={f}
                          value={getFieldValue(f)}
                          onChange={v => setFieldValue(f, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related object sub-sections (edit mode) */}
              {relatedGroups.map(g => (
                <RelatedGroupEditor
                  key={g.relationship_id}
                  group={g}
                  parentId={instance.id}
                  onUpdated={loadData}
                />
              ))}

              {fields.length === 0 && relatedGroups.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-slate-400 italic text-sm">
                  Inga egenskaper hittades
                </div>
              )}

              {/* Bottom save bar */}
              <div className="flex justify-end gap-3 pb-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  Spara och stäng
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
