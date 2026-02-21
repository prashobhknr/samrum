import React, { useEffect, useState, useCallback } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';

interface Folder extends Record<string, unknown> {
  id: number;
  name: string;
  parent_id: number | null;
  description: string | null;
}

interface Module extends Record<string, unknown> {
  id: number;
  name: string;
  folder_id: number | null;
  allow_incomplete_versions: boolean;
}

function buildFolderTree(folders: Folder[], modules: Module[]): TreeNode[] {
  const map: Record<number, TreeNode> = {};
  const roots: TreeNode[] = [];

  folders.forEach(f => {
    map[f.id] = { id: f.id, label: f.name, type: 'folder', children: [], meta: f };
  });

  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children!.push(map[f.id]);
    else roots.push(map[f.id]);
  });

  modules.forEach(m => {
    const node: TreeNode = { id: `m_${m.id}`, label: m.name, type: 'file', meta: m };
    if (m.folder_id && map[m.folder_id]) map[m.folder_id].children!.push(node);
    else roots.push(node);
  });

  return roots;
}

export default function ModuleFoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<{ type: 'folder' | 'module'; data: Folder | Module } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:3000/api/admin/module-folders').then(r => r.json()),
      fetch('http://localhost:3000/api/admin/modules').then(r => r.json()),
    ]).then(([fRes, mRes]) => {
      const folds: Folder[] = fRes.success ? fRes.data : [];
      const mods: Module[] = mRes.success ? mRes.data : [];
      setFolders(folds);
      setModules(mods);
      setTreeNodes(buildFolderTree(folds, mods));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = (node: TreeNode) => {
    if (String(node.id).startsWith('m_')) {
      setSelected({ type: 'module', data: node.meta as unknown as Module });
    } else {
      setSelected({ type: 'folder', data: node.meta as unknown as Folder });
    }
  };

  const folderModuleCount = (folderId: number) =>
    modules.filter(m => m.folder_id === folderId).length;

  return (
    <SamrumLayout>
      <div className="px-6 py-4 bg-white border-b border-samrum-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <span>Admin</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
          <span className="font-medium text-slate-900">Modulmappar</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">B011 – Modulmappar</h1>
        <p className="text-sm text-slate-500">{folders.length} mappar, {modules.length} moduler</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tree panel */}
        <div className="w-80 bg-white border-r border-samrum-border flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-samrum-border">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mapphierarki</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="animate-pulse space-y-2 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-6 bg-slate-100 rounded" />
                ))}
              </div>
            ) : (
              <TreeNav nodes={treeNodes} onSelect={handleSelect} defaultExpanded={true} />
            )}
          </div>
          <div className="px-4 py-3 border-t border-samrum-border bg-slate-50">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-samrum-accent text-white rounded-lg hover:bg-samrum-accent-hover transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Ny mapp
            </button>
          </div>
        </div>

        {/* Detail / stats area */}
        <div className="flex-1 overflow-y-auto bg-samrum-bg p-6">
          {selected ? (
            <div className="bg-white rounded-xl border border-samrum-border shadow-panel p-6">
              {selected.type === 'folder' ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-samrum-tree" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{(selected.data as Folder).name}</h2>
                      <p className="text-sm text-slate-500">Mapp</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-samrum-blue">
                        {folderModuleCount((selected.data as Folder).id)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">Moduler</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {folders.filter(f => f.parent_id === (selected.data as Folder).id).length}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">Undermappar</p>
                    </div>
                  </div>
                  {(selected.data as Folder).description && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-slate-500 mb-1">Beskrivning</p>
                      <p className="text-sm text-slate-700">{(selected.data as Folder).description}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button className="px-4 py-2 text-sm font-medium bg-samrum-blue text-white rounded-lg hover:bg-samrum-blue-dark">Ändra</button>
                    <button className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Radera</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-samrum-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{(selected.data as Module).name}</h2>
                      <p className="text-sm text-slate-500">Modul</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Tillåt ofullständiga versioner</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(selected.data as Module).allow_incomplete_versions ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {(selected.data as Module).allow_incomplete_versions ? 'Ja' : 'Nej'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="px-4 py-2 text-sm font-medium bg-samrum-blue text-white rounded-lg hover:bg-samrum-blue-dark">Ändra</button>
                    <button className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200">Radera</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg className="w-16 h-16 mb-4 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              <p className="text-sm">Välj en mapp eller modul i trädet</p>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
