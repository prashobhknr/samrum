import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../../components/SamrumLayout';
import Loading from '../../../components/Loading';
import { getStoredToken } from '../../../lib/auth';

const API = 'http://localhost:3000';

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ObjectType {
  id: number;
  name_singular: string;
  name_plural: string | null;
  data_type_id: number | null;
  data_type_name: string | null;
  is_abstract: boolean;
  exists_only_in_parent_scope: boolean;
  classification_id: number | null;
  classification_name: string | null;
  description: string | null;
  database_id: string | null;
  default_attr_caption: string | null;
  created_at: string;
  updated_at: string;
}

interface AttrRow {
  id: number;
  from_type_id: number;
  to_type_id: number;
  caption_singular: string | null;
  caption_plural: string | null;
  is_reference: boolean;
  ref_type_id: number | null;
  ref_type_name: string | null;
  data_type_name: string | null;
  type_name: string | null;
  min_relations: number;
  max_relations: number | null;
  allow_in_lists: boolean;
  show_in_lists_default: boolean;
  is_requirement: boolean;
  max_chars: number | null;
  copy_attribute: boolean;
  exists_only_in_parent: boolean;
  required_in_locked_version: boolean;
  sort_order: number | null;
  is_main_for_module: boolean;
  is_changeable: boolean;
  can_create: boolean;
  children?: AttrRow[];
  used_in_modules?: { module_id: number; module_name: string; allow_edit: boolean }[];
}

interface ModuleAssoc {
  id: number;
  module_id: number;
  module_name: string;
  folder_name: string | null;
  allow_edit: boolean;
  allow_insert: boolean;
  is_main_object_type: boolean;
  show_as_root: boolean;
}

interface Classification { id: number; name: string; }
interface PrimitiveType { id: number; name_singular: string; data_type_name: string | null; }
interface ObjTypeSummary { id: number; name_singular: string; database_id: string | null; }

// ─── Edit Object Type Modal ──────────────────────────────────────────────────

