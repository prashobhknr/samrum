import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

interface ColDef {
  key: string;
  label: string;
  type: string;
  is_required: boolean;
  is_key: boolean;
}

interface ModuleInfo {
  id: number;
  name: string;
  description: string | null;
  folder_name: string | null;
  allow_incomplete_versions: boolean;
  created_at: string | null;
  created_by: string | null;
  changed_at: string | null;
  changed_by: string | null;
  oms_object_type: { id: number; name: string } | null;
}

interface InstanceRow extends Record<string, unknown> {
  _id: number;
  _external_id: string;
  _name: string;
  [key: string]: unknown;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try { return new Date(val).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(val); }
}

function toLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function RightPanel({ module }: { module: ModuleInfo | null }) {
  if (!module) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center text-sm">
      Välj en modul för att se information
    </div>
  );
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modulinformation</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        {/* Beskrivning */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Modulbeskrivning</p>
          <p className="text-slate-600">{module.description || <span className="italic text-slate-400">Ingen beskrivning</span>}</p>
        </div>

        {/* Objekttyp */}
        {module.oms_object_type && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Objekttyp</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {module.oms_object_type.name}
            </span>
          </div>
        )}

        {/* Versioner */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Versioner</p>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Lås aktuell version</span>
            <button className="text-blue-600 hover:underline">Lås</button>
          </div>
          <div className="border border-slate-200 rounded text-xs overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 font-medium text-slate-600">
              <span className="flex-1">Version</span><span>Datum</span>
            </div>
            <div className="px-3 py-2 text-slate-500 italic">Arbetsversion</div>
          </div>
        </div>

        {/* Generella utskrifter */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Generella utskrifter</p>
          <p className="text-xs text-slate-400 italic">Det finns inga generella utskrifter att visa</p>
        </div>

        {/* Modulutskrifter */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Modulutskrifter</p>
          <p className="text-xs text-slate-400 italic">Det finns inga modulutskrifter att visa</p>
        </div>

        {/* Historik */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Historik</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Skapad datum</span><span className="text-slate-700">{formatDate(module.created_at)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Skapad av</span><span className="text-slate-700">{module.created_by || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Ändrad datum</span><span className="text-slate-700">{formatDate(module.changed_at)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Ändrad av</span><span className="text-slate-700">{module.changed_by || '—'}</span></div>
          </div>
        </div>

        {/* Vydesigner */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Vydesigner</p>
          <Link href={`/admin/modules/${module.id}/settings`} className="text-xs text-blue-600 hover:underline">
            Öppna inställningar →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ModuleInstancePage() {
  const router = useRouter();
  const { id } = router.query;

  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [colDefs, setColDefs] = useState<ColDef[]>([]);
  const [rows, setRows] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newForm, setNewForm] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getStoredToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
      const r = await fetch(`${API_URL}/api/admin/modules/${id}/instances`, { headers });
      const d = await r.json();
      if (!d.success) throw new Error(d.error ?? 'Unknown error');
      setModuleInfo(d.module);
      setColDefs(d.columns ?? []);
      // API returns instances under 'data' key
      const instances = d.data ?? d.instances ?? [];
      // Map rows: each instance has _id, _external_id, _name + attribute key-values
      const mapped: InstanceRow[] = instances.map((inst: Record<string, unknown>) => ({
        ...inst,
        _id: inst._id ?? inst.id,
        _external_id: inst._external_id ?? inst.external_id,
        _name: inst._name ?? inst.name,
      }));
      setRows(mapped);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Radera ${selectedIds.size} markerade objekt?`)) return;
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    for (const instId of selectedIds) {
      await fetch(`${API_URL}/api/objects/instances/${instId}`, { method: 'DELETE', headers });
    }
    setSelectedIds(new Set());
    loadData();
  };

  const handleCreate = async () => {
    if (!moduleInfo) return;
    const token = getStoredToken();
    await fetch(`${API_URL}/api/admin/modules/${id}/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ attributes: newForm }),
    });
    setShowCreateModal(false);
    setNewForm({});
    loadData();
  };

  // Build DataGrid columns
  const gridColumns = useMemo((): Column<InstanceRow>[] => {
    const fixed: Column<InstanceRow>[] = [
      {
        key: '_external_id',
        header: 'DörrID',
        sortable: true,
        filterable: true,
        width: '110px',
        render: (v, row) => (
          <Link href={`/objects/${row._id}`}
            className="text-blue-600 hover:underline font-medium text-xs"
            onClick={e => e.stopPropagation()}>
            {String(v ?? '—')}
          </Link>
        ),
      },
      {
        key: '_name',
        header: 'Namn',
        sortable: true,
        filterable: true,
      },
    ];

    const dynamic: Column<InstanceRow>[] = colDefs
      .filter(d => !['door_id', 'door_name'].includes(d.key))
      .slice(0, 5) // show first 5 dynamic columns by default
      .map(def => ({
        key: def.key,
        header: toLabel(def.key),
        sortable: true,
        filterable: true,
        defaultHidden: true,
      }));

    return [...fixed, ...dynamic];
  }, [colDefs]);

  const toolbar: ToolbarAction[] = [
    {
      label: '+ Skapa ny',
      variant: 'primary' as const,
      onClick: () => {
        setNewForm({});
        setShowCreateModal(true);
      },
    },
    {
      label: 'Radera',
      variant: 'danger' as const,
      onClick: handleDelete,
    },
    { label: 'Utskrifter', variant: 'secondary' as const, onClick: () => { } },
    { label: 'Exportera', variant: 'secondary' as const, onClick: () => { } },
    { label: 'Importera', variant: 'secondary' as const, onClick: () => { } },
  ];

  const rightPanel = <RightPanel module={moduleInfo} />;

  // Left sidebar: object type tree
  const sidebar = moduleInfo ? (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visa som lista</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-50 text-blue-700">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-xs font-semibold">Huvudobjekt för modul</span>
        </div>
        <div className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded bg-blue-100 text-blue-800">
          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
          </svg>
          <span className="text-xs font-semibold">{moduleInfo.oms_object_type?.name ?? 'Objekt'} ({rows.length})</span>
        </div>
        <div className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
          <span className="text-xs">Ofullständiga objekt</span>
        </div>
        <div className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
          <span className="text-xs">Valideringsfel</span>
        </div>
      </div>
    </div>
  ) : undefined;

  return (
    <SamrumLayout
      sidebar={sidebar}
      sidebarTitle="Visa som lista"
      rightPanel={rightPanel}
      rightPanelTitle="Modulinformation"
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => router.back()} className="hover:text-slate-700">← Tillbaka</button>
            {moduleInfo && (
              <>
                <span>›</span>
                <span>{moduleInfo.folder_name}</span>
                <span>›</span>
                <span className="font-medium text-slate-900">{moduleInfo.name}</span>
              </>
            )}
          </div>
          {moduleInfo && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{moduleInfo.name}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{moduleInfo.folder_name}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${moduleInfo.allow_incomplete_versions
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
                }`}>
                {moduleInfo.allow_incomplete_versions ? 'Tillåter ofullständiga' : 'Kräver komplett data'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-3 px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">{error}</div>
        )}

        {/* DataGrid */}
        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={gridColumns}
            data={rows}
            loading={loading}
            toolbarActions={toolbar}
            selectable
            onSelectionChange={(ids) => setSelectedIds(new Set(ids as number[]))}
            emptyMessage="Inga objekt i modulen"
            totalCount={rows.length}
            onRowClick={(row) => router.push(`/objects/${row._id}`)}
          />
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Skapa nytt objekt</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {colDefs.map(def => (
                <div key={def.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {toLabel(def.key)} {def.is_required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    value={newForm[def.key] ?? ''}
                    onChange={e => setNewForm(v => ({ ...v, [def.key]: e.target.value }))}
                    placeholder={`Ange ${toLabel(def.key).toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Spara</button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
