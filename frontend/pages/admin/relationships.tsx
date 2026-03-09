import React, { useEffect, useState, useCallback } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import DataGrid, { Column, ToolbarAction } from '../../components/DataGrid';
import { getStoredToken } from '../../lib/auth';

interface Relationship extends Record<string, unknown> {
  id: number;
  caption_singular: string;
  caption_plural: string;
  from_type_id: number;
  to_type_id: number;
  from_name: string;
  to_name: string;
  min_relations: number;
  max_relations: number | null;
  sort_order: number;
  allow_in_lists: boolean;
  show_in_lists_default: boolean;
  is_requirement: boolean;
  sys_caption: string | null;
}

interface DetailPanelProps {
  item: Relationship | null;
  onClose: () => void;
}

function RelationshipDetail({ item, onClose }: DetailPanelProps) {
  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
      <svg className="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p className="text-sm">Välj en relation för att se detaljer</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-samrum-border bg-slate-50 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Relation</p>
          <h3 className="font-semibold text-slate-900 text-sm truncate">{item.caption_singular}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Visual diagram */}
        <div className="mx-4 my-4 p-4 bg-slate-50 rounded-lg border border-samrum-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-samrum-border rounded p-2 text-center min-w-0">
              <p className="text-xs text-slate-500">Från</p>
              <p className="text-xs font-medium text-slate-900 truncate">{item.from_name}</p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-0.5 w-6 bg-slate-400" />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {item.min_relations}..{item.max_relations ?? '∞'}
              </span>
              <div className="h-0.5 w-6 bg-slate-400" />
            </div>
            <div className="flex-1 bg-white border border-samrum-border rounded p-2 text-center min-w-0">
              <p className="text-xs text-slate-500">Till</p>
              <p className="text-xs font-medium text-slate-900 truncate">{item.to_name}</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {[
            { label: 'Titel (singular)', value: item.caption_singular },
            { label: 'Titel (plural)', value: item.caption_plural },
            { label: 'Från objekttyp', value: item.from_name },
            { label: 'Till objekttyp', value: item.to_name },
            { label: 'Minsta antal', value: String(item.min_relations) },
            { label: 'Maximalt antal', value: item.max_relations !== null ? String(item.max_relations) : '∞ (obegränsat)' },
            { label: 'Sorteringsordning', value: String(item.sort_order) },
            { label: 'Systemnamn', value: item.sys_caption ?? '—' },
          ].map(row => (
            <div key={row.label} className="px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
              <p className="text-sm text-slate-900 font-medium break-words">{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-samrum-border bg-slate-50 flex flex-wrap gap-2">
        {item.is_requirement && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Obligatorisk</span>
        )}
        {item.allow_in_lists && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Visas i listor</span>
        )}
        {item.show_in_lists_default && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Standard i listor</span>
        )}
      </div>
    </div>
  );
}

export default function RelationshipsPage() {
  const [data, setData] = useState<Relationship[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<Relationship[]>([]);
  const [, setSearch] = useState('');
  const [selected, setSelected] = useState<Relationship | null>(null);

  const load = useCallback((off = 0) => {
    setLoading(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`http://localhost:3000/api/admin/relationships?offset=${off}`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAllData(d.data ?? []);
          setData(d.data ?? []);
          setTotal(d.total ?? 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(0); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setData(allData); return; }
    setData(allData.filter(r =>
      r.caption_singular?.toLowerCase().includes(q.toLowerCase()) ||
      r.from_name?.toLowerCase().includes(q.toLowerCase()) ||
      r.to_name?.toLowerCase().includes(q.toLowerCase())
    ));
  };

  const columns: Column<Relationship>[] = [
    { key: 'caption_singular', header: 'Relationsnamn', sortable: true },
    { key: 'from_name', header: 'Från objekttyp', sortable: true },
    { key: 'to_name', header: 'Till objekttyp', sortable: true },
    {
      key: 'min_relations', header: 'Antal (min..max)',
      render: (_, row) => (
        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
          {row.min_relations}..{row.max_relations !== null ? row.max_relations : '∞'}
        </span>
      ),
    },
    {
      key: 'is_requirement', header: 'Obligatorisk',
      render: v => v
        ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'allow_in_lists', header: 'I listor',
      render: v => v
        ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Ja</span>
        : <span className="text-slate-400 text-xs">Nej</span>,
    },
  ];

  const toolbar: ToolbarAction[] = [
    {
      label: 'Skapa ny', variant: 'primary',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
      onClick: () => alert('Skapa ny relation'),
    },
    {
      label: 'Exportera CSV',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
      onClick: () => {
        const csv = [
          ['ID', 'Namn', 'Från', 'Till', 'Min', 'Max', 'Obligatorisk'].join(','),
          ...data.map(r => [r.id, r.caption_singular, r.from_name, r.to_name,
          r.min_relations, r.max_relations ?? '', r.is_requirement ? 'Ja' : 'Nej'].join(',')),
        ].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'relationer.csv';
        a.click();
      },
    },
    {
      label: `Ladda fler (${total - allData.length > 0 ? total - allData.length : 0} kvar)`,
      disabled: allData.length >= total,
      onClick: () => { load(allData.length); },
    },
  ];

  return (
    <SamrumLayout
      rightPanel={<RelationshipDetail item={selected} onClose={() => setSelected(null)} />}
      rightPanelTitle="Relationsdetaljer"
    >
      <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Admin</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-slate-900">Relationer</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Administrera relationer</h1>
        <p className="text-sm text-slate-500">
          Visar {data.length} av {total.toLocaleString()} relationer mellan objekttyper
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          columns={columns}
          data={data}
          loading={loading}
          selectable
          toolbarActions={toolbar}
          onSearch={handleSearch}
          searchPlaceholder="Sök relation, objekttyp..."
          onRowClick={row => setSelected(row)}
          totalCount={data.length}
          emptyMessage="Inga relationer hittades"
        />
      </div>
    </SamrumLayout>
  );
}
