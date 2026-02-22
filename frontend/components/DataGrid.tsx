import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface Column<T = Record<string, unknown>> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  className?: string;
  /** If true, column is hidden by default */
  defaultHidden?: boolean;
}

export interface ToolbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface ColumnFilter {
  key: string;
  value: string;
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
  /** Show column selector button */
  columnSelector?: boolean;
  /** Show per-column filter row */
  columnFilters?: boolean;
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

/** Dropdown for column visibility toggle */
function ColumnSelector({
  columns,
  visible,
  onChange,
}: {
  columns: Column[];
  visible: Set<string>;
  onChange: (key: string, show: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
        </svg>
        Kolumner
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-52 py-1 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 mb-1">
            Visa kolumner
          </div>
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                onChange={e => onChange(col.key, e.target.checked)}
                className="rounded text-samrum-blue"
              />
              {col.header}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-column filter input — shows distinct values as datalist options */
function FilterInput({
  colKey,
  value,
  options,
  onChange,
}: {
  colKey: string;
  value: string;
  options: string[];
  onChange: (key: string, val: string) => void;
}) {
  const listId = `filter-list-${colKey}`;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(colKey, e.target.value)}
        list={listId}
        placeholder="Filter..."
        className={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-samrum-blue/40
          ${value ? 'border-samrum-blue bg-blue-50' : 'border-slate-200 bg-white'}`}
      />
      <datalist id={listId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
      {value && (
        <button
          onClick={() => onChange(colKey, '')}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export default function DataGrid<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id',
  toolbarActions = [],
  onRowClick,
  selectable = false,
  loading = false,
  emptyMessage = 'Inga poster att visa',
  totalCount,
  page = 1,
  pageSize = 25,
  onPageChange,
  onSearch,
  searchPlaceholder = 'Sök...',
  columnSelector = false,
  columnFilters = false,
}: DataGridProps<T>) {
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  // Column visibility: start with all visible except defaultHidden
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(columns.filter(c => !c.defaultHidden).map(c => c.key))
  );

  // Per-column filter values
  const [colFilterValues, setColFilterValues] = useState<Record<string, string>>({});

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;

  const activeColumns = columns.filter(c => visibleCols.has(c.key));

  // Get distinct raw string values for a column (for datalist suggestions)
  const getColOptions = useCallback((key: string): string[] => {
    const seen = new Set<string>();
    data.forEach(row => {
      const v = row[key];
      if (v !== null && v !== undefined && v !== '') {
        const s = String(v);
        if (s) seen.add(s);
      }
    });
    return Array.from(seen).sort();
  }, [data]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleColFilter = (key: string, val: string) => {
    setColFilterValues(prev => ({ ...prev, [key]: val }));
  };

  const handleColVisibility = (key: string, show: boolean) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      show ? next.add(key) : next.delete(key);
      return next;
    });
  };

  // Apply column filters + sort
  const processedData = [...data]
    .filter(row => {
      for (const [key, filterVal] of Object.entries(colFilterValues)) {
        if (!filterVal) continue;
        const cell = String(row[key] ?? '').toLowerCase();
        if (!cell.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey]; const vb = b[sortKey];
      const cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const activeFiltersCount = Object.values(colFilterValues).filter(Boolean).length;

  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map(r => r[keyField])));
  };

  const toggleRow = (id: unknown) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const clearAllFilters = () => setColFilterValues({});

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {(toolbarActions.length > 0 || onSearch || columnSelector) && (
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
          <div className="flex items-center gap-2">
            {/* Active filters badge */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} aktiva
              </button>
            )}
            {columnSelector && (
              <ColumnSelector
                columns={columns as Column[]}
                visible={visibleCols}
                onChange={handleColVisibility}
              />
            )}
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
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-max">
          <thead className="bg-slate-50 border-b border-samrum-border sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3 bg-slate-50">
                  <input type="checkbox" checked={selected.size === data.length && data.length > 0}
                    onChange={toggleAll} className="rounded" />
                </th>
              )}
              {activeColumns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50
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
            {/* Filter row */}
            {columnFilters && (
              <tr className="bg-white border-b border-slate-200">
                {selectable && <th className="px-4 py-1.5 bg-white" />}
                {activeColumns.map(col => (
                  <th key={col.key} className="px-3 py-1.5 bg-white font-normal">
                    {col.filterable !== false ? (
                      <FilterInput
                        colKey={col.key}
                        value={colFilterValues[col.key] ?? ''}
                        options={getColOptions(col.key)}
                        onChange={handleColFilter}
                      />
                    ) : <div />}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={activeColumns.length + (selectable ? 1 : 0)} className="text-center py-12 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Laddar...
                  </div>
                </td>
              </tr>
            ) : processedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + (selectable ? 1 : 0)} className="text-center py-12 text-slate-400">
                  {activeFiltersCount > 0
                    ? <span>Inga resultat för aktiva filter. <button onClick={clearAllFilters} className="text-samrum-blue underline">Rensa filter</button></span>
                    : emptyMessage}
                </td>
              </tr>
            ) : (
              processedData.map((row, i) => {
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
                    {activeColumns.map(col => (
                      <td key={col.key} className={`px-3 py-2.5 text-slate-700 ${col.className ?? ''}`}>
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

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white border-t border-samrum-border text-xs text-slate-500">
        <span>
          {processedData.length !== data.length
            ? `${processedData.length} av ${data.length} poster (${data.length - processedData.length} filtrerade)`
            : `${totalCount ?? data.length} poster`}
        </span>
        {/* Pagination */}
        {onPageChange && totalCount !== undefined && totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}
