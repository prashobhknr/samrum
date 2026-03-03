import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

const API = 'http://localhost:3000';

interface Module extends Record<string, unknown> {
  id: number;
  name: string;
  description: string | null;
  allow_incomplete_versions: boolean;
  folder_id: number | null;
  folder_name: string | null;
  created_at: string | null;
  created_by: string | null;
  changed_at: string | null;
  changed_by: string | null;
}

interface Folder extends Record<string, unknown> {
  id: number;
  name: string;
  parent_id: number | null;
  description: string | null;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('sv-SE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(val);
  }
}

// ─── Module Form Modal ─────────────────────────────────────────────────────────

interface ModuleFormProps {
  folders: Folder[];
  module?: Module | null;
  onClose: () => void;
  onSaved: () => void;
}

function ModuleFormModal({ folders, module, onClose, onSaved }: ModuleFormProps) {
  const [form, setForm] = useState({
    name: module?.name ?? '',
    description: module?.description ?? '',
    allow_incomplete_versions: module?.allow_incomplete_versions ?? false,
    folder_id: module?.folder_id != null ? String(module.folder_id) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name.trim()) { setError('Modulnamn krävs'); return; }
    setSaving(true);
    setError('');
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        allow_incomplete_versions: form.allow_incomplete_versions,
        folder_id: form.folder_id ? parseInt(form.folder_id) : null,
      };
      const url = module ? `${API}/api/admin/modules/${module.id}` : `${API}/api/admin/modules`;
      const method = module ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { onSaved(); onClose(); }
      else setError(d.error ?? 'Kunde inte spara modulen');
    } catch {
      setError('Nätverksfel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{module ? 'Ändra modul' : 'Ny modul'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modulnamn <span className="text-red-500">*</span></label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.name}
              onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              placeholder="Ange modulnamn..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mapp</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
              value={form.folder_id}
              onChange={e => setForm(v => ({ ...v, folder_id: e.target.value }))}
            >
              <option value="">— Ingen mapp (rotnivå) —</option>
              {folders.map(f => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivning</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              rows={3}
              value={form.description}
              onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
              placeholder="Valfri beskrivning..."
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.allow_incomplete_versions}
              onClick={() => setForm(v => ({ ...v, allow_incomplete_versions: !v.allow_incomplete_versions }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                form.allow_incomplete_versions ? 'bg-amber-500' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.allow_incomplete_versions ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-slate-700">Tillåt ofullständiga versioner</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Module Detail Panel ────────────────────────────────────────────────────────

interface ModuleDetailProps {
  item: Module | null;
  folders: Folder[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ModuleDetail({ item, onEdit, onDelete, onClose }: ModuleDetailProps) {
  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
      <svg className="w-12 h-12 mb-3 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p className="text-sm">Välj en modul för att se detaljer</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-samrum-border bg-slate-50 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">
            {item.folder_name ?? 'Rotnivå'} › Modul
          </p>
          <h3 className="font-semibold text-slate-900 text-sm truncate">{item.name}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-samrum-border">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-samrum-blue text-white rounded hover:bg-samrum-blue-dark transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Ändra
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 border border-red-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Radera
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100">
          {[
            { label: 'Modulnamn', value: item.name },
            { label: 'Mapp', value: item.folder_name ?? '—' },
            { label: 'Tillåt ofullständiga versioner', value: item.allow_incomplete_versions ? 'Ja' : 'Nej' },
            { label: 'Beskrivning', value: item.description ?? '—' },
            { label: 'Skapad datum', value: formatDate(item.created_at) },
            { label: 'Skapad av', value: item.created_by ?? '—' },
            { label: 'Ändrad datum', value: formatDate(item.changed_at) },
            { label: 'Ändrad av', value: item.changed_by ?? '—' },
          ].map(row => (
            <div key={row.label} className="px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
              <p className="text-sm text-slate-900 font-medium break-words">{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-samrum-border bg-slate-50">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.allow_incomplete_versions
            ? 'bg-amber-100 text-amber-700'
            : 'bg-green-100 text-green-700'
          }`}>
          {item.allow_incomplete_versions ? 'Tillåter ofullständiga' : 'Kräver komplett data'}
        </span>
      </div>
    </div>
  );
}

function buildTree(folders: Folder[], modules: Module[]): TreeNode[] {
  const folderMap: Record<number, TreeNode> = {};
  const roots: TreeNode[] = [];

  folders.forEach(f => {
    folderMap[f.id] = {
      id: `f_${f.id}`,
      label: f.name,
      type: 'folder',
      children: [],
      meta: f,
    };
  });

  folders.forEach(f => {
    if (f.parent_id && folderMap[f.parent_id]) {
      folderMap[f.parent_id].children!.push(folderMap[f.id]);
    } else {
      roots.push(folderMap[f.id]);
    }
  });

  modules.forEach(m => {
    const node: TreeNode = {
      id: m.id,
      label: m.name,
      type: 'file',
      meta: m,
    };
    if (m.folder_id && folderMap[m.folder_id]) {
      folderMap[m.folder_id].children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Module | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [filteredModules, setFilteredModules] = useState<Module[]>([]);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    Promise.all([
      fetch(`${API}/api/admin/modules`, { headers }).then(r => r.json()),
      fetch(`${API}/api/admin/module-folders`, { headers }).then(r => r.json()),
    ]).then(([mRes, fRes]) => {
      const mods: Module[] = mRes.success ? mRes.data : [];
      const folds: Folder[] = fRes.success ? fRes.data : [];
      setModules(mods);
      setFolders(folds);
      setFilteredModules(mods);
      setTreeNodes(buildTree(folds, mods));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (mod: Module) => {
    if (!confirm(`Radera modulen "${mod.name}"? Denna åtgärd kan inte ångras.`)) return;
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${API}/api/admin/modules/${mod.id}`, { method: 'DELETE', headers });
    setSelected(null);
    load();
  };

  const handleTreeSelect = (node: TreeNode) => {
    if (!String(node.id).startsWith('f_')) {
      // Module leaf in tree → show detail panel for editing
      setSelected(node.meta as Module);
    } else {
      // Folder in tree → filter grid to that folder
      const folderId = parseInt(String(node.id).replace('f_', ''));
      setFilteredModules(modules.filter(m => m.folder_id === folderId));
      setSelected(null);
    }
  };

  const columns: Column<Module>[] = [
    { key: 'id', header: 'ID', width: '60px', sortable: true, filterable: true },
    { key: 'name', header: 'Modulnamn', sortable: true, filterable: true },
    {
      key: 'folder_name',
      header: 'Mapp',
      sortable: true,
      filterable: true,
      render: v => v
        ? <span>{String(v)}</span>
        : <span className="text-slate-400 italic text-xs">—</span>,
    },
    {
      key: 'allow_incomplete_versions',
      header: 'Tillåt ofullständiga',
      sortable: true,
      filterable: false,
      render: v => v
        ? <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Nej</span>,
    },
    {
      key: 'description',
      header: 'Beskrivning',
      sortable: false,
      filterable: true,
      defaultHidden: false,
      render: v => v
        ? <span className="text-xs text-slate-600 line-clamp-1">{String(v)}</span>
        : <span className="text-slate-400 italic text-xs">—</span>,
    },
    {
      key: 'created_at',
      header: 'Skapad datum',
      sortable: true,
      filterable: true,
      defaultHidden: true,
      render: v => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(v as string)}</span>,
    },
    {
      key: 'created_by',
      header: 'Skapad av',
      sortable: true,
      filterable: true,
      defaultHidden: true,
      render: v => v
        ? <span className="text-xs text-slate-600">{String(v)}</span>
        : <span className="text-slate-400 italic text-xs">—</span>,
    },
    {
      key: 'changed_at',
      header: 'Ändrad datum',
      sortable: true,
      filterable: true,
      defaultHidden: true,
      render: v => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(v as string)}</span>,
    },
    {
      key: 'changed_by',
      header: 'Ändrad av',
      sortable: true,
      filterable: true,
      defaultHidden: true,
      render: v => v
        ? <span className="text-xs text-slate-600">{String(v)}</span>
        : <span className="text-slate-400 italic text-xs">—</span>,
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa ny',
      variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>,
      onClick: () => { setEditingModule(null); setShowForm(true); },
    },
    {
      label: 'Visa alla',
      onClick: () => { setFilteredModules(modules); setSelected(null); },
    },
  ];

  return (
    <>
      <SamrumLayout
        sidebar={
          <TreeNav
            nodes={treeNodes}
            onSelect={handleTreeSelect}
            defaultExpanded={false}
          />
        }
        sidebarTitle="Modulhierarki"
        rightPanel={
          <ModuleDetail
            item={selected}
            folders={folders}
            onEdit={() => { setEditingModule(selected); setShowForm(true); }}
            onDelete={() => selected && handleDelete(selected)}
            onClose={() => setSelected(null)}
          />
        }
        rightPanelTitle="Moduldetaljer"
      >
        <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-slate-900">Moduler</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">B011 – Administrera moduler</h1>
          <p className="text-sm text-slate-500">{modules.length} moduler i {folders.length} mappar</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={columns}
            data={filteredModules}
            loading={loading}
            selectable
            columnSelector
            columnFilters
            toolbarActions={toolbar}
            onSearch={q => {
              setFilteredModules(q
                ? modules.filter(m =>
                  m.name.toLowerCase().includes(q.toLowerCase()) ||
                  (m.description ?? '').toLowerCase().includes(q.toLowerCase()) ||
                  (m.folder_name ?? '').toLowerCase().includes(q.toLowerCase())
                )
                : modules);
            }}
            searchPlaceholder="Sök modul..."
            onRowClick={row => router.push(`/admin/modules/${row.id}`)}
            totalCount={filteredModules.length}
            emptyMessage="Inga moduler hittades"
          />
        </div>
      </SamrumLayout>

      {showForm && (
        <ModuleFormModal
          folders={folders}
          module={editingModule}
          onClose={() => { setShowForm(false); setEditingModule(null); }}
          onSaved={() => {
            load();
            if (editingModule) setSelected(null);
          }}
        />
      )}
    </>
  );
}
