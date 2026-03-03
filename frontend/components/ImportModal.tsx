import React, { useState, useRef, useCallback } from 'react';
import { getStoredToken } from '../lib/auth';

const API = 'http://localhost:3000';

interface ColumnDef {
  key: string;
  label: string;
  oms_attribute_id?: number | null;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  columns: ColumnDef[];
  onImported?: () => void;
}

interface ParsedRow {
  external_id: string;
  name: string;
  attribute_values_by_id: Record<number, string>;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: string; error: string }[];
}

// Simple CSV row parser — handles quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default function ImportModal({ isOpen, onClose, moduleId, columns, onImported }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState('csv');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = useCallback(() => {
    setFileName(null);
    setParsedRows([]);
    setParseError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsedRows([]);
    setParseError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) { setParseError('Kunde inte läsa filen.'); return; }

      try {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setParseError('Filen innehåller för lite data (minst en rad med data krävs).'); return; }

        // First line = display labels (skip), second line = column keys
        const keyLine = lines.length >= 2 ? lines[1] : lines[0];
        const keys = parseCsvLine(keyLine);

        // Build mapping: column index → oms_attribute_id (or 'external_id'/'name')
        const colMap = columns.reduce<Record<string, number | null>>((m, c) => {
          m[c.key] = c.oms_attribute_id ?? null;
          return m;
        }, {});

        const dataLines = lines.slice(2);
        if (dataLines.length === 0) { setParseError('Filen har inga datarader.'); return; }

        const rows: ParsedRow[] = [];
        for (const line of dataLines) {
          if (!line.trim()) continue;
          const vals = parseCsvLine(line);
          const row: ParsedRow = { external_id: '', name: '', attribute_values_by_id: {} };
          keys.forEach((key, i) => {
            const val = vals[i] ?? '';
            if (key === 'external_id') { row.external_id = val; }
            else if (key === 'name') { row.name = val; }
            else {
              const attrId = colMap[key];
              if (attrId && val) row.attribute_values_by_id[attrId] = val;
            }
          });
          if (row.external_id) rows.push(row);
        }

        if (rows.length === 0) { setParseError('Inga giltiga rader hittades (external_id saknas).'); return; }
        setParsedRows(rows);
      } catch (err) {
        setParseError('Kunde inte tolka CSV-filen: ' + String(err));
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    setResult(null);
    try {
      const token = getStoredToken();
      const resp = await fetch(`${API}/api/admin/modules/${moduleId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await resp.json();
      if (data.success) {
        setResult({ imported: data.imported, skipped: data.skipped, errors: data.errors ?? [] });
        onImported?.();
      } else {
        setParseError(data.error || 'Import misslyckades');
      }
    } catch (err) {
      setParseError('Nätverksfel: ' + String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API}/api/admin/modules/${moduleId}/import/template`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[540px] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="font-semibold text-slate-800 text-sm">Importera objekt</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {result ? (
            /* Results view */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-green-800 font-medium">Import slutförd</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-3 bg-green-50 rounded border border-green-100">
                  <div className="text-2xl font-bold text-green-700">{result.imported}</div>
                  <div className="text-xs text-green-600 mt-1">Importerade</div>
                </div>
                <div className="p-3 bg-amber-50 rounded border border-amber-100">
                  <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
                  <div className="text-xs text-amber-600 mt-1">Hoppade över</div>
                </div>
                <div className="p-3 bg-red-50 rounded border border-red-100">
                  <div className="text-2xl font-bold text-red-700">{result.errors.length}</div>
                  <div className="text-xs text-red-600 mt-1">Fel</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="border border-red-200 rounded bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-2">Felrader:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">
                        <span className="font-mono">{e.row}</span>: {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload form */
            <>
              {/* Format selector */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Format</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-samrum-blue/40"
                >
                  <option value="csv">CSV (kommaseparerad)</option>
                  <option value="tsv" disabled>TSV (tabbseparerad) — ej tillgänglig</option>
                  <option value="excel" disabled>Excel (.xlsx) — ej tillgänglig</option>
                </select>
              </div>

              {/* File picker */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fil</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Bläddra
                  </button>
                  <span className={`text-sm truncate flex-1 ${fileName ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                    {fileName ?? 'Ingen fil vald'}
                  </span>
                </div>
              </div>

              {/* Template download */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs text-samrum-blue hover:underline flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Ladda ner CSV-mall
                </button>
                <span className="text-xs text-slate-400">— mall med kolumnnamn för denna modul</span>
              </div>

              {/* Parse error */}
              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {parseError}
                </div>
              )}

              {/* Row preview */}
              {parsedRows.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800 font-medium">
                    {parsedRows.length} {parsedRows.length === 1 ? 'rad' : 'rader'} redo att importeras
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Förhandsvisning (max 3):
                  </p>
                  <div className="mt-2 space-y-1">
                    {parsedRows.slice(0, 3).map((r, i) => (
                      <p key={i} className="text-xs font-mono text-blue-700">
                        {r.external_id}{r.name ? ` — ${r.name}` : ''}
                      </p>
                    ))}
                    {parsedRows.length > 3 && (
                      <p className="text-xs text-blue-500 italic">…och {parsedRows.length - 3} till</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          {result ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm bg-samrum-blue text-white rounded hover:bg-samrum-blue/90 font-medium"
            >
              Stäng
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700"
              >
                Avbryt
              </button>
              <button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || importing}
                className="px-4 py-2 text-sm bg-samrum-blue text-white rounded hover:bg-samrum-blue/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importerar…
                  </>
                ) : 'Importera'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
