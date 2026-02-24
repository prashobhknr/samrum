import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TreeNav, { TreeNode } from '../../components/TreeNav';

interface Project {
  id: number;
  name: string;
  database_name: string;
  description: string | null;
  module_count: number;
}

interface Module extends Record<string, unknown> {
  id: number;
  name: string;
  description: string | null;
  folder_id: number | null;
  folder_name: string | null;
  allow_incomplete_versions: boolean;
  is_enabled: boolean;
}

interface Folder extends Record<string, unknown> {
  id: number;
  name: string;
  parent_id: number | null;
  module_count: number;
}

function buildModuleTree(folders: Folder[], modules: Module[]): TreeNode[] {
  const folderMap: Record<number, TreeNode> = {};
  const roots: TreeNode[] = [];

  // Create folder nodes
  folders.forEach(f => {
    folderMap[f.id] = {
      id: `f_${f.id}`,
      label: f.name,
      type: 'folder',
      badge: parseInt(String(f.module_count)) || undefined,
      children: [],
      meta: f,
    };
  });

  // Nest folders
  folders.forEach(f => {
    if (f.parent_id && folderMap[f.parent_id]) {
      folderMap[f.parent_id].children!.push(folderMap[f.id]);
    } else {
      roots.push(folderMap[f.id]);
    }
  });

  // Add modules to their folders
  modules.forEach(m => {
    const node: TreeNode = {
      id: m.id,
      label: m.name,
      type: 'file',
      meta: m,
    };
    if (m.folder_id && folderMap[m.folder_id]) {
      folderMap[m.folder_id].children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`http://localhost:3000/api/admin/projects/${projectId}`).then(r => r.json()),
        fetch(`http://localhost:3000/api/admin/projects/${projectId}/module-tree`).then(r => r.json()),
      ]);
      if (pRes.success) setProject(pRes.data);
      if (tRes.success) {
        setAllModules(tRes.modules ?? []);
        setTreeNodes(buildModuleTree(tRes.folders ?? [], tRes.modules ?? []));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (id) load(String(id));
  }, [id, load]);

  const handleTreeSelect = (node: TreeNode) => {
    if (!String(node.id).startsWith('f_')) {
      setSelectedModule(node.meta as unknown as Module);
    }
  };

  const filteredModules = search
    ? allModules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="flex flex-col h-screen bg-samrum-bg overflow-hidden">
      {/* Header */}
      <header className="bg-samrum-header text-white h-14 flex items-center justify-between px-6 flex-shrink-0 shadow-nav z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/select-project" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0">
            <svg className="w-5 h-5 text-samrum-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            <span className="text-lg font-bold tracking-widest">SAMRUM</span>
          </Link>
          {project && (
            <>
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
              <span className="text-sm text-slate-200 truncate">{project.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/admin" className="text-slate-300 hover:text-white text-sm transition-colors hidden md:block">
            Admin
          </Link>
          <Link href="/select-project"
            className="text-slate-300 hover:text-white text-sm transition-colors hidden sm:block">
            ← Byt projekt
          </Link>
          <Link href="/login"
            className="bg-samrum-accent hover:bg-samrum-accent-hover text-white text-sm font-medium px-3 py-1.5 rounded transition-colors">
            Logga ut
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Module tree */}
        <aside className="w-72 bg-white border-r border-samrum-border flex flex-col overflow-hidden flex-shrink-0">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-samrum-border bg-slate-50">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Moduler</h2>
            {project && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{project.module_count} moduler</p>
            )}
          </div>

          {/* Search modules */}
          <div className="px-3 py-2 border-b border-samrum-border">
            <div className="relative">
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Sök modul..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-samrum-blue/30"
              />
            </div>
          </div>

          {/* Tree or search results */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-5 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : search ? (
              /* Search results as flat list */
              <div>
                <p className="text-xs text-slate-400 px-2 py-1">{filteredModules.length} resultat</p>
                {filteredModules.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModule(m)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5
                      ${selectedModule?.id === m.id ? 'bg-samrum-selected text-samrum-selected-text font-medium' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <TreeNav
                nodes={treeNodes}
                selectedId={selectedModule?.id}
                onSelect={handleTreeSelect}
                defaultExpanded={false}
              />
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedModule ? (
            /* Module detail view */
            <div className="flex-1 overflow-y-auto">
              {/* Module header */}
              <div className="px-6 py-5 bg-white border-b border-samrum-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span>{project?.name}</span>
                      <span>›</span>
                      <span>{selectedModule.folder_name ?? 'Rotnivå'}</span>
                      <span>›</span>
                      <span className="font-medium text-slate-700">Modul</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">{selectedModule.name}</h1>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      selectedModule.allow_incomplete_versions
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {selectedModule.allow_incomplete_versions ? 'Tillåter ofullständiga' : 'Kräver komplett data'}
                    </span>
                    <Link
                      href={`/modules/${selectedModule.id}`}
                      className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Öppna modul →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Module details */}
              <div className="p-6 max-w-3xl">
                {/* Description card */}
                {selectedModule.description && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Modulbeskrivning</p>
                    <p className="text-sm text-blue-900 leading-relaxed">{selectedModule.description}</p>
                  </div>
                )}

                {/* Details grid */}
                <div className="bg-white rounded-xl border border-samrum-border">
                  <div className="px-5 py-4 border-b border-samrum-border">
                    <h2 className="text-sm font-semibold text-slate-700">Moduldetaljer</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { label: 'Modulnamn', value: selectedModule.name },
                      { label: 'Mapp', value: selectedModule.folder_name ?? '—' },
                      { label: 'Projekt', value: project?.name ?? '—' },
                      { label: 'Tillåt ofullständiga versioner', value: selectedModule.allow_incomplete_versions ? 'Ja' : 'Nej' },
                      { label: 'Status', value: selectedModule.is_enabled ? 'Aktiv' : 'Inaktiv' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center px-5 py-3.5">
                        <span className="text-sm text-slate-500 w-56 flex-shrink-0">{row.label}</span>
                        <span className="text-sm font-medium text-slate-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Version history placeholder */}
                <div className="mt-4 bg-white rounded-xl border border-samrum-border">
                  <div className="px-5 py-4 border-b border-samrum-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700">Versioner</h2>
                    <button className="text-xs text-samrum-blue hover:underline font-medium">
                      Lås aktuell version →
                    </button>
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm text-slate-700 font-medium">Arbetsversion</span>
                      <span className="text-xs text-slate-400 ml-auto">Aktiv</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-1">
                {loading ? 'Laddar moduler...' : 'Välj en modul'}
              </h3>
              <p className="text-sm text-center max-w-xs">
                {loading
                  ? 'Hämtar modulträdet för projektet...'
                  : 'Expandera mapparna i sidofältet och klicka på en modul för att se dess detaljer.'
                }
              </p>
              {!loading && project && (
                <div className="mt-6 flex items-center gap-3">
                  <div className="bg-white rounded-xl border border-samrum-border px-5 py-4 text-center">
                    <p className="text-2xl font-bold text-samrum-blue">{project.module_count}</p>
                    <p className="text-xs text-slate-500 mt-1">Aktiva moduler</p>
                  </div>
                  <Link href="/select-project"
                    className="bg-white rounded-xl border border-samrum-border px-5 py-4 text-center hover:border-samrum-blue transition-colors group">
                    <p className="text-sm font-medium text-slate-700 group-hover:text-samrum-blue">Byt projekt</p>
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
