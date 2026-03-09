/**
 * /objects/new — A001 Lägg till objekt
 * Creates a new object instance using the field definitions from a module (or OMS type).
 * Query params:
 *   ?module=<moduleId>   — load columns from module_view_columns (preferred)
 *   ?type=<typeId>       — load columns from object_attributes (fallback)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import SamrumLayout from '../../components/SamrumLayout';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

interface ColumnDef {
  key: string;
  label: string;
  type: string;
  col_order: number;
  is_required: boolean;
  is_editable: boolean;
  oms_attribute_id: number | null;
  enum_values: string[] | null;
}

interface ModuleInfo {
  id: number;
  name: string;
}

interface OmsType {
  id: number;
  name: string;
}

// ─── Field input ──────────────────────────────────────────────────────────────

function FieldInput({
  col,
  value,
  onChange,
}: {
  col: ColumnDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = 'w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white';

  if (col.type === 'boolean') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        <option value="true">Ja</option>
        <option value="false">Nej</option>
      </select>
    );
  }
  if (col.type === 'text' && col.enum_values && col.enum_values.length > 0) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        {col.enum_values.map(ev => <option key={ev} value={ev}>{ev}</option>)}
      </select>
    );
  }
  if (col.type === 'number') {
    return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="EJ ANGIVET" className={cls} />;
  }
  if (col.type === 'date') {
    return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  if (col.type === 'file') {
    return <span className="text-sm text-slate-400 italic">Filuppladdning ej tillgänglig</span>;
  }
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="EJ ANGIVET" className={cls} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewObjectPage() {
  const router = useRouter();
  const { module: moduleParam, type: typeParam } = router.query;
  const moduleId = moduleParam ? Number(moduleParam) : null;

  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [omsType, setOmsType] = useState<OmsType | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [idColumnLabel, setIdColumnLabel] = useState('Objekt-ID');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [externalId, setExternalId] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({});

  const setFieldValue = (attrId: number, v: string) =>
    setFieldValues(prev => ({ ...prev, [attrId]: v }));

  const getFieldValue = (attrId: number | null) =>
    attrId !== null ? (fieldValues[attrId] ?? '') : '';

  // Load column definitions
  useEffect(() => {
    if (!router.isReady) return;
    if (!moduleId && !typeParam) {
      setError('Modul-ID eller typID krävs. Lägg till ?module=X eller ?type=X i URL:en.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (moduleId) {
      fetch(`${API_URL}/api/admin/modules/${moduleId}/columns`, { headers })
        .then(r => r.json())
        .then(d => {
          if (!d.success) throw new Error(d.error ?? 'Okänt fel');
          setModuleInfo(d.module);
          setOmsType(d.oms_object_type);
          setIdColumnLabel(d.id_column_label ?? 'Objekt-ID');
          setColumns((d.columns as ColumnDef[]).filter(c => c.type !== 'reference' && c.type !== 'file'));
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    } else {
      const tid = Number(typeParam);
      fetch(`${API_URL}/api/objects/types`, { headers })
        .then(r => r.json())
        .then(d => {
          const t = (d.data ?? []).find((x: OmsType) => x.id === tid);
          if (t) setOmsType(t);
        });
      // fall back: load attrs for this type directly
      fetch(`${API_URL}/api/objects/attributes?type=${tid}`, { headers })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setColumns((d.data ?? []).map((a: any) => ({
              key: a.attribute_name,
              label: a.attribute_name,
              type: a.attribute_type || 'text',
              col_order: 0,
              is_required: a.is_required,
              is_editable: true,
              oms_attribute_id: a.id,
              enum_values: a.enum_values || null,
            })));
          }
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    }
  }, [router.isReady, moduleId, typeParam]);

  const backHref = moduleId ? `/admin/modules/${moduleId}` : '/admin/modules';

  const handleSave = useCallback(async (andClose = false) => {
    if (!omsType) return;
    setSaving(true);
    setError(null);
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Build attribute_values_by_id — only non-empty values
    const attribute_values_by_id: Record<number, string> = {};
    for (const col of columns) {
      if (col.oms_attribute_id !== null) {
        const v = getFieldValue(col.oms_attribute_id);
        if (v.trim() !== '') attribute_values_by_id[col.oms_attribute_id] = v;
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/objects/instances`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          object_type_id: omsType.id,
          external_id: externalId.trim() || null,
          name: name.trim() || null,
          is_active: isActive,
          attribute_values_by_id,
        }),
      });
      const d = await res.json();
      if (d.success) {
        const detailHref = moduleId
          ? `/objects/${d.id}?module=${moduleId}`
          : `/objects/${d.id}`;
        if (andClose) {
          router.push(backHref);
        } else {
          router.push(detailHref);
        }
      } else {
        setError(d.error ?? 'Kunde inte skapa objekt');
      }
    } catch {
      setError('Nätverksfel vid skapande');
    } finally {
      setSaving(false);
    }
  }, [omsType, columns, externalId, name, isActive, fieldValues, moduleId, backHref, router]);

  const handleRevert = () => {
    setExternalId('');
    setName('');
    setIsActive(true);
    setFieldValues({});
  };

  // Sidebar preview
  const leftPanel = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-green-50">
            <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-semibold text-green-700 truncate">
              {omsType?.name ?? '…'}: {externalId || <span className="italic text-green-400">Nytt objekt</span>}
            </span>
          </div>
          {/* Identity fields */}
          <div className="flex items-start gap-1 pl-6 pr-2 py-0.5 rounded hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-500 block truncate">{idColumnLabel}:</span>
              <span className={`text-xs block truncate ${externalId ? 'text-slate-700' : 'text-red-400 italic'}`}>
                {externalId || 'EJ ANGIVET'}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1 pl-6 pr-2 py-0.5 rounded hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-500 block truncate">Namn:</span>
              <span className={`text-xs block truncate ${name ? 'text-slate-700' : 'text-red-400 italic'}`}>
                {name || 'EJ ANGIVET'}
              </span>
            </div>
          </div>
          {/* Attribute fields */}
          {columns.map(col => {
            const val = getFieldValue(col.oms_attribute_id);
            return (
              <div key={col.key} className="flex items-start gap-1 pl-6 pr-2 py-0.5 rounded hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block truncate">{col.label}:</span>
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
  );

  return (
    <SamrumLayout sidebar={leftPanel} sidebarTitle="Projektvy">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            Nytt objekt
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
            onClick={() => router.push(backHref)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Avbryt
          </button>
          <button
            onClick={handleRevert}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            title="Återkall alla ändringar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Återkall
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !omsType}
            className="px-4 py-1.5 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            Spara och stäng
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !omsType}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Skapar...' : 'Spara'}
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
            <div className="mx-auto max-w-3xl px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm mb-4">
              {error}
            </div>
          )}

          {!loading && omsType && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  {moduleInfo && <><span>{moduleInfo.name}</span><span>›</span></>}
                  <span>{omsType.name}</span>
                  <span>›</span>
                  <span className="font-medium text-slate-800 italic">Nytt objekt</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {name || <span className="text-slate-300 italic">Nytt {omsType.name}</span>}
                </h1>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Skapar ny instans
                </span>
              </div>

              {/* Identity fields */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-700">Identitet</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-2 gap-4 px-5 py-2.5 items-center">
                    <label className="text-sm font-medium text-slate-600">
                      {idColumnLabel}:<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={externalId}
                      onChange={e => setExternalId(e.target.value)}
                      placeholder="t.ex. D-042"
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 px-5 py-2.5 items-center">
                    <label className="text-sm font-medium text-slate-600">Namn:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="t.ex. Entrédörr plan 1"
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Module attribute fields */}
              {columns.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-700">Egenskaper</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {columns.map(col => (
                      <div key={col.key} className="grid grid-cols-2 gap-4 px-5 py-2.5 items-center">
                        <label className="text-sm font-medium text-slate-600">
                          {col.label}:
                          {col.is_required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {col.oms_attribute_id !== null ? (
                          <FieldInput
                            col={col}
                            value={getFieldValue(col.oms_attribute_id)}
                            onChange={v => setFieldValue(col.oms_attribute_id!, v)}
                          />
                        ) : (
                          <span className="text-sm text-slate-300 italic">Ej mappad</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {columns.length === 0 && !loading && (
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-slate-400 italic text-sm">
                  Inga egenskaper definierade för denna modul
                </div>
              )}

              {/* Bottom save bar */}
              <div className="flex justify-end gap-3 pb-4">
                <button onClick={() => router.push(backHref)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  Avbryt
                </button>
                <button onClick={handleRevert} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  Återkall
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !omsType}
                  className="px-4 py-2 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  Spara och stäng
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !omsType}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Skapar...' : 'Spara'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
