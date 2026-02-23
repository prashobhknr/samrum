import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';

interface ObjectType {
  id: number;
  name_singular: string;
  name_plural: string | null;
  data_type_id: number | null;
  data_type_name: string | null;
  is_abstract: boolean;
  classification_id: number | null;
  classification_name: string | null;
  description: string | null;
  database_id: string | null;
  default_attr_caption: string | null;
  created_at: string;
  updated_at: string;
}

interface Relationship {
  id: number;
  caption_singular: string | null;
  caption_plural: string | null;
  from_type_id: number;
  to_type_id: number;
  from_name: string;
  to_name: string;
  min_relations: number;
  max_relations: number | null;
  is_requirement: boolean;
}

interface DataType { id: number; name: string; }
interface Classification { id: number; name: string; }

const API = 'http://localhost:3000';

export default function ObjectTypeDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [ot, setOt] = useState<ObjectType | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [dataTypes, setDataTypes] = useState<DataType[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ObjectType>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API}/api/admin/object-types/${id}`).then(r => r.json()),
      fetch(`${API}/api/admin/object-types/${id}/relationships`).then(r => r.json()),
      fetch(`${API}/api/admin/data-types`).then(r => r.json()),
      fetch(`${API}/api/admin/classifications`).then(r => r.json()),
    ]).then(([otData, relData, dtData, clData]) => {
      setOt(otData.data);
      setForm(otData.data || {});
      setRelationships(relData.data || []);
      setDataTypes(dtData.data || []);
      setClassifications(clData.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    const r = await fetch(`${API}/api/admin/object-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setOt(d.data);
    setForm(d.data);
    setSaving(false);
    setEditing(false);
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    </Layout>
  );

  if (!ot) return (
    <Layout>
      <div className="text-center py-20 text-gray-500">Object type not found.</div>
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
          <Link href="/admin/object-types" className="hover:text-gray-700">Object Types</Link>
          {' / '}
          <span className="text-gray-800 font-medium">{ot.name_singular}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{ot.name_singular}</h1>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setForm(ot); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Details</h2>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name Singular</label>
              <input className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.name_singular || ''} onChange={e => setForm(f => ({ ...f, name_singular: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name Plural</label>
              <input className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.name_plural || ''} onChange={e => setForm(f => ({ ...f, name_plural: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data Type</label>
              <select className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.data_type_id || ''} onChange={e => setForm(f => ({ ...f, data_type_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">— None —</option>
                {dataTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Classification</label>
              <select className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.classification_id || ''} onChange={e => setForm(f => ({ ...f, classification_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">— None —</option>
                {classifications.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Database ID</label>
              <input className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.database_id || ''} onChange={e => setForm(f => ({ ...f, database_id: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Default Attr Caption</label>
              <input className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" value={form.default_attr_caption || ''} onChange={e => setForm(f => ({ ...f, default_attr_caption: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.is_abstract} onChange={e => setForm(f => ({ ...f, is_abstract: e.target.checked }))} />
                Abstract
              </label>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['ID', ot.id],
              ['Name Singular', ot.name_singular],
              ['Name Plural', ot.name_plural || '—'],
              ['Data Type', ot.data_type_name || '—'],
              ['Abstract', ot.is_abstract ? 'Yes' : 'No'],
              ['Classification', ot.classification_name || '—'],
              ['Database ID', ot.database_id || '—'],
              ['Default Attr Caption', ot.default_attr_caption || '—'],
              ['Description', ot.description || '—'],
              ['Created', ot.created_at ? new Date(ot.created_at).toLocaleDateString() : '—'],
              ['Updated', ot.updated_at ? new Date(ot.updated_at).toLocaleDateString() : '—'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-gray-800 font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Relationships */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Relationships ({relationships.length})</h2>
          <p className="text-sm text-gray-500 mt-0.5">Where this object type appears as source or target</p>
        </div>
        {relationships.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">No relationships found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Caption</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">From</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">To</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Min</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Max</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24">Required</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((rel, i) => (
                <tr key={rel.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{rel.caption_singular || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <Link href={`/admin/object-types/${rel.from_type_id}`} className="hover:text-blue-600 hover:underline">
                      {rel.from_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <Link href={`/admin/object-types/${rel.to_type_id}`} className="hover:text-blue-600 hover:underline">
                      {rel.to_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{rel.min_relations}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{rel.max_relations ?? '∞'}</td>
                  <td className="px-4 py-3 text-center">
                    {rel.is_requirement ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Yes</span> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Attributes - B012 Implementation */}
      <AttributesSection objectTypeId={Number(id)} />
    </Layout>
  );
}

// B012: Object Type Attributes Section
interface ObjectAttribute {
  id: number;
  attribute_name: string;
  attribute_type: string;
  is_required: boolean;
  is_key: boolean;
  default_value: string | null;
  help_text: string | null;
}

function AttributesSection({ objectTypeId }: { objectTypeId: number }) {
  const [attributes, setAttributes] = useState<ObjectAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAttr, setEditingAttr] = useState<ObjectAttribute | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<ObjectAttribute>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/admin/object-types/${objectTypeId}/attributes`);
      const data = await res.json();
      if (data.success) setAttributes(data.data);
    } catch (e) {
      console.error('Failed to load attributes:', e);
    }
    setLoading(false);
  }, [objectTypeId]);

  useEffect(() => { load(); }, [load]);

  const saveAttr = async () => {
    const url = editingAttr 
      ? `http://localhost:3000/api/admin/object-types/attributes/${editingAttr.id}`
      : `http://localhost:3000/api/admin/object-types/${objectTypeId}/attributes`;
    const method = editingAttr ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    
    setEditingAttr(null);
    setShowAdd(false);
    setForm({});
    load();
  };

  const deleteAttr = async (id: number) => {
    if (!confirm('Delete this attribute?')) return;
    await fetch(`http://localhost:3000/api/admin/object-types/attributes/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-gray-800">Attribut ({attributes.length})</h2>
          <p className="text-sm text-gray-500">Object type attributes</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm({}); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Lägg till attribut
        </button>
      </div>
      
      {loading ? (
        <div className="px-6 py-8 text-center text-gray-400">Laddar...</div>
      ) : attributes.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400">Inga attribut definierade.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Namn</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Typ</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Oblig.</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Nyckel</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-32">Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr, i) => (
              <tr key={attr.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{attr.attribute_name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{attr.attribute_type}</span>
                </td>
                <td className="px-4 py-3 text-center">{attr.is_required ? '✓' : '—'}</td>
                <td className="px-4 py-3 text-center">{attr.is_key ? '★' : '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { setEditingAttr(attr); setForm(attr); }}
                    className="text-blue-600 hover:text-blue-800 text-xs mr-2">Ändra</button>
                  <button onClick={() => deleteAttr(attr.id)}
                    className="text-red-600 hover:text-red-800 text-xs">Radera</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Modal */}
      {(showAdd || editingAttr) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">{editingAttr ? 'Ändra attribut' : 'Nytt attribut'}</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Attributnamn</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.attribute_name || ''} onChange={e => setForm(f => ({ ...f, attribute_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={form.attribute_type || 'text'} onChange={e => setForm(f => ({ ...f, attribute_type: e.target.value }))}>
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="date">date</option>
                  <option value="enum">enum</option>
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.is_required} 
                    onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
                  Obligatorisk
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.is_key} 
                    onChange={e => setForm(f => ({ ...f, is_key: e.target.checked }))} />
                  Nyckel
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowAdd(false); setEditingAttr(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Avbryt</button>
              <button onClick={saveAttr}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Spara</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
