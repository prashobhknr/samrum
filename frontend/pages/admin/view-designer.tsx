import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import { getStoredToken } from '../../lib/auth';

const API = 'http://localhost:3000';

interface Module {
    id: number;
    name: string;
    folder_name: string | null;
    folder_id: number | null;
}

interface Folder {
    id: number;
    name: string;
    parent_id: number | null;
}

interface ColumnConfig {
    key: string;
    label: string;
    visible: boolean;
    order: number;
}

interface ViewSettings {
    module_id: number;
    columns: ColumnConfig[];
}

function buildTree(folders: Folder[], modules: Module[]): TreeNode[] {
    const folderMap: Record<number, TreeNode> = {};
    const roots: TreeNode[] = [];
    folders.forEach(f => {
        folderMap[f.id] = { id: `f_${f.id}`, label: f.name, type: 'folder', children: [] };
    });
    folders.forEach(f => {
        if (f.parent_id && folderMap[f.parent_id]) folderMap[f.parent_id].children!.push(folderMap[f.id]);
        else roots.push(folderMap[f.id]);
    });
    modules.forEach(m => {
        const node: TreeNode = { id: m.id, label: m.name, type: 'file' };
        if (m.folder_id && folderMap[m.folder_id]) folderMap[m.folder_id].children!.push(node);
        else roots.push(node);
    });
    return roots;
}

export default function ViewDesignerPage() {
    const router = useRouter();
    const { module: moduleId } = router.query;
    const selectedModuleId = moduleId ? Number(moduleId) : null;

    const [modules, setModules] = useState<Module[]>([]);
    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);

    // Load modules & folders for tree
    useEffect(() => {
        const token = getStoredToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        Promise.all([
            fetch(`${API}/api/admin/modules`, { headers }).then(r => r.json()),
            fetch(`${API}/api/admin/module-folders`, { headers }).then(r => r.json()),
        ]).then(([mRes, fRes]) => {
            const mods: Module[] = mRes.success ? mRes.data : [];
            const folds: Folder[] = fRes.success ? fRes.data : [];
            setModules(mods);
            setTreeNodes(buildTree(folds, mods));
        });
    }, []);

    // Load column settings for selected module
    const loadColumnsForModule = useCallback(async (modId: number) => {
        setLoading(true);
        try {
            const token = getStoredToken();
            const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
            // Load the module instances to get the column definitions
            const r = await fetch(`${API}/api/admin/modules/${modId}/instances`, { headers });
            const d = await r.json();

            // Load saved view settings
            const sv = await fetch(`${API}/api/admin/views/${modId}`, { headers });
            const savedView: ViewSettings | null = sv.ok ? await sv.json().then((d: any) => d.data) : null;

            if (d.success && d.columns) {
                const savedMap: Record<string, { order: number; visible: boolean }> = {};
                if (savedView?.columns) {
                    savedView.columns.forEach(c => {
                        savedMap[c.key] = { order: c.order, visible: c.visible };
                    });
                }

                const allCols: ColumnConfig[] = d.columns.map((col: any, i: number) => ({
                    key: col.key,
                    label: col.label || col.key,
                    visible: savedMap[col.key]?.visible ?? true,
                    order: savedMap[col.key]?.order ?? i,
                }));

                allCols.sort((a, b) => a.order - b.order);
                setColumns(allCols);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedModuleId) {
            const mod = modules.find(m => m.id === selectedModuleId);
            setSelectedModule(mod || null);
            loadColumnsForModule(selectedModuleId);
        }
    }, [selectedModuleId, modules, loadColumnsForModule]);

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const newCols = [...columns];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCols.length) return;
        [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
        setColumns(newCols.map((c, i) => ({ ...c, order: i })));
    };

    const toggleVisible = (key: string) => {
        setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
    };

    const handleSave = async () => {
        if (!selectedModuleId) return;
        setSaving(true);
        try {
            const token = getStoredToken();
            await fetch(`${API}/api/admin/views/${selectedModuleId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ columns }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!selectedModuleId) return;
        const token = getStoredToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        await fetch(`${API}/api/admin/views/${selectedModuleId}`, { method: 'DELETE', headers });
        loadColumnsForModule(selectedModuleId);
    };

    const sidebar = (
        <div className="h-full flex flex-col">
            <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200">
                Välj en modul för att konfigurera vyinställningar
            </div>
            <div className="flex-1 overflow-y-auto py-1">
                <TreeNav
                    nodes={treeNodes}
                    selectedId={selectedModuleId ?? undefined}
                    onSelect={(node) => {
                        if (!String(node.id).startsWith('f_')) {
                            router.push(`/admin/view-designer?module=${node.id}`);
                        }
                    }}
                    defaultExpanded
                />
            </div>
        </div>
    );

    return (
        <SamrumLayout sidebar={sidebar} sidebarTitle="Moduler">
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <Link href="/admin" className="hover:text-samrum-blue">Admin</Link>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-slate-900">Vydesigner</span>
                        {selectedModule && (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="font-medium text-slate-900">{selectedModule.name}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Vydesigner</h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {selectedModule ? `Konfigurera kolumner för "${selectedModule.name}"` : 'Välj en modul i trädet till vänster'}
                            </p>
                        </div>
                        {columns.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleReset}
                                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg"
                                >
                                    Återställ standard
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-samrum-blue text-white hover:bg-samrum-blue-dark rounded-lg disabled:opacity-50"
                                >
                                    {saving ? (
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                                        </svg>
                                    ) : saved ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : null}
                                    {saved ? 'Sparat!' : 'Spara inställningar'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedModuleId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                            <p className="text-sm">Välj en modul i det vänstra trädet för att konfigurera kolumner</p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center h-48 text-slate-400">
                            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                            </svg>
                            Laddar kolumner...
                        </div>
                    ) : (
                        <div className="max-w-2xl">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-slate-700">Kolumnkonfiguration</h2>
                                    <span className="text-xs text-slate-500">
                                        {columns.filter(c => c.visible).length} av {columns.length} synliga
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {columns.map((col, i) => (
                                        <div
                                            key={col.key}
                                            className={`flex items-center gap-3 px-4 py-2.5 group hover:bg-slate-50 ${!col.visible ? 'opacity-50' : ''}`}
                                        >
                                            {/* Visibility toggle */}
                                            <button
                                                onClick={() => toggleVisible(col.key)}
                                                title={col.visible ? 'Dölj kolumn' : 'Visa kolumn'}
                                                className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${col.visible ? 'bg-samrum-blue' : 'bg-slate-200'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${col.visible ? 'translate-x-3' : 'translate-x-0.5'}`} />
                                            </button>

                                            {/* Column label */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800">{col.label}</p>
                                                <p className="text-xs text-slate-400 font-mono">{col.key}</p>
                                            </div>

                                            {/* Order badge */}
                                            <span className="text-xs text-slate-400 w-6 text-center">{i + 1}</span>

                                            {/* Move buttons */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => moveColumn(i, 'up')}
                                                    disabled={i === 0}
                                                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                                                    title="Flytta upp"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => moveColumn(i, 'down')}
                                                    disabled={i === columns.length - 1}
                                                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                                                    title="Flytta ned"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Inställningarna gäller för alla användare som öppnar denna modul. Klicka på "Återställ standard" för att återgå till standardvyn.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SamrumLayout>
    );
}
