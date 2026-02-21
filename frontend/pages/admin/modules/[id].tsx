import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';

interface Module {
  id: number;
  name: string;
  description: string | null;
  allow_incomplete_versions: boolean;
  folder_id: number | null;
  folder_name: string | null;
  created_at: string;
}

interface ModuleObjectType {
  id: number;
  module_id: number;
  object_type_id: number;
  name_singular: string;
  name_plural: string | null;
  allow_edit: boolean;
  show_as_root: boolean;
  allow_insert: boolean;
  is_main_object_type: boolean;
}

interface Folder { id: number; name: string; }
interface ObjectType { id: number; name_singular: string; }

const API = 'http://localhost:3000';

export default function ModuleDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [mod, setMod] = useState<Module | null>(null);
  const [objectTypes, setObjectTypes] = useState<ModuleObjectType[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allOTs, setAllOTs] = useState<ObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Module>>({});
  const [addOTId, setAddOTId] = useState('');
  const [otSearch, setOtSearch] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  const loadModule = async () => {
    if (!id) return;
    const [mData, motData] = await Promise.all([
      fetch(`${API}/api/admin/modules/${id}`).then(r => r.json()),
      fetch(`${API}/api/admin/modules/${id}/object-types`).then(r => r.json()),
    ]);
    setMod(mData.data);
    setForm(mData.data || {});
    setObjectTypes(motData.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      loadModule(),
      fetch(`${API}/api/admin/module-folders`).then(r => r.json()).then(d => setFolders(d.data || [])),
    ]);
  }, [id]);

  useEffect(() => {
    if (otSearch.length < 2) return;
    const timer = setTimeout(() => {
      fetch(`${API}/api/admin/object-types?search=${encodeURIComponent(otSearch)}`)
        .then(r => r.json())
        .then(d => setAllOTs(d.data || []));
    }, 300);
    return () => clearTimeout(timer);
  }, [otSearch]);

  const saveEdit = async () => {
    setSaving(true);
    const r = await fetch(`${API}/api/admin/modules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setMod(d.data);
    setForm(d.data);
    setSaving(false);
    setEditing(false);
  };

  const addObjectType = async () => {
    if (!addOTId) return;
    setAddingSaving(true);
    await fetch(`${API}/api/admin/modules/${id}/object-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_type_id: Number(addOTId) }),
    });
    setAddOTId('');
    setOtSearch('');
    setAllOTs([]);
    setAddingSaving(false);
    await loadModule();
  };

  const removeObjectType = async (otId: number) => {
    await fetch(`${API}/api/admin/modules/${id}/object-types/${otId}`, { method: 'DELETE' });
    await loadModule();
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  );

  if (!mod) return (
    <Layout>
      <div className="text-center py-20 text-gray-500">Module not found.</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="mb-6">
        <nav className="text-sm text-gray-500 mb-2">
          <Link href="/dashboard" className="hover:text-gray-700">Home</Link>
          {' / '}
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          {' / '}
          <Link href="/admin/modules" className="hover:text-gray-700">Modules</Link>
          {' / '}
          <span className="text-gray-800 font-medium">{mod.name}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{mod.name}</h1>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setForm(mod); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Module Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Details</h2>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Folder</label>
              <select className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.folder_id || ''} onChange={e => setForm(f => ({ ...f, folder_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">— No folder —</option>
                {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.allow_incomplete_versions} onChange={e => setForm(f => ({ ...f, allow_incomplete_versions: e.target.checked }))} />
                Allow Incomplete Versions
              </label>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['ID', mod.id],
              ['Name', mod.name],
              ['Folder', mod.folder_name || '—'],
              ['Allow Incomplete', mod.allow_incomplete_versions ? 'Yes' : 'No'],
              ['Created', mod.created_at ? new Date(mod.created_at).toLocaleDateString() : '—'],
              ['Description', mod.description || '—'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-gray-800 font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Object Types */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Assigned Object Types ({objectTypes.length})</h2>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
                placeholder="Search object type…"
                value={otSearch}
                onChange={e => { setOtSearch(e.target.value); setAddOTId(''); }}
              />
              {allOTs.length > 0 && otSearch && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {allOTs.slice(0, 10).map(ot => (
                    <button
                      key={ot.id}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                      onClick={() => { setAddOTId(String(ot.id)); setOtSearch(ot.name_singular); setAllOTs([]); }}
                    >
                      <span className="text-gray-400 mr-2 text-xs">{ot.id}</span>{ot.name_singular}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={addObjectType}
              disabled={!addOTId || addingSaving}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {addingSaving ? '…' : 'Add'}
            </button>
          </div>
        </div>
        {objectTypes.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">No object types assigned to this module.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Object Type</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24 hidden md:table-cell">Allow Edit</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24 hidden md:table-cell">Show Root</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24 hidden lg:table-cell">Is Main</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {objectTypes.map((ot, i) => (
                <tr key={ot.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link href={`/admin/object-types/${ot.object_type_id}`} className="hover:text-blue-600 hover:underline">
                      {ot.name_singular}
                    </Link>
                    {ot.name_plural && <span className="text-gray-400 text-xs ml-2">({ot.name_plural})</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {ot.allow_edit ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {ot.show_as_root ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {ot.is_main_object_type ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Main</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeObjectType(ot.object_type_id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
