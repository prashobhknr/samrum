import React, { useState } from 'react';

export interface Column<T = Record<string, unknown>> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
}

export interface ToolbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface DataGridProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  toolbarActions?: ToolbarAction[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (q: string) => void;
  searchPlaceholder?: string;
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg className={`w-3 h-3 inline-block ml-1 ${active ? 'text-samrum-blue' : 'text-slate-300'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  );
}

export default function DataGrid<T extends Record<string, unknown>>({
  columns, data, keyField = 'id', toolbarActions = [],
  onRowClick, selectable = false, loading = false,
  emptyMessage = 'Inga poster att visa', totalCount, page = 1,
  pageSize = 25, onPageChange, onSearch, searchPlaceholder = 'Sök...',
}: DataGridProps<T>) {
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey]; const vb = b[sortKey];
    const cmp = String(va ?? '').localeCompare(String(vb ?? ''));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map(r => r[keyField])));
  };

  const toggleRow = (id: unknown) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {(toolbarActions.length > 0 || onSearch) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-samrum-border gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {toolbarActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors disabled:opacity-50
                  ${action.variant === 'danger'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : action.variant === 'primary'
                    ? 'bg-samrum-blue text-white hover:bg-samrum-blue-dark'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
              >
                {action.icon && <span>{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
          {onSearch && (
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }}
                placeholder={searchPlaceholder}
                className="pl-9 pr-3 py-1.5 text-sm border border-samrum-border rounded-md focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 w-56"
              />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-samrum-border sticky top-0">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === data.length && data.length > 0}
                    onChange={toggleAll} className="rounded" />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide
                    ${col.sortable ? 'cursor-pointer select-none hover:text-slate-900' : ''}
                    ${col.width ? `w-[${col.width}]` : ''} ${col.className ?? ''}`}
                >
                  {col.header}
                  {col.sortable && (
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Laddar...
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, i) => {
                const id = row[keyField];
                const isSelected = selected.has(id);
                return (
                  <tr
                    key={String(id ?? i)}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-slate-100 transition-colors
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${isSelected ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      hover:bg-blue-50/60`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleRow(id)} className="rounded" />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-2.5 text-slate-700 ${col.className ?? ''}`}>
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {onPageChange && totalCount !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-t border-samrum-border text-sm text-slate-600">
          <span>{totalCount} poster</span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
              className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">←</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => onPageChange(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium
                  ${p === page ? 'bg-samrum-blue text-white' : 'hover:bg-slate-100'}`}>{p}</button>
            ))}
            {totalPages > 7 && <span className="px-1">…</span>}
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
              className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
