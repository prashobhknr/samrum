import React from 'react';

const API = 'http://localhost:3000';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  moduleName?: string;
  selectedIds?: (string | number)[];
}

export default function ExportModal({ isOpen, onClose, moduleId, moduleName, selectedIds }: ExportModalProps) {
  if (!isOpen) return null;

  const downloadAll = () => {
    window.open(`${API}/api/admin/modules/${moduleId}/export`, '_blank');
    onClose();
  };

  const downloadSelected = () => {
    if (!selectedIds?.length) return;
    window.open(`${API}/api/admin/modules/${moduleId}/export?ids=${selectedIds.join(',')}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-[420px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="font-semibold text-slate-800 text-sm">Exportera objekt</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            Välj exportformat för {moduleName ? <strong>{moduleName}</strong> : 'modulen'}:
          </p>

          <button
            onClick={downloadAll}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors"
          >
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="font-medium text-slate-800">Excel – alla kolumner (CSV)</div>
              <div className="text-xs text-slate-500 mt-0.5">Exportera alla objekt med alla attribut</div>
            </div>
          </button>

          <button
            onClick={downloadSelected}
            disabled={!selectedIds?.length}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div>
              <div className="font-medium text-slate-800">
                Excel – valda kolumner (CSV)
                {selectedIds?.length ? <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{selectedIds.length} valda</span> : null}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedIds?.length ? `Exportera ${selectedIds.length} markerade objekt` : 'Markera objekt i listan först'}
              </div>
            </div>
          </button>
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
