/**
 * /objects/bulk-edit — A001 Ändra objekt (gruppvis ändring)
 * Full-page bulk/group edit: select which fields to update via per-field checkboxes,
 * then apply to all selected object instances.
 *
 * Query params:
 *   ?module=<moduleId>   — load column definitions for this module
 *   ?ids=12,13,14        — comma-separated list of instance IDs to update
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

// ─── Typed field input ────────────────────────────────────────────────────────

function FieldInput({
  col,
  value,
  disabled,
  onChange,
}: {
  col: ColumnDef;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const cls = `w-full px-3 py-1.5 text-sm border rounded-lg transition-colors focus:outline-none ${
    disabled
      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
      : 'border-slate-300 bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
  }`;

  if (col.type === 'boolean') {
    return (
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        <option value="true">Ja</option>
        <option value="false">Nej</option>
      </select>
    );
  }
  if (col.type === 'text' && col.enum_values && col.enum_values.length > 0) {
    return (
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— EJ ANGIVET —</option>
        {col.enum_values.map(ev => <option key={ev} value={ev}>{ev}</option>)}
      </select>
    );
  }
  if (col.type === 'number') {
    return <input type="number" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder="Inget val har gjorts" className={cls} />;
  }
  if (col.type === 'date') {
    return <input type="date" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  if (col.type === 'file') {
    return <span className="text-sm text-slate-400 italic">Filuppladdning ej tillgänglig</span>;
  }
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      placeholder={disabled ? 'Inget val har gjorts' : 'EJ ANGIVET'}
      className={cls}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkEditPage() {
  const router = useRouter();
  const { module: moduleParam, ids: idsParam } = router.query;
  const moduleId = moduleParam ? Number(moduleParam) : null;
  const selectedIds: number[] = idsParam
    ? String(idsParam).split(',').map(Number).filter(Boolean)
    : [];

  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Per-field: checked = will be updated, values = what to set
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<number, string>>({});

  // Aktivt toggle — null = don't change, true/false = set for all
  const [isActiveChange, setIsActiveChange] = useState<string>(''); // '' | 'true' | 'false'

  const backHref = moduleId ? `/admin/modules/${moduleId}` : '/admin/modules';

  useEffect(() => {
    if (!router.isReady || !moduleId) return;
    setLoading(true);
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`${API_URL}/api/admin/modules/${moduleId}/columns`, { headers })
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error ?? 'Okänt fel');
        setModuleInfo(d.module);
        // Only include editable non-reference columns
        const cols = (d.columns as ColumnDef[]).filter(
          c => c.is_editable && c.oms_attribute_id !== null && c.type !== 'reference' && c.type !== 'file'
        );
        setColumns(cols);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router.isReady, moduleId]);

  const toggleField = (key: string) =>
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const setValue = (attrId: number, v: string) =>
    setValues(prev => ({ ...prev, [attrId]: v }));

  const checkedCount = columns.filter(c => checked[c.key]).length;

  const handleSave = useCallback(async (andClose = false) => {
    if (selectedIds.length === 0) { setError('Inga objekt valda'); return; }

    // Build attribute_values_by_id — only checked + mapped fields
    const attribute_values_by_id: Record<number, string | null> = {};
    for (const col of columns) {
      if (checked[col.key] && col.oms_attribute_id !== null) {
        attribute_values_by_id[col.oms_attribute_id] = values[col.oms_attribute_id] ?? null;
      }
    }

    if (checkedCount === 0 && isActiveChange === '') {
      setError('Markera minst ett fält att ändra');
      return;
    }

    setSaving(true);
    setError(null);
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: Record<string, unknown> = {
      ids: selectedIds,
      attribute_values_by_id,
    };
    if (isActiveChange !== '') body.is_active = isActiveChange === 'true';

    try {
      const res = await fetch(`${API_URL}/api/objects/instances/bulk-update`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setSaved(true);
        if (andClose) router.push(backHref);
      } else {
        setError(d.error ?? 'Kunde inte spara');
      }
    } catch {
      setError('Nätverksfel vid sparande');
    } finally {
      setSaving(false);
    }
  }, [selectedIds, columns, checked, values, isActiveChange, checkedCount, backHref, router]);

  const handleRevert = () => {
    setChecked({});
    setValues({});
    setIsActiveChange('');
    setSaved(false);
    setError(null);
  };

  // Left sidebar: shows count + which fields are being changed
  const leftPanel = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projektvy</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          {/* Root node: selected count */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50">
            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs font-semibold text-blue-700 truncate">
              {selectedIds.length} objekt valda
            </span>
          </div>

          {/* Module */}
          {moduleInfo && (
            <div className="flex items-center gap-1 px-2 py-1 rounded">
              <span className="text-xs text-slate-400 truncate">{moduleInfo.name}</span>
            </div>
          )}

          {/* Checked fields preview */}
          {checkedCount > 0 && (
            <>
              <div className="px-2 pt-2 pb-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ändras</span>
              </div>
              {columns.filter(c => checked[c.key]).map(col => {
                const val = col.oms_attribute_id !== null ? (values[col.oms_attribute_id] ?? '') : '';
                return (
                  <div key={col.key} className="flex items-start gap-1 pl-5 pr-2 py-0.5 rounded bg-amber-50/60">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-500 block truncate">{col.label}:</span>
                      <span className={`text-xs block truncate font-medium ${val ? 'text-amber-700' : 'text-slate-400 italic'}`}>
                        {val || 'EJ ANGIVET'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {isActiveChange !== '' && (
            <div className="flex items-start gap-1 pl-5 pr-2 py-0.5 rounded bg-amber-50/60">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-500 block">Aktivt:</span>
                <span className="text-xs font-medium text-amber-700">{isActiveChange === 'true' ? 'Ja' : 'Nej'}</span>
              </div>
            </div>
          )}

          {checkedCount === 0 && isActiveChange === '' && (
            <div className="px-2 py-3">
              <span className="text-xs text-slate-400 italic">Inga fält markerade ännu</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <SamrumLayout sidebar={leftPanel} sidebarTitle="Projektvy">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            Gruppvis ändring
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
            {selectedIds.length} objekt valda
          </span>

          {/* Aktivt toggle */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-slate-500">Aktivt:</span>
            <select
              value={isActiveChange}
              onChange={e => setIsActiveChange(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="">— Ej ändra —</option>
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
            title="Återkall — avmarkera alla fält"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Återkall
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
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

          {!loading && selectedIds.length === 0 && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-6 text-center">
                <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800 font-medium mb-1">Inga objekt valda</p>
                <p className="text-xs text-amber-700">Välj objekt i listan innan du öppnar Gruppvis ändring.</p>
                <button onClick={() => router.push(backHref)} className="mt-3 text-sm text-amber-700 underline hover:text-amber-900">
                  Tillbaka till listan
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-3xl mx-auto mb-4 px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
              {error}
            </div>
          )}

          {saved && !error && (
            <div className="max-w-3xl mx-auto mb-4 px-4 py-3 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sparad! {selectedIds.length} objekt uppdaterade.
            </div>
          )}

          {!loading && selectedIds.length > 0 && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  {moduleInfo && <span>{moduleInfo.name}</span>}
                </div>
                <h1 className="text-xl font-bold text-slate-900">Gruppvis ändring</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Markera de fält du vill ändra. Endast markerade fält uppdateras för samtliga{' '}
                  <span className="font-semibold text-slate-700">{selectedIds.length} valda objekt</span>.
                </p>
              </div>

              {/* Info banner (matches page 20 top) */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 text-xs text-amber-800">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Ändrar ett attribut för de markerade objekten. Kryssa i fältet till vänster om etiketten för att aktivera det.</span>
              </div>

              {/* Field rows with checkboxes */}
              {columns.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-[24px_1fr_1fr] gap-4">
                    <div />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fält</span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nytt värde</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {columns.map(col => {
                      const isChecked = !!checked[col.key];
                      const attrId = col.oms_attribute_id!;
                      const val = values[attrId] ?? '';
                      return (
                        <div
                          key={col.key}
                          className={`grid grid-cols-[24px_1fr_1fr] gap-4 px-5 py-2.5 items-center transition-colors ${
                            isChecked ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleField(col.key)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                            />
                          </div>

                          {/* Label */}
                          <label
                            className={`text-sm cursor-pointer select-none ${
                              isChecked ? 'font-semibold text-slate-800' : 'font-medium text-slate-500'
                            }`}
                            onClick={() => toggleField(col.key)}
                          >
                            {col.label}:
                            {col.is_required && isChecked && <span className="text-red-500 ml-0.5">*</span>}
                          </label>

                          {/* Input */}
                          <FieldInput
                            col={col}
                            value={val}
                            disabled={!isChecked}
                            onChange={v => setValue(attrId, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-slate-400 italic text-sm">
                  Inga redigerbara egenskaper hittades för denna modul
                </div>
              )}

              {/* Summary */}
              {checkedCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                  <span className="font-semibold">{checkedCount} fält</span> markerade att ändra för{' '}
                  <span className="font-semibold">{selectedIds.length} objekt</span>.
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
                  {saving ? 'Sparar...' : `Spara för ${selectedIds.length} objekt`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
