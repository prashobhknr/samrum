import React, { useState } from 'react';
import { Column } from './DataGrid';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: (string | number)[];
    columns: Column[];
    onSave: (attributeValues: Record<string, string>) => Promise<void>;
}

export default function BulkEditModal({
    isOpen,
    onClose,
    selectedIds,
    columns,
    onSave
}: BulkEditModalProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter columns that are editable (not metadata columns starting with _)
    const editableColumns = columns.filter(c => !c.key.startsWith('_'));

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await onSave(values);
            onClose();
            setValues({});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ett fel uppstod vid sparande');
        } finally {
            setIsSaving(false);
        }
    };

    const handleValueChange = (key: string, val: string) => {
        setValues(prev => ({ ...prev, [key]: val }));
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Massredigering</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedIds.length} poster valda</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                        <div className="flex gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Endast fält du ändrar värde på kommer att uppdateras för samtliga markerade poster.</span>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {editableColumns.map(col => (
                            <div key={col.key}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {col.header}
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30"
                                    value={values[col.key] ?? ''}
                                    onChange={e => handleValueChange(col.key, e.target.value)}
                                    placeholder="(Ingen ändring)"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || Object.keys(values).length === 0}
                        className="px-4 py-2 text-sm font-medium bg-samrum-blue text-white hover:bg-samrum-blue-dark rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && (
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                            </svg>
                        )}
                        Spara för {selectedIds.length} poster
                    </button>
                </div>
            </div>
        </div>
    );
}
