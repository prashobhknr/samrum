import React from 'react';

const API = 'http://localhost:3000';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: (string | number)[];
  moduleName?: string;
}

interface ReportOption {
  id: string;
  label: string;
  description: string;
  mode: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  { id: 'total', label: 'Totalrapport, dörrar', description: 'Komplett rapport för alla valda objekt med alla attribut', mode: 'total' },
  { id: 'similar', label: 'Lika dörrar', description: 'Rapport som grupperar identiska dörrtyper', mode: 'similar' },
  { id: 'identified', label: 'Totalrapport, dörrar (identifierad)', description: 'Rapport för objekt med fullständig identifikation', mode: 'identified' },
  { id: 'summary', label: 'Totalrapport, dörrar (sammanfattning)', description: 'Sammanfattande rapport med totalsummor per attribut', mode: 'summary' },
];

export default function PrintModal({ isOpen, onClose, selectedIds, moduleName }: PrintModalProps) {
  if (!isOpen) return null;

  const handlePrint = (mode: string) => {
    if (!selectedIds.length) return;
    const ids = selectedIds.join(',');
    window.open(`${API}/api/admin/reports/spec-sheet?ids=${ids}&mode=${mode}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[460px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="font-semibold text-slate-800 text-sm">Skriv ut objekt</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2">
          {selectedIds.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700 mb-3">
              Markera minst ett objekt i listan för att skriva ut.
            </div>
          )}
          {!selectedIds.length && (
            <p className="text-xs text-slate-500 mb-3">Välj rapporttyp för {moduleName ?? 'modulen'}:</p>
          )}
          {selectedIds.length > 0 && (
            <p className="text-xs text-slate-500 mb-3">
              Välj rapporttyp för <strong>{selectedIds.length} markerade objekt</strong> i {moduleName ?? 'modulen'}:
            </p>
          )}

          {REPORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handlePrint(opt.mode)}
              disabled={selectedIds.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <div>
                <div className="font-medium text-slate-800">{opt.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}
