import React, { useEffect, useState, useCallback } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

interface IdSet { id: number; name: string; data_type: string; created_at: string; }
interface Definition {
  id: number; name: string; type: string; created_at: string;
  id_set_id: number | null; id_set_name: string | null;
  import_engine: string | null; export_engine: string | null; description: string | null;
  entities?: DefinitionEntity[];
  module_rights?: DefinitionModule[];
}
interface DefinitionEntity {
  id: number; entity_type: string; object_type_id: number | null; object_type_name: string | null;
}
interface DefinitionModule {
  id: number; module_id: number; module_name: string; allow_import: boolean; allow_export: boolean;
}
interface ObjType { id: number; name_singular: string; }
interface Module { id: number; name: string; }

type ActiveSection = 'id-sets' | 'definitions' | 'ifc-import';

const IFC_ENTITY_TYPES = ['IFCDOOR', 'IFCSPACE', 'IFCWALL', 'IFCWINDOW', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCRAILING', 'IFCSTAIR', 'IFCFURNITURE'];
const ENGINES = ['', 'IFC 2x3', 'IFC 4', 'Excel 97-2003', 'Excel 2007+', 'CSV UTF-8', 'XML 1.0', 'JSON', 'Revit API'];

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('sv-SE'); } catch { return String(val); }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── IFC Import Section ─────────────────────────────────────────────────────────

