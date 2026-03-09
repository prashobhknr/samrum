import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SamrumLayout from '../../components/SamrumLayout';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

interface Project extends Record<string, unknown> {
  id: number;
  name: string;
  database_name: string | null;
  description: string | null;
  is_active: boolean;
  module_count: number;
  created_at: string;
}

interface ProjectFormProps {
  item: Partial<Project> | null;
  onClose: () => void;
  onSave: (data: Partial<Project>) => Promise<void>;
}

function ProjectForm({ item, onClose, onSave }: ProjectFormProps) {
  const [form, setForm] = useState<Partial<Project>>(item ?? {});
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const isNew = !item.id;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-samrum-border">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isNew ? 'Skapa nytt projekt' : 'Ändra projekt'}
            </h2>
            {isNew && (
              <p className="text-xs text-slate-500 mt-0.5">
                Alla moduler tilldelas automatiskt till det nya projektet
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Projektnamn <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-samrum-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30"
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="t.ex. Kv Vallgossen, Enköping"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Databasnamn
            </label>
            <input
              className="w-full border border-samrum-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 font-mono"
              value={form.database_name ?? ''}
              onChange={e => setForm(f => ({ ...f, database_name: e.target.value }))}
              placeholder="SAMRUM_ProjektNamn"
            />
            <p className="text-xs text-slate-400 mt-1">SQL Server-databasidentifierare</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Beskrivning
            </label>
            <textarea
              rows={3}
              className="w-full border border-samrum-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 resize-none"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Valfri beskrivning av projektet"
            />
          </div>

          {!isNew && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${form.is_active ? 'bg-green-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                  ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <label className="text-sm text-slate-700">
                {form.is_active ? 'Projekt aktivt' : 'Projekt inaktivt'}
              </label>
            </div>
          )}

          {isNew && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-blue-700">Automatisk modulinitiering</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Alla 271 moduler tilldelas automatiskt till det nya projektet. Du kan sedan
                  aktivera/inaktivera moduler individuellt.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-samrum-border bg-slate-50 rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name?.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-samrum-blue text-white hover:bg-samrum-blue-dark rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Sparar...
              </>
            ) : isNew ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Skapa projekt
              </>
            ) : 'Spara ändringar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProjectsPage() {
  const router = useRouter();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Partial<Project> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch('http://localhost:3000/api/admin/projects', { headers })
      .then(r => r.json())
      .then(d => setData(d.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: Partial<Project>) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id
      ? `http://localhost:3000/api/admin/projects/${form.id}`
      : 'http://localhost:3000/api/admin/projects';
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(url, {
      method,
      headers,
      body: JSON.stringify(form),
    });
    setEditItem(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    await fetch(`http://localhost:3000/api/admin/projects/${deleteTarget.id}`, { method: 'DELETE', headers });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const columns: Column<Project>[] = [
    {
      key: 'id', header: 'ID', sortable: true, width: '60px',
      render: v => <span className="text-xs font-mono text-slate-400">{String(v)}</span>,
    },
    {
      key: 'name', header: 'Projektnamn', sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-medium text-slate-900">{String(v)}</p>
          {row.description && <p className="text-xs text-slate-500 truncate max-w-xs">{String(row.description)}</p>}
        </div>
      ),
    },
    {
      key: 'database_name', header: 'Databas',
      render: v => v
        ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{String(v)}</span>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'module_count', header: 'Moduler',
      render: v => (
        <span className="text-sm font-medium text-samrum-blue">{String(v)}</span>
      ),
    },
    {
      key: 'is_active', header: 'Status',
      render: v => v
        ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Aktiv</span>
        : <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium">Inaktiv</span>,
    },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          <Link href={`/project/${row.id}`}
            className="text-xs text-samrum-blue hover:underline font-medium">Öppna</Link>
          <button onClick={() => setEditItem(row)}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium">Ändra</button>
          <button onClick={() => setDeleteTarget(row)}
            className="text-xs text-red-500 hover:text-red-700 font-medium">Radera</button>
        </div>
      ),
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa nytt projekt', variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => setEditItem({ is_active: true }),
    },
  ];

  return (
    <SamrumLayout>
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Admin</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-slate-900">Projektdatabaser</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">B010 – Administrera projektdatabaser</h1>
            <p className="text-sm text-slate-500">{data.length} projekt</p>
          </div>
          <Link href="/select-project"
            className="flex items-center gap-2 px-4 py-2 bg-samrum-accent text-white text-sm font-medium rounded-lg hover:bg-samrum-accent-hover transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Val av projekt
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        <DataGrid
          columns={columns}
          data={data}
          loading={loading}
          selectable
          toolbarActions={toolbar}
          onSearch={q => {
            if (!q) { load(); return; }
            setData(prev => prev.filter(p =>
              p.name.toLowerCase().includes(q.toLowerCase()) ||
              p.database_name?.toLowerCase().includes(q.toLowerCase()) ||
              p.description?.toLowerCase().includes(q.toLowerCase())
            ));
          }}
          searchPlaceholder="Sök projekt..."
          onRowClick={row => router.push(`/project/${row.id}`)}
          totalCount={data.length}
          emptyMessage="Inga projekt hittades"
        />
      </div>

      {/* Edit/Create modal */}
      {editItem !== null && (
        <ProjectForm item={editItem} onClose={() => setEditItem(null)} onSave={handleSave} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Radera projekt?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  <strong className="text-slate-700">{deleteTarget.name}</strong> och alla dess modulkopplingar
                  raderas permanent.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100 transition-colors">
                Avbryt
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2">
                {deleting ? 'Raderar...' : 'Ja, radera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
