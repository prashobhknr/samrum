import React, { useEffect, useState } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

interface Classification extends Record<string, unknown> {
  id: number;
  name: string;
  description: string;
}

interface ModalProps {
  item: Partial<Classification> | null;
  onClose: () => void;
  onSave: (item: Partial<Classification>) => void;
}

function EditModal({ item, onClose, onSave }: ModalProps) {
  const [form, setForm] = useState<Partial<Classification>>(item ?? {});

  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-samrum-border">
          <h2 className="text-lg font-semibold text-slate-900">
            {item.id ? 'Ändra klassifikation' : 'Ny klassifikation'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
            <input
              className="w-full border border-samrum-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30"
              value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Klassifikationsnamn"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivning</label>
            <textarea
              rows={3}
              className="w-full border border-samrum-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 resize-none"
              value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Valfri beskrivning"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-samrum-border bg-slate-50 rounded-b-xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
            Avbryt
          </button>
          <button onClick={() => onSave(form)}
            className="px-4 py-2 text-sm font-medium bg-samrum-blue text-white hover:bg-samrum-blue-dark rounded-lg transition-colors">
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClassificationsPage() {
  const [data, setData] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Partial<Classification> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch('http://localhost:3000/api/admin/classifications', { headers })
      .then(r => r.json())
      .then(r => setData(r.data ?? r))
      .catch(() => setError('Kunde inte ladda klassifikationer'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form: Partial<Classification>) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id
      ? `http://localhost:3000/api/admin/classifications/${form.id}`
      : 'http://localhost:3000/api/admin/classifications';

    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(url, { method, headers, body: JSON.stringify(form) });
    setEditItem(null);
    load();
  };

  const handleDelete = async (id: number) => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    await fetch(`http://localhost:3000/api/admin/classifications/${id}`, { method: 'DELETE', headers });
    setDeleteId(null);
    load();
  };

  const columns: Column<Classification>[] = [
    { key: 'id', header: 'ID', sortable: true, width: '80px' },
    { key: 'name', header: 'Namn', sortable: true },
    { key: 'description', header: 'Beskrivning', render: v => v ? String(v) : <span className="text-slate-400 italic">—</span> },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={e => { e.stopPropagation(); setEditItem(row); }}
            className="text-xs text-samrum-blue hover:underline font-medium">Ändra</button>
          <button onClick={e => { e.stopPropagation(); setDeleteId(row.id); }}
            className="text-xs text-red-500 hover:underline font-medium">Radera</button>
        </div>
      ),
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa ny',
      variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => setEditItem({}),
    },
  ];

  return (
    <SamrumLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 bg-white border-b border-samrum-border">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-slate-900">Klassifikationer</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">B013 – Klassifikationer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Administrera klassifikationssystem för objekttyper</p>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={columns}
            data={data}
            loading={loading}
            toolbarActions={toolbar}
            selectable
            onSearch={(q) => {
              if (!q) { load(); return; }
              setData(prev => prev.filter(r =>
                r.name?.toLowerCase().includes(q.toLowerCase()) ||
                r.description?.toLowerCase().includes(q.toLowerCase())
              ));
            }}
            searchPlaceholder="Sök klassifikation..."
            emptyMessage="Inga klassifikationer hittades"
            onRowClick={row => setEditItem(row)}
            totalCount={data.length}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {editItem !== null && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} onSave={handleSave} />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Bekräfta borttagning</h3>
            <p className="text-sm text-slate-500 mb-6">Är du säker på att du vill radera denna klassifikation?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100 transition-colors">Avbryt</button>
              <button onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Radera
              </button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