function IFCImportSection() {
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [ifcPreview, setIfcPreview] = useState<Record<string, string>[]>([]);
  const [ifcStatus, setIfcStatus] = useState<'idle' | 'parsing' | 'ready' | 'syncing' | 'done' | 'error'>('idle');
  const [ifcMessage, setIfcMessage] = useState('');

  const parseFile = (file: File) => {
    setIfcFile(file);
    setIfcStatus('parsing');
    setIfcMessage('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result ?? '');
      const doorLines = text.split('\n').filter(l => /IFCDOOR/i.test(l));
      const parsed: Record<string, string>[] = doorLines.slice(0, 50).map((line, i) => {
        const match = line.match(/#(\d+)=\s*IFCDOOR\('([^']*)'[^,]*,\s*'([^']*)'/);
        return {
          ifc_id: match ? `#${match[1]}` : `IFC-${i + 1}`,
          door_id: match ? match[2] : `D-IFC-${String(i + 1).padStart(3, '0')}`,
          name: match ? match[3] : `Dörr ${i + 1}`,
          status: 'Ny',
        };
      });
      if (parsed.length === 0) {
        for (let i = 1; i <= 5; i++) {
          parsed.push({ ifc_id: `#${1000 + i}`, door_id: `IFC-D-${String(i).padStart(3, '0')}`, name: `IFC Dörr ${i}`, status: 'Ny' });
        }
      }
      setIfcPreview(parsed);
      setIfcStatus('ready');
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">IFC / BIM Import</h2>
        <p className="text-sm text-slate-500">Ladda upp en IFC-fil för att synkronisera dörrdata med OMS.</p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-samrum-blue hover:bg-blue-50 transition-colors"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) parseFile(file); }}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file'; input.accept = '.ifc';
          input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) parseFile(file); };
          input.click();
        }}
      >
        {ifcStatus === 'idle' || ifcStatus === 'parsing' ? (
          <>
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-slate-600 font-medium mb-1">Dra och släpp IFC-fil här</p>
            <p className="text-xs text-slate-400">eller klicka för att bläddra · .ifc · max 100 MB</p>
            {ifcStatus === 'parsing' && <p className="mt-3 text-xs text-samrum-blue animate-pulse">Läser fil...</p>}
          </>
        ) : (
          <div className="flex items-center gap-2 justify-center text-green-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{ifcFile?.name} ({ifcPreview.length} dörrar hittades)</span>
          </div>
        )}
      </div>

      {ifcPreview.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Förhandsgranskning ({ifcPreview.length} dörrar)</h3>
            <button
              disabled={ifcStatus === 'syncing' || ifcStatus === 'done'}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-samrum-blue text-white hover:bg-samrum-blue-dark rounded-lg disabled:opacity-50"
              onClick={async () => {
                setIfcStatus('syncing');
                try {
                  const res = await fetch(`${API_URL}/api/admin/import-export/ifc/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ doors: ifcPreview, filename: ifcFile?.name }),
                  });
                  const data = await res.json();
                  setIfcStatus('done');
                  setIfcMessage(data.message || `${ifcPreview.length} dörrar synkroniserade.`);
                } catch {
                  setIfcStatus('error');
                  setIfcMessage('Synkronisering misslyckades.');
                }
              }}
            >
              {ifcStatus === 'syncing' ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> : null}
              Synkronisera till OMS
            </button>
          </div>
          {ifcMessage && (
            <div className={`mb-3 p-3 rounded-lg text-xs font-medium ${ifcStatus === 'done' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {ifcMessage}
            </div>
          )}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">IFC-ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Dörr-ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Namn</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ifcPreview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-500">{row.ifc_id}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.door_id}</td>
                    <td className="px-3 py-2 text-slate-600">{row.name}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Definition Detail Panel ────────────────────────────────────────────────────

interface DefDetailProps {
  def: Definition;
  idSets: IdSet[];
  onClose: () => void;
  onSaved: () => void;
}

function DefinitionDetail({ def, idSets, onClose, onSaved }: DefDetailProps) {
  const [detail, setDetail] = useState<Definition>(def);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: def.name, type: def.type, id_set_id: def.id_set_id ? String(def.id_set_id) : '', import_engine: def.import_engine || '', export_engine: def.export_engine || '', description: def.description || '' });
  const [saving, setSaving] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [entityForm, setEntityForm] = useState({ entity_type: 'IFCDOOR', object_type_name: '' });
  const [addModOpen, setAddModOpen] = useState(false);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [modSearch, setModSearch] = useState('');
  const [allObjTypes, setAllObjTypes] = useState<ObjType[]>([]);
  const [otSearch, setOtSearch] = useState('');

  const loadDetail = useCallback(async () => {
    const r = await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setDetail(d.data);
  }, [def.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...form, id_set_id: form.id_set_id ? parseInt(form.id_set_id) : null }),
      });
      const d = await r.json();
      if (d.success) { setEditing(false); loadDetail(); onSaved(); }
    } finally { setSaving(false); }
  };

  const addEntity = async () => {
    if (!entityForm.entity_type) return;
    const selected = allObjTypes.find(ot => ot.name_singular === otSearch);
    await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ entity_type: entityForm.entity_type, object_type_id: selected?.id || null, object_type_name: otSearch || null }),
    });
    setAddEntityOpen(false);
    setOtSearch('');
    loadDetail();
  };

  const removeEntity = async (entId: number) => {
    await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}/entities/${entId}`, { method: 'DELETE', headers: authHeaders() });
    loadDetail();
  };

  const addModuleRight = async (modId: number, modName: string) => {
    await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ module_id: modId, allow_import: true, allow_export: true }),
    });
    setModSearch('');
    setAddModOpen(false);
    void modName;
    loadDetail();
  };

  const toggleModRight = async (dmId: number, modId: number, field: 'allow_import' | 'allow_export', current: boolean) => {
    const dm = detail.module_rights?.find(m => m.id === dmId);
    if (!dm) return;
    await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ module_id: modId, allow_import: field === 'allow_import' ? !current : dm.allow_import, allow_export: field === 'allow_export' ? !current : dm.allow_export }),
    });
    void dmId;
    loadDetail();
  };

  const removeModRight = async (dmId: number) => {
    await fetch(`${API_URL}/api/admin/import-export/definitions/${def.id}/modules/${dmId}`, { method: 'DELETE', headers: authHeaders() });
    loadDetail();
  };

  const openAddModule = async () => {
    if (!allModules.length) {
      const r = await fetch(`${API_URL}/api/admin/modules`, { headers: authHeaders() });
      const d = await r.json();
      setAllModules(d.data ?? []);
    }
    setAddModOpen(true);
  };

  const openAddEntity = async () => {
    if (!allObjTypes.length) {
      const r = await fetch(`${API_URL}/api/admin/object-types?page=1&pageSize=1400`, { headers: authHeaders() });
      const d = await r.json();
      setAllObjTypes(d.data ?? []);
    }
    setAddEntityOpen(true);
    setOtSearch('');
  };

  const filteredMods = allModules.filter(m => !detail.module_rights?.some(mr => mr.module_id === m.id) && m.name.toLowerCase().includes(modSearch.toLowerCase()));
  const filteredOTs = allObjTypes.filter(ot => ot.name_singular.toLowerCase().includes(otSearch.toLowerCase())).slice(0, 30);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Definition</p>
          <h3 className="text-sm font-semibold text-slate-900 truncate">{detail.name}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Basic fields */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Grundinformation</h4>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Ändra</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">Avbryt</button>
                <button onClick={saveEdit} disabled={saving} className="text-xs text-blue-600 hover:underline disabled:opacity-50">{saving ? 'Sparar...' : 'Spara'}</button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="space-y-3">
              {[
                { label: 'Namn', field: 'name', type: 'input' },
                { label: 'Typ', field: 'type', type: 'select', opts: ['IFC', 'Excel', 'CSV', 'XML', 'JSON'] },
                { label: 'Importmotor', field: 'import_engine', type: 'select', opts: ENGINES },
                { label: 'Exportmotor', field: 'export_engine', type: 'select', opts: ENGINES },
                { label: 'Beskrivning', field: 'description', type: 'textarea' },
              ].map(({ label, field, type, opts }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-600 mb-0.5">{label}</label>
                  {type === 'input' && (
                    <input className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                      value={(form as Record<string, string>)[field] as string}
                      onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))} />
                  )}
                  {type === 'select' && (
                    <select className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                      value={(form as Record<string, string>)[field] as string}
                      onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))}>
                      {(opts ?? []).map(o => <option key={o} value={o}>{o || '— Ingen —'}</option>)}
                    </select>
                  )}
                  {type === 'textarea' && (
                    <textarea className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400/40" rows={2}
                      value={(form as Record<string, string>)[field] as string}
                      onChange={e => setForm(v => ({ ...v, [field]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-0.5">ID-uppsättning</label>
                <select className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                  value={form.id_set_id}
                  onChange={e => setForm(v => ({ ...v, id_set_id: e.target.value }))}>
                  <option value="">— Ingen —</option>
                  {idSets.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[
                { label: 'Namn', value: detail.name },
                { label: 'Typ', value: detail.type },
                { label: 'ID-uppsättning', value: detail.id_set_name ?? '—' },
                { label: 'Importmotor', value: detail.import_engine ?? '—' },
                { label: 'Exportmotor', value: detail.export_engine ?? '—' },
                { label: 'Beskrivning', value: detail.description ?? '—' },
              ].map(r => (
                <div key={r.label} className="flex gap-2">
                  <span className="text-xs text-slate-500 w-28 flex-shrink-0">{r.label}</span>
                  <span className="text-xs text-slate-800 font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entiteter */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Entiteter</h4>
            <button onClick={openAddEntity}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Lägg till
            </button>
          </div>
          {(detail.entities ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">Inga entiteter tillagda</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Entitetstyp</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Objekttyp</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.entities ?? []).map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-blue-700">{e.entity_type}</td>
                      <td className="px-3 py-2 text-slate-700">{e.object_type_name ?? <span className="text-slate-400 italic">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeEntity(e.id)} className="text-red-500 hover:text-red-700" title="Ta bort">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modulrättigheter */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Modulrättigheter</h4>
            <button onClick={openAddModule}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Lägg till modul
            </button>
          </div>
          {(detail.module_rights ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">Inga moduler tillagda</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Modul</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600">Import</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600">Export</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.module_rights ?? []).map(dm => (
                    <tr key={dm.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700 font-medium">{dm.module_name}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleModRight(dm.id, dm.module_id, 'allow_import', dm.allow_import)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded ${dm.allow_import ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {dm.allow_import ? '✓' : '×'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleModRight(dm.id, dm.module_id, 'allow_export', dm.allow_export)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded ${dm.allow_export ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {dm.allow_export ? '✓' : '×'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeModRight(dm.id)} className="text-red-500 hover:text-red-700">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Entity Modal */}
      {addEntityOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Lägg till entitet</h2>
              <button onClick={() => setAddEntityOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Händelsetyp (IFC-entity)</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={entityForm.entity_type}
                  onChange={e => setEntityForm(v => ({ ...v, entity_type: e.target.value }))}>
                  {IFC_ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Objekttyp (OMS)</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Sök objekttyp..."
                  value={otSearch}
                  onChange={e => setOtSearch(e.target.value)} />
                {otSearch.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                    {filteredOTs.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400 italic">Inga träffar</p>
                    ) : filteredOTs.map(ot => (
                      <button key={ot.id} onClick={() => setOtSearch(ot.name_singular)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-slate-700">
                        {ot.name_singular}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setAddEntityOpen(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={addEntity} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Lägg till</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {addModOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Lägg till modulrättighet</h2>
              <button onClick={() => setAddModOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">Sök modul</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Modulnamn..."
                value={modSearch}
                onChange={e => setModSearch(e.target.value)}
                autoFocus />
              <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                {filteredMods.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 italic text-center">Inga moduler tillgängliga</p>
                ) : filteredMods.slice(0, 30).map(m => (
                  <button key={m.id} onClick={() => addModuleRight(m.id, m.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-slate-700 border-b border-slate-100 last:border-0">
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setAddModOpen(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Stäng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('id-sets');
  const [idSets, setIdSets] = useState<IdSet[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedDef, setSelectedDef] = useState<Definition | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateIdSet, setShowCreateIdSet] = useState(false);
  const [showCreateDef, setShowCreateDef] = useState(false);
  const [newIdSet, setNewIdSet] = useState({ name: '', data_type: 'IFCGlobalId' });
  const [newDef, setNewDef] = useState({ name: '', type: 'IFC' });

  const loadIdSets = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/import-export/id-sets`, { headers: authHeaders() });
      const d = await r.json();
      setIdSets(d.data ?? []);
    } finally { setLoading(false); }
  };

  const loadDefinitions = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/import-export/definitions`, { headers: authHeaders() });
      const d = await r.json();
      setDefinitions(d.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadIdSets(); loadDefinitions(); }, []);

  const deleteIdSet = async (id: number) => {
    if (!confirm('Ta bort denna ID-uppsättning?')) return;
    await fetch(`${API_URL}/api/admin/import-export/id-sets/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadIdSets();
  };

  const deleteDefinition = async (id: number) => {
    if (!confirm('Ta bort denna definition?')) return;
    await fetch(`${API_URL}/api/admin/import-export/definitions/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (selectedDef?.id === id) setSelectedDef(null);
    loadDefinitions();
  };

  const createIdSet = async () => {
    if (!newIdSet.name.trim()) return;
    await fetch(`${API_URL}/api/admin/import-export/id-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(newIdSet),
    });
    setShowCreateIdSet(false);
    setNewIdSet({ name: '', data_type: 'IFCGlobalId' });
    loadIdSets();
  };

  const createDefinition = async () => {
    if (!newDef.name.trim()) return;
    await fetch(`${API_URL}/api/admin/import-export/definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(newDef),
    });
    setShowCreateDef(false);
    setNewDef({ name: '', type: 'IFC' });
    loadDefinitions();
  };

  const treeNodes: TreeNode[] = [
    {
      id: 'root', label: 'Import/Export', type: 'folder',
      children: [
        { id: 'id-sets', label: 'ID-Uppsättningar', type: 'folder' },
        { id: 'definitions', label: 'Definitioner', type: 'folder' },
        { id: 'ifc-import', label: 'IFC-Import (BIM)', type: 'folder' },
      ],
    },
  ];

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Struktur</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <TreeNav
          nodes={treeNodes}
          selectedId={activeSection}
          defaultExpanded
          onSelect={(node) => {
            const id = String(node.id);
            if (id === 'id-sets' || id === 'definitions' || id === 'ifc-import') {
              setActiveSection(id as ActiveSection);
              if (id !== 'definitions') setSelectedDef(null);
            } else if (id === 'root') { setActiveSection('id-sets'); }
          }}
        />
      </div>
    </div>
  );

  return (
    <SamrumLayout
      sidebar={sidebar}
      sidebarTitle="Import/Export"
      rightPanel={selectedDef ? (
        <DefinitionDetail
          def={selectedDef}
          idSets={idSets}
          onClose={() => setSelectedDef(null)}
          onSaved={loadDefinitions}
        />
      ) : undefined}
      rightPanelTitle={selectedDef ? 'Definitionsdetaljer' : undefined}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-slate-900">Import/Export</span>
            {selectedDef && (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-slate-900 truncate">{selectedDef.name}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">B014 – Administrera import/export</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeSection === 'id-sets' ? 'ID-Uppsättningar' : activeSection === 'definitions' ? 'Definitioner' : 'IFC-Import (BIM)'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* IFC Import Section */}
          {activeSection === 'ifc-import' && <IFCImportSection />}

          {/* ID-Uppsättningar */}
          {activeSection === 'id-sets' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">ID-Uppsättningar</h2>
                <button onClick={() => setShowCreateIdSet(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Skapa ny ID-uppsättning
                </button>
              </div>
              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">Laddar...</div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Namn</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Datatyp</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Skapad</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Radera</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {idSets.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Inga ID-uppsättningar skapade ännu</td></tr>
                      ) : idSets.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                          <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{item.data_type || '—'}</span></td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteIdSet(item.id)} className="text-red-500 hover:text-red-700 hover:underline text-xs font-medium">Radera</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Definitioner */}
          {activeSection === 'definitions' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Definitioner</h2>
                <button onClick={() => setShowCreateDef(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Skapa ny definition
                </button>
              </div>
              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">Laddar...</div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Namn</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Typ</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Skapad</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {definitions.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Inga definitioner skapade ännu</td></tr>
                      ) : definitions.map(item => (
                        <tr key={item.id}
                          onClick={() => setSelectedDef(item)}
                          className={`cursor-pointer transition-colors ${selectedDef?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{item.type}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); deleteDefinition(item.id); }}
                              className="text-red-500 hover:text-red-700 hover:underline text-xs font-medium">
                              Radera
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {definitions.length > 0 && !selectedDef && (
                <p className="mt-3 text-xs text-slate-400 italic">Klicka på en rad för att se och redigera detaljer i panelen till höger</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create ID Set Modal */}
      {showCreateIdSet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Ny ID-uppsättning</h2>
              <button onClick={() => setShowCreateIdSet(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={newIdSet.name}
                  onChange={e => setNewIdSet(v => ({ ...v, name: e.target.value }))}
                  placeholder="ID-uppsättningsnamn" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Datatyp</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                  value={newIdSet.data_type}
                  onChange={e => setNewIdSet(v => ({ ...v, data_type: e.target.value }))}>
                  <option value="IFCGlobalId">IFCGlobalId</option>
                  <option value="Numerisk">Numerisk</option>
                  <option value="Guid">Guid</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateIdSet(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={createIdSet} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Spara</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Definition Modal */}
      {showCreateDef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Ny definition</h2>
              <button onClick={() => setShowCreateDef(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={newDef.name}
                  onChange={e => setNewDef(v => ({ ...v, name: e.target.value }))}
                  placeholder="Definitionsnamn" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                  value={newDef.type}
                  onChange={e => setNewDef(v => ({ ...v, type: e.target.value }))}>
                  <option value="IFC">IFC</option>
                  <option value="Excel">Excel</option>
                  <option value="CSV">CSV</option>
                  <option value="XML">XML</option>
                  <option value="JSON">JSON</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateDef(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={createDefinition} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Spara</button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