function EditModal({ ot, classifications, onClose, onSaved }: {
  ot: ObjectType;
  classifications: Classification[];
  onClose: () => void;
  onSaved: (updated: ObjectType) => void;
}) {
  const [form, setForm] = useState({
    name_singular: ot.name_singular,
    name_plural: ot.name_plural ?? '',
    database_id: ot.database_id ?? '',
    default_attr_caption: ot.default_attr_caption ?? '',
    classification_id: ot.classification_id != null ? String(ot.classification_id) : '',
    description: ot.description ?? '',
    is_abstract: ot.is_abstract,
    exists_only_in_parent_scope: ot.exists_only_in_parent_scope,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name_singular.trim()) { setError('Namn Singular krävs'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch(`${API}/api/admin/object-types/${ot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...form, classification_id: form.classification_id ? parseInt(form.classification_id) : null }),
      });
      const d = await r.json();
      if (d.success) { onSaved(d.data); onClose(); }
      else setError(d.error ?? 'Kunde inte spara');
    } catch { setError('Nätverksfel'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Ändra objekttyp</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {(['name_singular', 'name_plural', 'database_id', 'default_attr_caption'] as const).map(field => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field === 'name_singular' ? 'Namn Singular *' : field === 'name_plural' ? 'Namn Plural' : field === 'database_id' ? 'AdministrationsId' : 'Rubrik för Id'}
              </label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={form[field] as string}
                onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Klassificering</label>
            <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.classification_id}
              onChange={e => setForm(v => ({ ...v, classification_id: e.target.value }))}>
              <option value="">— Ingen —</option>
              {classifications.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivning</label>
            <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              rows={3} value={form.description}
              onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
          </div>
          <div className="flex gap-6">
            {(['is_abstract', 'exists_only_in_parent_scope'] as const).map(field => (
              <label key={field} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300"
                  checked={form[field]}
                  onChange={e => setForm(v => ({ ...v, [field]: e.target.checked }))} />
                {field === 'is_abstract' ? 'Är abstrakt typ' : 'Existerar bara med förälder'}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ref Type Picker ─────────────────────────────────────────────────────────

function RefTypePicker({ value, valueName, onChange }: {
  value: string;
  valueName: string;
  onChange: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ObjTypeSummary[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!search) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await fetch(
        `${API}/api/admin/object-types?search=${encodeURIComponent(search)}&complex=1&limit=20`,
        { headers: authHeaders() }
      ).then(r => r.json());
      setResults(r.data ?? []);
      setOpen(true);
    }, 250);
  }, [search]);

  const displayValue = value ? `${valueName}${value ? ` (ID: ${value})` : ''}` : search;

  return (
    <div ref={wrapRef} className="relative">
      <input
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        value={displayValue}
        placeholder="Sök objekttyp..."
        onChange={e => { onChange('', ''); setSearch(e.target.value); }}
        onFocus={() => { if (value) return; if (results.length) setOpen(true); }}
      />
      {value && (
        <button type="button" onClick={() => { onChange('', ''); setSearch(''); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(t => (
            <button key={t.id} type="button"
              onClick={() => { onChange(String(t.id), t.name_singular); setSearch(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700">
              {t.database_id ? <span className="text-slate-400 mr-1 font-mono text-xs">{t.database_id}</span> : null}
              {t.name_singular}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add / Edit Attribute Modal ───────────────────────────────────────────────

interface AttrFormState {
  caption_singular: string;
  caption_plural: string;
  exists_only_in_parent: boolean;
  attr_type: 'data' | 'reference';
  to_type_id: string;
  to_type_name: string;
  max_chars: string;
  min_relations: string;
  max_relations: string;
  is_requirement: boolean;
  allow_in_lists: boolean;
  show_in_lists_default: boolean;
  required_in_locked_version: boolean;
  copy_attribute: boolean;
}

const emptyAttrForm: AttrFormState = {
  caption_singular: '', caption_plural: '', exists_only_in_parent: false,
  attr_type: 'data', to_type_id: '', to_type_name: '',
  max_chars: '', min_relations: '0', max_relations: '1',
  is_requirement: false, allow_in_lists: true, show_in_lists_default: false,
  required_in_locked_version: false, copy_attribute: false,
};

interface ModuleAssoc {
  module_id: number;
  name: string;
  is_used: boolean;
  is_editable: boolean;
}

function AddEditAttrModal({ mode, typeId, existing, onClose, onSaved }: {
  mode: 'add' | 'edit';
  typeId: number;
  existing?: AttrRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AttrFormState>(() => {
    if (existing) {
      return {
        caption_singular: existing.caption_singular ?? '',
        caption_plural: existing.caption_plural ?? '',
        exists_only_in_parent: existing.exists_only_in_parent,
        attr_type: existing.is_reference ? 'reference' : 'data',
        to_type_id: String(existing.to_type_id),
        to_type_name: existing.is_reference ? (existing.ref_type_name ?? '') : (existing.type_name ?? ''),
        max_chars: existing.max_chars != null ? String(existing.max_chars) : '',
        min_relations: String(existing.min_relations),
        max_relations: existing.max_relations != null ? String(existing.max_relations) : '',
        is_requirement: existing.is_requirement,
        allow_in_lists: existing.allow_in_lists,
        show_in_lists_default: existing.show_in_lists_default,
        required_in_locked_version: existing.required_in_locked_version,
        copy_attribute: existing.copy_attribute,
      };
    }
    return emptyAttrForm;
  });

  const [primitiveTypes, setPrimitiveTypes] = useState<PrimitiveType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [moduleAssocs, setModuleAssocs] = useState<ModuleAssoc[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/object-types?primitive=1&limit=100`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setPrimitiveTypes(d.data ?? []))
      .catch(() => {});
  }, []);

  // Load per-module usage/editability for this attribute
  useEffect(() => {
    setModulesLoading(true);
    const relId = existing?.id ?? '';
    fetch(`${API}/api/admin/object-types/${typeId}/attribute-modules?rel_id=${relId}`,
      { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setModuleAssocs(d.data ?? []))
      .catch(() => {})
      .finally(() => setModulesLoading(false));
  }, [typeId, existing?.id]);

  const save = async () => {
    if (!form.caption_singular.trim()) { setError('Namn Singular krävs'); return; }
    if (!form.to_type_id) { setError('Välj typ'); return; }
    setSaving(true); setError('');
    try {
      const url = mode === 'add'
        ? `${API}/api/admin/object-types/${typeId}/attributes`
        : `${API}/api/admin/object-types/attributes/${existing!.id}`;
      const r = await fetch(url, {
        method: mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          caption_singular: form.caption_singular.trim() || null,
          caption_plural: form.caption_plural.trim() || null,
          to_type_id: parseInt(form.to_type_id),
          max_chars: form.max_chars ? parseInt(form.max_chars) : null,
          min_relations: parseInt(form.min_relations) || 0,
          max_relations: form.max_relations ? parseInt(form.max_relations) : null,
          is_requirement: form.is_requirement,
          allow_in_lists: form.allow_in_lists,
          show_in_lists_default: form.show_in_lists_default,
          required_in_locked_version: form.required_in_locked_version,
          copy_attribute: form.copy_attribute,
          exists_only_in_parent: form.exists_only_in_parent,
        }),
      });
      const d = await r.json();
      if (d.success) {
        // Sync module associations (Används i modul / Ändringsbar i modul)
        const relId = mode === 'add' ? d.data.id : existing!.id;
        if (moduleAssocs.length > 0) {
          await fetch(`${API}/api/admin/object-types/attributes/${relId}/modules`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ modules: moduleAssocs }),
          }).catch(() => {});
        }
        onSaved(); onClose();
      }
      else setError(d.error ?? 'Kunde inte spara');
    } catch { setError('Nätverksfel'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'add' ? 'Lägg till attribut' : 'Ändra attribut'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300"
              checked={form.exists_only_in_parent}
              onChange={e => setForm(v => ({ ...v, exists_only_in_parent: e.target.checked }))} />
            Existerar bara med sin förälder
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Namn Singular *', field: 'caption_singular' }, { label: 'Namn Plural', field: 'caption_plural' }].map(({ label, field }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={(form as unknown as Record<string, string>)[field]}
                  onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))} />
              </div>
            ))}
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Typ av attribut</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
              {[{ key: 'data', label: 'Datatyp' }, { key: 'reference', label: 'Referens till objekttyp' }].map(({ key, label }) => (
                <button key={key} type="button"
                  onClick={() => setForm(v => ({ ...v, attr_type: key as 'data' | 'reference', to_type_id: '', to_type_name: '' }))}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${form.attr_type === key ? 'bg-samrum-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.attr_type === 'data' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Datatyp *</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={form.to_type_id}
                onChange={e => {
                  const sel = primitiveTypes.find(t => String(t.id) === e.target.value);
                  setForm(v => ({ ...v, to_type_id: e.target.value, to_type_name: sel?.name_singular ?? '' }));
                }}>
                <option value="">— Välj datatyp —</option>
                {primitiveTypes.map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name_singular}{t.data_type_name ? ` (${t.data_type_name})` : ''}
                  </option>
                ))}
              </select>
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Max tecken</label>
                <input type="number" min={0} placeholder="Obegränsat"
                  className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={form.max_chars}
                  onChange={e => setForm(v => ({ ...v, max_chars: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Referens till objekttyp *</label>
                <RefTypePicker
                  value={form.to_type_id}
                  valueName={form.to_type_name}
                  onChange={(id, name) => setForm(v => ({ ...v, to_type_id: id, to_type_name: name }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Min antal', field: 'min_relations' }, { label: 'Max antal', field: 'max_relations' }].map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input type="number" min={0}
                      placeholder={field === 'max_relations' ? 'Obegränsat' : '0'}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={(form as unknown as Record<string, string>)[field]}
                      onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flag checkboxes */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Egenskaper</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { field: 'is_requirement', label: 'Måste anges' },
                { field: 'allow_in_lists', label: 'Kan visas' },
                { field: 'show_in_lists_default', label: 'Visas standard' },
                { field: 'required_in_locked_version', label: 'Krävas för låsning' },
                { field: 'copy_attribute', label: 'Kopieras' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300"
                    checked={(form as unknown as Record<string, boolean>)[field]}
                    onChange={e => setForm(v => ({ ...v, [field]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Module associations – Används i modul / Ändringsbar i modul */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider flex-1">
                Moduler
                {moduleAssocs.filter(m => m.is_used).length > 0 && (
                  <span className="ml-1 text-blue-600">
                    ({moduleAssocs.filter(m => m.is_used).length} aktiva)
                  </span>
                )}
              </p>
              {modulesLoading && <span className="text-[10px] text-slate-400 italic">Laddar...</span>}
            </div>
            {moduleAssocs.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_90px_110px] text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  <span>Modul</span>
                  <span className="text-center">Används i modul</span>
                  <span className="text-center">Ändringsbar i modul</span>
                </div>
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {moduleAssocs.map((m, i) => (
                    <div key={m.module_id}
                      className="grid grid-cols-[1fr_90px_110px] items-center px-3 py-1.5 hover:bg-slate-50">
                      <span className="text-xs text-slate-700 truncate" title={m.name}>{m.name}</span>
                      <div className="flex justify-center">
                        <input type="checkbox" className="rounded border-slate-300"
                          checked={m.is_used}
                          onChange={e => {
                            const used = e.target.checked;
                            setModuleAssocs(prev => prev.map((x, j) =>
                              j === i ? { ...x, is_used: used, is_editable: used ? x.is_editable : false } : x));
                          }} />
                      </div>
                      <div className="flex justify-center">
                        <input type="checkbox" className="rounded border-slate-300"
                          checked={m.is_editable}
                          disabled={!m.is_used}
                          onChange={e => setModuleAssocs(prev => prev.map((x, j) =>
                            j === i ? { ...x, is_editable: e.target.checked } : x))} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!modulesLoading && moduleAssocs.length === 0 && (
              <p className="text-xs text-slate-400 italic">Ingen modul använder denna objekttyp</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {saving ? 'Sparar...' : mode === 'add' ? 'Lägg till' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Simplified View ──────────────────────────────────────────────────────────

function SimplifiedAttrTable({ attrs, onEdit, onDelete, onReorder }: {
  attrs: AttrRow[];
  onEdit: (attr: AttrRow) => void;
  onDelete: (attr: AttrRow) => void;
  onReorder: (id: number, direction: 'up' | 'down') => void;
}) {
  // Expanded row keys: `${depth}-${attr.id}` — pre-expand all top-level refs
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    attrs.filter(a => a.is_reference).forEach(a => s.add(`0-${a.id}`));
    return s;
  });
  // Cache of fetched attrs keyed by ref_type_id; uses refs to avoid stale closures
  const cacheRef = useRef<Record<number, AttrRow[]>>({});
  const loadingRef = useRef<Set<number>>(new Set());
  const [, forceRender] = useState(0);

  const fetchRefAttrs = useCallback(async (refTypeId: number) => {
    if (refTypeId in cacheRef.current || loadingRef.current.has(refTypeId)) return;
    loadingRef.current.add(refTypeId);
    forceRender(n => n + 1);
    try {
      const r = await fetch(`${API}/api/admin/object-types/${refTypeId}/attributes`, { headers: authHeaders() }).then(r => r.json());
      cacheRef.current[refTypeId] = r.data ?? [];
    } catch { cacheRef.current[refTypeId] = []; }
    finally {
      loadingRef.current.delete(refTypeId);
      forceRender(n => n + 1);
    }
  }, []);

  // Auto-fetch all top-level refs on mount
  useEffect(() => {
    attrs.filter(a => a.is_reference && a.ref_type_id).forEach(a => fetchRefAttrs(a.ref_type_id!));
  }, [attrs, fetchRefAttrs]);

  const toggleRow = (rowKey: string, attr: AttrRow) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(rowKey) ? s.delete(rowKey) : s.add(rowKey);
      return s;
    });
    if (attr.is_reference && attr.ref_type_id) fetchRefAttrs(attr.ref_type_id);
  };

  // Reorder a child-depth attribute: call API then invalidate its parent's cache
  const reorderChild = useCallback(async (attr: AttrRow, direction: 'up' | 'down') => {
    await fetch(`${API}/api/admin/object-types/attributes/${attr.id}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ direction }),
    }).catch(() => {});
    // Bust the cache for this attr's parent type so the next expand re-fetches
    delete cacheRef.current[attr.from_type_id];
    fetchRefAttrs(attr.from_type_id);
  }, [fetchRefAttrs]);

  // Recursive renderer — depth drives indent and visual treatment
  const renderRows = (rows: AttrRow[], depth: number): React.ReactNode => {
    return rows.map(attr => {
      const rowKey = `${depth}-${attr.id}`;
      const isExpanded = expanded.has(rowKey);
      const refId = attr.is_reference ? attr.ref_type_id : null;
      const childRows = refId != null ? (cacheRef.current[refId] ?? null) : null;
      const isLoading = refId != null ? loadingRef.current.has(refId) : false;
      const indentPx = depth * 24;

      return (
        <React.Fragment key={rowKey}>
          <tr className={`${attr.is_reference ? 'bg-indigo-50/30' : depth > 0 ? 'bg-slate-50/40' : 'hover:bg-slate-50'}`}>
            <td className="py-2 pr-4" style={{ paddingLeft: `${16 + indentPx}px` }}>
              <div className="flex items-center gap-2">
                {attr.is_reference ? (
                  <button
                    onClick={() => toggleRow(rowKey, attr)}
                    className="flex-shrink-0 w-5 h-5 rounded bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-600 transition-colors"
                    title={isExpanded ? 'Dölj' : 'Visa attribut'}>
                    {isLoading && !isExpanded
                      ? <span className="text-[10px] animate-pulse font-bold">·</span>
                      : <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    }
                  </button>
                ) : depth > 0 ? (
                  <span className="text-slate-300 font-mono text-xs select-none">{Array(depth).fill('|').join(' ')}</span>
                ) : (
                  <span className="w-5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm ${depth === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                    {attr.caption_singular ?? <span className="italic text-slate-400 text-xs">Ej angiven</span>}
                  </p>
                  {attr.caption_plural && attr.caption_plural !== attr.caption_singular && (
                    <p className="text-[10px] text-slate-400">{attr.caption_plural}</p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-4 py-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${attr.is_reference ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
                {attr.type_name ?? '—'}
              </span>
              {attr.is_reference && childRows !== null && (
                <span className="ml-1 text-[10px] text-slate-400">({childRows.length})</span>
              )}
            </td>
            <td className="px-4 py-2 text-center">{attr.is_main_for_module ? <CheckBadge size="sm" /> : <Dash />}</td>
            <td className="px-4 py-2 text-center">{attr.is_changeable ? <CheckBadge size="sm" /> : <Dash />}</td>
            <td className="px-4 py-2 text-center">{attr.can_create ? <CheckBadge size="sm" /> : <Dash />}</td>
            <td className="px-4 py-2 text-right">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => depth === 0 ? onReorder(attr.id, 'up') : reorderChild(attr, 'up')}
                  title="Flytta upp"
                  className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => depth === 0 ? onReorder(attr.id, 'down') : reorderChild(attr, 'down')}
                  title="Flytta ned"
                  className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors mr-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button onClick={() => onEdit(attr)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Ändra</button>
                <button onClick={() => onDelete(attr)} className="text-xs text-red-500 hover:text-red-700 font-medium">Radera</button>
              </div>
            </td>
          </tr>

          {/* Recursive children when expanded */}
          {attr.is_reference && isExpanded && (
            isLoading && childRows === null
              ? <tr>
                  <td colSpan={6} className="py-2 text-xs text-slate-400 italic"
                    style={{ paddingLeft: `${40 + indentPx}px` }}>
                    Hämtar attribut…
                  </td>
                </tr>
              : childRows && childRows.length > 0
                ? renderRows(childRows, depth + 1)
                : childRows
                  ? <tr>
                      <td colSpan={6} className="py-2 text-xs text-slate-400 italic"
                        style={{ paddingLeft: `${40 + indentPx}px` }}>
                        Inga attribut
                      </td>
                    </tr>
                  : null
          )}
        </React.Fragment>
      );
    });
  };

  if (attrs.length === 0) return (
    <div className="px-5 py-12 text-center text-slate-400">
      <svg className="w-10 h-10 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">Inga attribut definierade</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attribut</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekttyp</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Huvudobjekt för modul</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Ändringsbar</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Kan skapas</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Åtgärd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {renderRows(attrs, 0)}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detailed View ────────────────────────────────────────────────────────────

function DetailedAttrView({ attrs, onEdit, onDelete, onReorder }: {
  attrs: AttrRow[];
  onEdit: (attr: AttrRow) => void;
  onDelete: (attr: AttrRow) => void;
  onReorder: (id: number, direction: 'up' | 'down') => void;
}) {
  const [expandedChildren, setExpandedChildren] = useState<Set<number>>(new Set());
  const toggleChildren = (id: number) => setExpandedChildren(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  if (attrs.length === 0) return (
    <div className="px-5 py-12 text-center text-slate-400">
      <p className="text-sm">Inga attribut definierade</p>
    </div>
  );

  return (
    <div className="p-4 space-y-3">
      {attrs.map((attr, idx) => (
        <div key={attr.id}
          className={`rounded-lg border shadow-sm overflow-hidden ${attr.is_reference ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
          {/* Card toolbar */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${attr.is_reference ? 'border-indigo-200 bg-indigo-100/40' : 'border-slate-100 bg-slate-50/60'}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => onDelete(attr)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50">
                Radera
              </button>
              <button onClick={() => onEdit(attr)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-100">
                Ändra
              </button>
            </div>
            {/* Reorder */}
            <div className="flex items-center gap-1">
              <button onClick={() => onReorder(attr.id, 'up')} disabled={idx === 0}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs">▲</button>
              <button onClick={() => onReorder(attr.id, 'down')} disabled={idx === attrs.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs">▼</button>
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Namn Singular</p>
              <p className="text-sm text-slate-800 font-medium">{attr.caption_singular ?? <span className="italic text-slate-400">Ej angiven</span>}</p>
            </div>
            {attr.caption_plural && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Namn Plural</p>
                <p className="text-sm text-slate-700">{attr.caption_plural}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Objekttyp</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${attr.is_reference ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {attr.type_name ?? '—'}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Antal som kan anges</p>
              <p className="text-sm text-slate-700">
                {attr.max_relations != null
                  ? `Maximalt ${attr.max_relations}`
                  : attr.min_relations > 0 ? `Minst ${attr.min_relations}` : 'Obegränsat'}
              </p>
            </div>
            {/* Boolean flags */}
            <div className="col-span-2 flex flex-wrap gap-2 pt-1">
              {[
                { flag: attr.is_requirement, label: 'Måste anges' },
                { flag: attr.allow_in_lists, label: 'Kan visas' },
                { flag: attr.show_in_lists_default, label: 'Visas standard' },
                { flag: attr.required_in_locked_version, label: 'Krävas för låsning' },
                { flag: attr.copy_attribute, label: 'Kopieras' },
                { flag: attr.exists_only_in_parent, label: 'Bara med förälder' },
              ].filter(f => f.flag).map(f => (
                <span key={f.label} className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-medium">{f.label}</span>
              ))}
            </div>
            {/* Module-level properties */}
            <div className="col-span-2 flex gap-4 pt-1 border-t border-slate-100 mt-1">
              {[
                { flag: attr.is_main_for_module, label: 'Huvudobjekt för modul' },
                { flag: attr.is_changeable, label: 'Ändringsbar' },
                { flag: attr.can_create, label: 'Kan skapas' },
              ].map(f => (
                <span key={f.label} className={`text-[10px] flex items-center gap-1 ${f.flag ? 'text-indigo-700 font-medium' : 'text-slate-300'}`}>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.flag
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />}
                  </svg>
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* Module usage */}
          {attr.used_in_modules && attr.used_in_modules.length > 0 && (
            <div className="px-4 pb-3 border-t border-slate-100 pt-2 mt-1">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5">
                Används i modul ({attr.used_in_modules.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {attr.used_in_modules.slice(0, 8).map(m => (
                  <span key={m.module_id}
                    className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {m.module_name}{m.allow_edit ? '' : ' (Skrivskyddad)'}
                  </span>
                ))}
                {attr.used_in_modules.length > 8 && (
                  <span className="text-[10px] text-slate-400 italic">+{attr.used_in_modules.length - 8} till</span>
                )}
              </div>
            </div>
          )}

          {/* Reference children */}
          {attr.is_reference && attr.children && attr.children.length > 0 && (
            <div className="border-t border-indigo-200">
              <button
                onClick={() => toggleChildren(attr.id)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-indigo-700 hover:bg-indigo-100/50 transition-colors text-left">
                <svg className={`w-3 h-3 transition-transform ${expandedChildren.has(attr.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">Kopplade attribut ({attr.children.length})</span>
              </button>
              {expandedChildren.has(attr.id) && (
                <div className="bg-indigo-50/40 border-t border-indigo-100 divide-y divide-indigo-100">
                  {attr.children.map(child => (
                    <div key={child.id} className="flex items-center gap-3 pl-8 pr-4 py-2">
                      <span className="text-indigo-300 font-mono text-sm">|</span>
                      <div className="flex-1">
                        <span className="text-sm text-slate-700 font-medium">{child.caption_singular ?? <span className="italic text-slate-400 text-xs">Ej angiven</span>}</span>
                        {child.caption_plural && child.caption_plural !== child.caption_singular && (
                          <span className="text-[10px] text-slate-400 ml-2">/ {child.caption_plural}</span>
                        )}
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{child.type_name ?? '—'}</span>
                      {child.is_requirement && <span className="text-[10px] text-red-500 font-medium">Oblig.</span>}
                      {child.allow_in_lists && <CheckBadge size="sm" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObjectTypeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const typeId = id ? parseInt(String(id)) : null;

  const [ot, setOt] = useState<ObjectType | null>(null);
  const [attributes, setAttributes] = useState<AttrRow[]>([]);
  const [modules, setModules] = useState<ModuleAssoc[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'attributes' | 'modules'>('attributes');
  const [detailedView, setDetailedView] = useState(false);
  const [attrSearch, setAttrSearch] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [addAttrModal, setAddAttrModal] = useState(false);
  const [editAttrModal, setEditAttrModal] = useState<AttrRow | null>(null);

  const load = useCallback(async () => {
    if (!typeId) return;
    setLoading(true);
    try {
      const [otRes, attrRes, modRes, classRes] = await Promise.all([
        fetch(`${API}/api/admin/object-types/${typeId}`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/api/admin/object-types/${typeId}/attributes`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/api/admin/object-types/${typeId}/modules`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/api/admin/classifications`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      if (otRes.success) setOt(otRes.data);
      setAttributes(attrRes.data ?? []);
      setModules(modRes.data ?? []);
      setClassifications(classRes.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [typeId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!ot) return;
    if (!confirm(`Radera objekttypen "${ot.name_singular}"? Kan inte ångras.`)) return;
    const r = await fetch(`${API}/api/admin/object-types/${typeId}`, { method: 'DELETE', headers: authHeaders() });
    const d = await r.json();
    if (d.success) router.push('/admin/object-types');
    else alert(d.error ?? 'Kunde inte radera');
  };

  const handleDeleteAttr = async (attr: AttrRow) => {
    if (!confirm(`Radera attributet "${attr.caption_singular ?? 'Okänt'}"?`)) return;
    const r = await fetch(`${API}/api/admin/object-types/attributes/${attr.id}`,
      { method: 'DELETE', headers: authHeaders() });
    const d = await r.json();
    if (d.success) load();
    else alert(d.error ?? 'Kunde inte radera');
  };

  const handleReorder = async (attrId: number, direction: 'up' | 'down') => {
    await fetch(`${API}/api/admin/object-types/attributes/${attrId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ direction }),
    });
    load();
  };

  const toggleModuleFlag = async (assoc: ModuleAssoc, field: 'allow_edit' | 'allow_insert' | 'is_main_object_type') => {
    const r = await fetch(`${API}/api/admin/object-types/${typeId}/modules/${assoc.module_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        allow_edit: field === 'allow_edit' ? !assoc.allow_edit : assoc.allow_edit,
        allow_insert: field === 'allow_insert' ? !assoc.allow_insert : assoc.allow_insert,
        is_main_object_type: field === 'is_main_object_type' ? !assoc.is_main_object_type : assoc.is_main_object_type,
        show_as_root: assoc.show_as_root,
      }),
    });
    const d = await r.json();
    if (d.success) setModules(prev => prev.map(m => m.id === assoc.id ? { ...m, [field]: !m[field] } : m));
  };

  const filteredAttrs = attrSearch
    ? attributes.filter(a =>
        (a.caption_singular ?? '').toLowerCase().includes(attrSearch.toLowerCase()) ||
        (a.type_name ?? '').toLowerCase().includes(attrSearch.toLowerCase()))
    : attributes;

  const scalarCount = attributes.filter(a => !a.is_reference).length;
  const refCount = attributes.filter(a => a.is_reference).length;

  if (loading) return (
    <SamrumLayout><div className="flex items-center justify-center h-64"><Loading /></div></SamrumLayout>
  );

  if (!ot) return (
    <SamrumLayout>
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-sm font-medium">Objekttypen hittades inte</p>
        <Link href="/admin/object-types" className="mt-3 text-sm text-blue-600 hover:underline">← Tillbaka till objekttyper</Link>
      </div>
    </SamrumLayout>
  );

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <Link href="/admin/object-types"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-samrum-blue transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka till objekttyper
        </Link>
      </div>
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Aktuell typ</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-blue-800 truncate">{ot.name_singular}</p>
          {ot.database_id && <p className="text-[10px] font-mono text-blue-500 mt-0.5">{ot.database_id}</p>}
          {ot.classification_name && <p className="text-[10px] text-blue-500 mt-0.5 truncate">{ot.classification_name}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-3">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-medium">Sammanfattning</p>
        <div className="space-y-2">
          {[
            { label: 'Datatyp-attribut', value: scalarCount },
            { label: 'Referens-attribut', value: refCount },
            { label: 'Totalt attribut', value: attributes.length },
            { label: 'Moduler', value: modules.length },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-xs">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-semibold text-slate-700">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SamrumLayout sidebar={sidebar} sidebarTitle="Objekttyp">
        {/* Breadcrumb + Toolbar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin" className="hover:text-slate-700">Admin</Link>
            <span className="text-slate-300">›</span>
            <Link href="/admin/object-types" className="hover:text-slate-700">Objekttyper (B012)</Link>
            <span className="text-slate-300">›</span>
            <span className="font-medium text-slate-900 truncate">{ot.name_singular}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{ot.name_singular}</h1>
              {ot.classification_name && (
                <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  {ot.classification_name}
                </span>
              )}
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Radera
              </button>
              <button onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Ändra
              </button>
              <Link href="/admin/object-types?action=new"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                Skapa ny
              </Link>
              <button onClick={() => setAddAttrModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-samrum-blue text-white rounded-lg hover:bg-samrum-blue-dark transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Lägg till attribut
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Detail fields card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">Objekttypsinformation</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: 'AdministrationsId', value: ot.database_id ?? '—' },
                { label: 'Namn Singular', value: ot.name_singular },
                { label: 'Namn Plural', value: ot.name_plural ?? '—' },
                { label: 'Klassificering', value: ot.classification_name ?? '—' },
                { label: 'Rubrik för Id', value: ot.default_attr_caption ?? '—' },
                { label: 'Är abstrakt', value: ot.is_abstract ? 'Ja' : 'Nej' },
                { label: 'Existerar bara med förälder', value: ot.exists_only_in_parent_scope ? 'Ja' : 'Nej' },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">{row.label}</p>
                  <p className="text-sm text-slate-900 font-medium">{row.value}</p>
                </div>
              ))}
              {ot.description && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Beskrivning</p>
                  <p className="text-sm text-slate-700">{ot.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-0 border-b border-slate-200">
              <nav className="flex">
                {[
                  { id: 'attributes' as const, label: `Attribut (${attributes.length})` },
                  { id: 'modules' as const, label: `Moduler (${modules.length})` },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-samrum-blue text-samrum-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </nav>
              {activeTab === 'attributes' && (
                <div className="flex items-center gap-2 py-2">
                  <input type="text" placeholder="Sök attribut..."
                    value={attrSearch}
                    onChange={e => setAttrSearch(e.target.value)}
                    className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400/40 w-36" />
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    <button onClick={() => setDetailedView(false)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${!detailedView ? 'bg-samrum-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      Förenklad
                    </button>
                    <button onClick={() => setDetailedView(true)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${detailedView ? 'bg-samrum-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      Detaljerad
                    </button>
                  </div>
                </div>
              )}
            </div>

            {activeTab === 'attributes' && (
              detailedView
                ? <DetailedAttrView
                    attrs={filteredAttrs}
                    onEdit={setEditAttrModal}
                    onDelete={handleDeleteAttr}
                    onReorder={handleReorder}
                  />
                : <SimplifiedAttrTable
                    attrs={filteredAttrs}
                    onEdit={setEditAttrModal}
                    onDelete={handleDeleteAttr}
                    onReorder={handleReorder}
                  />
            )}

            {activeTab === 'modules' && (
              <div>
                {modules.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-400">
                    <p className="text-sm">Denna objekttyp används inte i någon modul</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100">
                      <p className="text-xs text-slate-500">Klicka för att ändra rättigheter per modul</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Modul</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Mapp</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Huvudobjekt för modul</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Ändringsbar</th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Kan skapas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modules.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5">
                                <Link href={`/admin/modules/${m.module_id}`}
                                  className="text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline">
                                  {m.module_name}
                                </Link>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{m.folder_name ?? '—'}</td>
                              <td className="px-4 py-2.5 text-center">
                                <ToggleCell value={m.is_main_object_type} onChange={() => toggleModuleFlag(m, 'is_main_object_type')} color="amber" />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <ToggleCell value={m.allow_edit} onChange={() => toggleModuleFlag(m, 'allow_edit')} color="blue" />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <ToggleCell value={m.allow_insert} onChange={() => toggleModuleFlag(m, 'allow_insert')} color="green" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </SamrumLayout>

      {showEdit && ot && (
        <EditModal ot={ot} classifications={classifications}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setOt(updated); setShowEdit(false); }} />
      )}

      {addAttrModal && typeId && (
        <AddEditAttrModal mode="add" typeId={typeId}
          onClose={() => setAddAttrModal(false)}
          onSaved={() => { setAddAttrModal(false); load(); }} />
      )}

      {editAttrModal && typeId && (
        <AddEditAttrModal mode="edit" typeId={typeId} existing={editAttrModal}
          onClose={() => setEditAttrModal(null)}
          onSaved={() => { setEditAttrModal(null); load(); }} />
      )}
    </>
  );
}

// ─── Small helper components ─────────────────────────────────────────────────

function CheckBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm'
    ? 'inline-flex items-center justify-center w-4 h-4 bg-green-100 text-green-700 rounded-full'
    : 'inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full';
  return (
    <span className={cls}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function Dash() {
  return <span className="text-slate-300 text-sm">—</span>;
}

interface ToggleCellProps {
  value: boolean;
  onChange: () => void;
  color: 'blue' | 'green' | 'amber' | 'purple';
  readOnly?: boolean;
}

function ToggleCell({ value, onChange, color, readOnly }: ToggleCellProps) {
  const colors = {
    blue: { on: 'bg-blue-100 text-blue-700 border-blue-200', off: 'bg-slate-50 text-slate-400 border-slate-200' },
    green: { on: 'bg-green-100 text-green-700 border-green-200', off: 'bg-slate-50 text-slate-400 border-slate-200' },
    amber: { on: 'bg-amber-100 text-amber-700 border-amber-200', off: 'bg-slate-50 text-slate-400 border-slate-200' },
    purple: { on: 'bg-purple-100 text-purple-700 border-purple-200', off: 'bg-slate-50 text-slate-400 border-slate-200' },
  };
  const cls = value ? colors[color].on : colors[color].off;
  return (
    <button onClick={readOnly ? undefined : onChange} disabled={readOnly}
      className={`inline-flex items-center justify-center w-8 h-6 rounded border text-xs font-bold transition-colors ${cls} ${readOnly ? 'cursor-default opacity-70' : 'hover:opacity-80 cursor-pointer'}`}
      title={value ? 'Ja – klicka för att ändra' : 'Nej – klicka för att ändra'}>
      {value ? '✓' : '×'}
    </button>
  );
}
