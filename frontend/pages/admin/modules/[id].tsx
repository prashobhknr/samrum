import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../../components/TreeNav';
import { getStoredToken } from '../../../lib/auth';
import DataGrid, { Column, ColumnGroup } from '../../../components/DataGrid';
import BulkEditModal from '../../../components/BulkEditModal';
import ImportModal from '../../../components/ImportModal';
import ExportModal from '../../../components/ExportModal';
import PrintModal from '../../../components/PrintModal';

const API = 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  id_column_label?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  type: string;
  is_required: boolean;
  is_key: boolean;
  enum_values: string[] | null;
  show_by_default?: boolean;
  is_editable?: boolean;
}

interface RelatedGroupDef {
  key: string;
  type_id: number;
  type_name: string;
  relationship_name: string | null;
  cardinality: string | null;
  columns: ColumnDef[];
}

interface InstanceRow extends Record<string, unknown> {
  _id: number;
  _external_id: string;
  _name: string;
  _created_at: string;
  _updated_at: string;
}

interface ModuleFolder extends Record<string, unknown> {
  id: number;
  name: string;
  parent_id: number | null;
}

interface ModuleListItem extends Record<string, unknown> {
  id: number;
  name: string;
  folder_id: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLabel(key: string): string {
  // Convert attribute_name → "Attribute Name" with some Swedish-specific mappings
  const map: Record<string, string> = {
    door_id: 'DörrID',
    door_name: 'Dörrnamn',
    door_type: 'Dörrtyp',
    lock_type: 'Låstyp',
    fire_class: 'Brandklass',
    security_class: 'Säkerhetsklass',
    width_mm: 'Bredd (mm)',
    height_mm: 'Höjd (mm)',
    location_description: 'Dörren placerad i',
    floor_level: 'Våning',
    has_access_control: 'Passagekontroll',
    has_automation: 'Automatik',
    door_closer_count: 'Antal dörrstängare',
    frame_material: 'Karmmaterial',
    door_leaf_material: 'Dörrblad material',
    finish: 'Ytbehandling',
    opening_direction: 'Öppningsriktning',
    emergency_exit: 'Nödutgång',
    sound_class: 'Ljudklass',
    glass_area: 'Glasyta',
    threshold_type: 'Tröskeltyp',
    notes: 'Anmärkningar',
    status: 'Status',
  };
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('sv-SE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(val); }
}

function buildTree(folders: ModuleFolder[], modules: ModuleListItem[]): TreeNode[] {
  const folderMap: Record<number, TreeNode> = {};
  const roots: TreeNode[] = [];

  folders.forEach(f => {
    folderMap[f.id] = { id: `f_${f.id}`, label: f.name, type: 'folder', children: [], meta: f };
  });
  folders.forEach(f => {
    if (f.parent_id && folderMap[f.parent_id]) folderMap[f.parent_id].children!.push(folderMap[f.id]);
    else roots.push(folderMap[f.id]);
  });
  modules.forEach(m => {
    const node: TreeNode = { id: m.id, label: m.name, type: 'file', meta: m };
    if (m.folder_id && folderMap[m.folder_id]) folderMap[m.folder_id].children!.push(node);
    else roots.push(node);
  });

  return roots;
}

// ─── Right panel: Module Info ─────────────────────────────────────────────────

function ModuleInfoPanel({ module: mod }: { module: ModuleInfo | null }) {
  if (!mod) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Laddar…</div>
  );

  return (
    <div className="flex flex-col h-full text-sm overflow-y-auto divide-y divide-slate-100">
      {/* Modulbeskrivning */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modulbeskrivning</p>
        <p className="text-slate-700 text-xs leading-relaxed">
          {mod.description ?? <span className="italic text-slate-400">Ingen beskrivning</span>}
        </p>
      </div>

      {/* Object type */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Objekttyp</p>
        <span className="bg-samrum-blue/10 text-samrum-blue text-xs px-2 py-1 rounded font-medium">
          {mod.oms_object_type?.name ?? '—'}
        </span>
      </div>

      {/* Status */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Versioner</p>
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>Lås aktuell version</span>
          <button className="text-samrum-blue hover:underline text-xs">Lås</button>
        </div>
        <div className="border border-slate-200 rounded text-xs">
          <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 font-medium text-slate-500 border-b border-slate-200">
            <span>Version</span><span>Datum</span>
          </div>
          <div className="px-3 py-2 text-slate-400 italic">Arbetsversion</div>
        </div>
      </div>

      {/* Generella utskrifter */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Generella utskrifter</p>
        <p className="text-xs text-slate-400 italic">Det finns inga generella utskrifter att visa</p>
      </div>

      {/* Modulutskrifter */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modulutskrifter</p>
        <p className="text-xs text-slate-400 italic">Det finns inga modulutskrifter att visa</p>
      </div>

      {/* Audit */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historik</p>
        {[
          ['Skapad', formatDate(mod.created_at)],
          ['Skapad av', mod.created_by ?? '—'],
          ['Ändrad', formatDate(mod.changed_at)],
          ['Ändrad av', mod.changed_by ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs py-0.5">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-700 font-medium truncate max-w-[140px]" title={value}>{value}</span>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vydesigner</p>
        <Link href={`/admin/view-designer?module=${mod.id}`}
          className="text-xs text-samrum-blue hover:underline block">
          Öppna inställningar →
        </Link>
      </div>
    </div>
  );
}

// ─── Filter Dialog ────────────────────────────────────────────────────────────

interface FilterCondition {
  column: string;
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'ne';
  value: string;
  logic: 'AND' | 'OR';
}

function FilterDialog({
  columns,
  conditions,
  onChange,
  onClose,
}: {
  columns: ColumnDef[];
  conditions: FilterCondition[];
  onChange: (c: FilterCondition[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<FilterCondition[]>(conditions.length > 0 ? conditions : [
    { column: columns[0]?.key ?? '', op: 'contains', value: '', logic: 'AND' },
  ]);

  const opLabels: Record<string, string> = {
    eq: '=', ne: '≠', contains: 'innehåller', gt: '>', lt: '<',
  };

  const addCondition = (logic: 'AND' | 'OR') => {
    setLocal(prev => [...prev, { column: columns[0]?.key ?? '', op: 'contains', value: '', logic }]);
  };

  const remove = (i: number) => setLocal(prev => prev.filter((_, j) => j !== i));

  const update = (i: number, patch: Partial<FilterCondition>) => {
    setLocal(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[600px] max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="font-semibold text-slate-800 text-sm">Filter</h3>
          <div className="flex gap-2">
            <button onClick={() => addCondition('AND')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-slate-200">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Lägg till OCH-villkor
            </button>
            <button onClick={() => addCondition('OR')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded hover:bg-slate-200">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Lägg till ELLER-villkor
            </button>
          </div>
        </div>

        {/* Conditions */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {local.length === 0 && (
            <p className="text-slate-400 text-xs italic text-center py-4">Inga filtervillkor. Lägg till villkor ovan.</p>
          )}
          {local.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              {i === 0
                ? <span className="text-xs font-semibold text-slate-500 w-12 text-right">Aktuellt</span>
                : <span className={`text-xs font-bold w-12 text-right ${cond.logic === 'OR' ? 'text-amber-600' : 'text-samrum-blue'}`}>{cond.logic}</span>}

              <select value={cond.column} onChange={e => update(i, { column: e.target.value })}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-samrum-blue/40">
                {columns.map(c => <option key={c.key} value={c.key}>{toLabel(c.key)}</option>)}
              </select>

              <select value={cond.op} onChange={e => update(i, { op: e.target.value as FilterCondition['op'] })}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none">
                {Object.entries(opLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              <input
                type="text"
                value={cond.value}
                onChange={e => update(i, { value: e.target.value })}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-samrum-blue/40"
                placeholder="Värde..."
              />

              <button onClick={() => remove(i)} title="Ta bort"
                className="text-slate-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button onClick={() => { onChange([]); onClose(); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Avbryt
          </button>
          <button onClick={() => { onChange(local.filter(c => c.value)); onClose(); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-samrum-blue text-white rounded hover:bg-samrum-blue-dark">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ModuleInstanceViewPage() {
  const router = useRouter();
  const { id } = router.query;
  const moduleId = Number(id);

  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [colDefs, setColDefs] = useState<ColumnDef[]>([]);
  const [relatedGroupDefs, setRelatedGroupDefs] = useState<RelatedGroupDef[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Tree nav data
  const [folders, setFolders] = useState<ModuleFolder[]>([]);
  const [allModules, setAllModules] = useState<ModuleListItem[]>([]);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [treeSelectedId, setTreeSelectedId] = useState<string | number>(moduleId);

  // Filter dialog
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

  // Bulk edit
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Import / Export / Print
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  // Load tree data once
  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    Promise.all([
      fetch(`${API}/api/admin/module-folders`, { headers }).then(r => r.json()),
      fetch(`${API}/api/admin/modules`, { headers }).then(r => r.json()),
    ]).then(([fRes, mRes]) => {
      const f: ModuleFolder[] = fRes.success ? fRes.data : [];
      const m: ModuleListItem[] = mRes.success ? mRes.data : [];
      setFolders(f);
      setAllModules(m);
    });
  }, []);

  // Rebuild tree when data changes
  useEffect(() => {
    if (folders.length || allModules.length) {
      setTreeNodes(buildTree(folders, allModules));
    }
  }, [folders, allModules]);

  // Load module instances when id changes
  const loadInstances = useCallback(() => {
    if (!moduleId) return;
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API}/api/admin/modules/${moduleId}/instances`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setModuleInfo(data.module);
          setColDefs(data.columns ?? []);
          setRelatedGroupDefs(data.related_groups ?? []);
          setInstances(data.data ?? []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [moduleId]);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  // Apply filter conditions to instances
  const filteredInstances = useMemo(() => {
    if (!filterConditions.length) return instances;
    let result: InstanceRow[] = [];
    let firstPassed = false;

    for (let i = 0; i < filterConditions.length; i++) {
      const cond = filterConditions[i];
      const matchingRows = instances.filter(row => {
        const cell = String(row[cond.column] ?? '').toLowerCase();
        const v = cond.value.toLowerCase();
        switch (cond.op) {
          case 'eq': return cell === v;
          case 'ne': return cell !== v;
          case 'contains': return cell.includes(v);
          case 'gt': return parseFloat(cell) > parseFloat(v);
          case 'lt': return parseFloat(cell) < parseFloat(v);
          default: return true;
        }
      });

      if (i === 0) { result = matchingRows; firstPassed = true; }
      else if (cond.logic === 'AND') { result = result.filter(r => matchingRows.includes(r)); }
      else { result = Array.from(new Set([...result, ...matchingRows])); }
    }

    return firstPassed ? result : instances;
  }, [instances, filterConditions]);

  // Helper: build column def from API column def
  function makeColumn(def: ColumnDef): Column<InstanceRow> {
    return {
      key: def.key,
      header: def.label || toLabel(def.key),
      sortable: true,
      filterable: true,
      // Show by default only if explicitly flagged — keeps large per-module column lists manageable
      defaultHidden: def.show_by_default === false,
      render: (v: unknown) => {
        if (v === null || v === undefined) return <span className="text-slate-300 text-xs">—</span>;
        if (def.type === 'boolean') {
          return v === 'true' || v === true
            ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
            : <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">Nej</span>;
        }
        if (def.type === 'number') return <span className="font-mono text-xs">{String(v)}</span>;
        return <span className="text-xs">{String(v)}</span>;
      },
    };
  }

  // Build DataGrid columns from ColumnDefs (primary columns only)
  const gridColumns = useMemo((): Column<InstanceRow>[] => {
    const fixed: Column<InstanceRow>[] = [
      {
        key: '_external_id',
        header: moduleInfo?.id_column_label ?? 'Objekt-ID',
        sortable: true,
        filterable: true,
        width: '110px',
        render: (v, row) => (
          <Link href={`/objects/${row._id}?module=${moduleId}`}
            className="text-samrum-blue hover:underline font-medium text-xs"
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

    const dynamic: Column<InstanceRow>[] = colDefs.map(makeColumn);

    const audit: Column<InstanceRow>[] = [
      {
        key: '_updated_at',
        header: 'Senast ändrad',
        sortable: true,
        filterable: false,
        defaultHidden: true,
        render: v => <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(v as string)}</span>,
      },
    ];

    return [...fixed, ...dynamic, ...audit];
  }, [colDefs, moduleInfo?.id_column_label]);

  // Build column groups from related group defs
  const gridColumnGroups = useMemo((): ColumnGroup<InstanceRow>[] => {
    return relatedGroupDefs.map(g => ({
      key: g.key,
      label: g.type_name,
      relationshipName: g.relationship_name ?? undefined,
      cardinality: g.cardinality ?? undefined,
      defaultExpanded: false,
      columns: g.columns.map(def => makeColumn({ ...def, key: `${g.key.replace('rel_', '')}__${def.key}` })),
    }));
  }, [relatedGroupDefs]);

  const activeFilterCount = filterConditions.filter(c => c.value).length;

  const toolbarActions = [
    {
      label: 'Skapa ny',
      variant: 'primary' as const,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => router.push(`/objects/new?module=${moduleId}`),
    },
    {
      label: 'Radera',
      variant: 'danger' as const,
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      onClick: () => alert('Radera markerade'),
    },
    {
      label: 'Utskrifter',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
      disabled: selectedIds.length === 0,
      onClick: () => setPrintOpen(true),
    },
    {
      label: 'Exportera',
      onClick: () => setExportOpen(true),
    },
    {
      label: 'Importera',
      onClick: () => setImportOpen(true),
    },
    {
      label: 'Gruppvis ändring',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      disabled: selectedIds.length === 0,
      onClick: () => router.push(`/objects/bulk-edit?module=${moduleId}&ids=${selectedIds.join(',')}`),
    },
    {
      label: activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>,
      variant: activeFilterCount > 0 ? 'primary' as const : 'secondary' as const,
      onClick: () => setFilterOpen(true),
    },
  ];

  return (
    <>
      <SamrumLayout
        sidebar={
          <TreeNav
            nodes={treeNodes}
            selectedId={treeSelectedId}
            onSelect={node => {
              setTreeSelectedId(node.id);
              if (!String(node.id).startsWith('f_')) {
                router.push(`/admin/modules/${node.id}`);
              }
            }}
            defaultExpanded
          />
        }
        sidebarTitle="Visa som lista"
        rightPanel={<ModuleInfoPanel module={moduleInfo} />}
        rightPanelTitle="Modulinformation"
        rightPanelWidth="300px"
      >
        {/* Breadcrumb + header */}
        <div className="px-6 py-3 bg-white border-b border-samrum-border flex-shrink-0">
          <nav className="flex items-center gap-1 text-xs text-slate-500 mb-1">
            <Link href="/admin" className="hover:text-samrum-blue">Admin</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <Link href="/admin/modules" className="hover:text-samrum-blue">Moduler</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="font-medium text-slate-800 truncate max-w-xs">{moduleInfo?.name ?? '…'}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-slate-900">{moduleInfo?.name ?? 'Laddar…'}</h1>
              {moduleInfo?.folder_name && (
                <p className="text-xs text-slate-400">{moduleInfo.folder_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {moduleInfo?.allow_incomplete_versions ? (
                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Tillåter ofullständiga</span>
              ) : (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Kräver komplett data</span>
              )}
              <span className="text-xs text-slate-400">
                {filteredInstances.length !== instances.length
                  ? `${filteredInstances.length} av ${instances.length} objekt`
                  : `${instances.length} objekt`}
              </span>
            </div>
          </div>
        </div>

        {/* DataGrid */}
        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={gridColumns}
            data={filteredInstances}
            loading={loading}
            keyField="_id"
            selectable
            onSelectionChange={setSelectedIds}
            columnSelector
            columnFilters
            columnGroups={gridColumnGroups.length > 0 ? gridColumnGroups : undefined}
            toolbarActions={toolbarActions}
            emptyMessage={
              filterConditions.length > 0
                ? 'Inga objekt matchar filtret'
                : 'Inga objekt i denna modul'
            }
            totalCount={filteredInstances.length}
          />
        </div>
      </SamrumLayout>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedIds={selectedIds}
        columns={gridColumns as any}
        onSave={async (attrValues) => {
          const token = getStoredToken();
          const res = await fetch(`${API}/api/objects/instances/bulk-update`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              ids: selectedIds,
              attribute_values: attrValues
            })
          });
          if (!res.ok) throw new Error('Misslyckades att uppdatera poster');
          await loadInstances();
        }}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        moduleId={moduleId}
        columns={colDefs}
        onImported={loadInstances}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        moduleId={moduleId}
        moduleName={moduleInfo?.name}
        selectedIds={selectedIds}
      />

      {/* Print Modal */}
      <PrintModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        selectedIds={selectedIds}
        moduleName={moduleInfo?.name}
      />

      {/* Filter dialog */}
      {filterOpen && (
        <FilterDialog
          columns={colDefs}
          conditions={filterConditions}
          onChange={setFilterConditions}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </>
  );
}
