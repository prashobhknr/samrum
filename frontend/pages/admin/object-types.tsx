import React, { useEffect, useState, useCallback } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

interface ObjectType extends Record<string, unknown> {
  id: number;
  database_id: string;
  name_singular: string;
  name_plural: string;
  default_attr_caption: string;
  description: string | null;
  is_abstract: boolean;
  data_type_name: string;
  classification_name: string | null;
  classification_id: number | null;
  exists_only_in_parent_scope: boolean;
}

interface DetailPanelProps {
  item: ObjectType | null;
  onEdit: () => void;
  onClose: () => void;
}

function DetailPanel({ item, onEdit, onClose }: DetailPanelProps) {
  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
      <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M9 3h6" />
      </svg>
      <p className="text-sm">Välj en objekttyp för att se detaljer</p>
    </div>
  );

  const rows = [
    { label: 'AdministrationsId', value: item.database_id },
    { label: 'Namn, singular', value: item.name_singular },
    { label: 'Namn, plural', value: item.name_plural },
    { label: 'Datatyp', value: item.data_type_name },
    { label: 'Klassificering', value: item.classification_name ?? '—' },
    { label: 'Rubrik för Id', value: item.default_attr_caption },
    { label: 'Är abstrakt', value: item.is_abstract ? 'Ja' : 'Nej' },
    { label: 'Existerar med förälder', value: item.exists_only_in_parent_scope ? 'Ja' : 'Nej' },
    { label: 'Beskrivning', value: item.description ?? '—' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-samrum-border bg-slate-50 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">
            Objekttyper › {item.classification_name ?? 'Ej klassificerade'}
          </p>
          <h3 className="font-semibold text-slate-900 text-sm truncate">{item.name_singular}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-3 border-b border-samrum-border">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-samrum-blue text-white rounded hover:bg-samrum-blue-dark transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Ändra
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100">
          {rows.map(row => (
            <div key={row.label} className="px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
              <p className="text-sm text-slate-900 font-medium break-words">{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status badges */}
      <div className="px-4 py-3 border-t border-samrum-border bg-slate-50">
        <div className="flex flex-wrap gap-2">
          {item.is_abstract && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Abstrakt</span>
          )}
          {item.exists_only_in_parent_scope && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Existerar med förälder</span>
          )}
          {!item.is_abstract && !item.exists_only_in_parent_scope && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Aktivt objekt</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ObjectTypesPage() {
  const [data, setData] = useState<ObjectType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<ObjectType | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  const pageSize = 50;

  const load = useCallback((p = 1, q = '', classId?: string | null) => {
    setLoading(true);
    let url = `http://localhost:3000/api/admin/object-types?page=${p}&pageSize=${pageSize}`;
    if (q) url += `&search=${encodeURIComponent(q)}`;
    if (classId) url += `&classificationId=${classId}`;

    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch(url, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data ?? []);
          setTotal(d.total ?? d.data?.length ?? 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build classification tree from data
  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch('http://localhost:3000/api/admin/object-types?page=1&pageSize=1400', { headers })
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        const all: ObjectType[] = d.data ?? [];

        const groups: Record<string, ObjectType[]> = {};
        all.forEach(ot => {
          const key = ot.classification_name ?? 'Ej klassificerade';
          if (!groups[key]) groups[key] = [];
          groups[key].push(ot);
        });

        const nodes: TreeNode[] = [
          {
            id: 'all',
            label: `Alla objekttyper (${all.length})`,
            type: 'folder',
            children: Object.entries(groups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, items]) => ({
                id: `class_${name}`,
                label: `${name} (${items.length})`,
                type: 'folder' as const,
                meta: { classificationName: name },
                children: items.slice(0, 20).map(ot => ({
                  id: ot.id,
                  label: ot.name_singular,
                  type: 'file' as const,
                  meta: ot,
                })),
              })),
          },
        ];
        setTreeNodes(nodes);
      });
  }, []);

  useEffect(() => { load(1, search, selectedFilter); }, []);

  const columns: Column<ObjectType>[] = [
    {
      key: 'database_id', header: 'AdministrationsId', sortable: true,
      render: v => <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{String(v)}</span>,
    },
    { key: 'name_singular', header: 'Namn (singular)', sortable: true },
    { key: 'name_plural', header: 'Namn (plural)', sortable: true },
    { key: 'data_type_name', header: 'Datatyp', sortable: true },
    {
      key: 'classification_name', header: 'Klassificering',
      render: v => v ? String(v) : <span className="text-slate-400 italic text-xs">Ej angiven</span>,
    },
    {
      key: 'is_abstract', header: 'Abstrakt',
      render: v => v
        ? <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Nej</span>,
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa ny', variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => alert('Skapa ny objekttyp — ej implementerat'),
    },
    {
      label: 'Exportera',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
      onClick: () => {
        const csv = [
          ['ID', 'AdministrationsId', 'Namn', 'Datatyp', 'Klassificering'].join(','),
          ...data.map(r => [r.id, r.database_id, r.name_singular, r.data_type_name, r.classification_name ?? ''].join(',')),
        ].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'objekttyper.csv';
        a.click();
      },
    },
  ];

  const handleTreeSelect = (node: TreeNode) => {
    if (node.meta && (node.meta as Record<string, unknown>).name_singular) {
      setSelected(node.meta as unknown as ObjectType);
    } else if (node.id === 'all') {
      setSelectedFilter(null);
      setPage(1);
      load(1, search, null);
    } else if (String(node.id).startsWith('class_')) {
      const className = (node.meta as Record<string, unknown>)?.classificationName as string;
      setSelectedFilter(className);
      setPage(1);
      load(1, search, className);
    }
  };

  return (
    <SamrumLayout
      sidebar={
        <div>
          <div className="px-2 pb-2">
            <input
              type="text"
              placeholder="Filtrera träd..."
              className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-samrum-blue/30"
            />
          </div>
          <TreeNav
            nodes={treeNodes}
            onSelect={handleTreeSelect}
            defaultExpanded={true}
          />
        </div>
      }
      sidebarTitle="Visa som lista"
      rightPanel={
        <DetailPanel
          item={selected}
          onEdit={() => alert('Ändra — ej implementerat')}
          onClose={() => setSelected(null)}
        />
      }
      rightPanelTitle="Detaljer"
      rightPanelWidth="300px"
    >
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Admin</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-slate-900">Objekttyper</span>
          {selectedFilter && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-slate-900 truncate max-w-[200px]">{selectedFilter}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">B012 – Administrera objekttyper</h1>
            <p className="text-sm text-slate-500">
              {total.toLocaleString()} objekttyper {selectedFilter ? `i "${selectedFilter}"` : 'totalt'}
            </p>
          </div>
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
          onSearch={q => { setSearch(q); setPage(1); load(1, q, selectedFilter); }}
          searchPlaceholder="Sök objekttyp..."
          onRowClick={row => setSelected(row)}
          totalCount={total}
          page={page}
          pageSize={pageSize}
          onPageChange={p => { setPage(p); load(p, search, selectedFilter); }}
          emptyMessage="Inga objekttyper hittades"
        />
      </div>
    </SamrumLayout>
  );
}
