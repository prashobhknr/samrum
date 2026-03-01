import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';
import { getStoredToken } from '../../lib/auth';

const API_URL = 'http://localhost:3000';

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

interface User {
  id: number;
  username: string;
  email: string;
}

function buildModuleTree(folders: Folder[], modules: Module[]): TreeNode[] {
  const folderMap: Record<number, TreeNode> = {};
  const roots: TreeNode[] = [];

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

  folders.forEach(f => {
    if (f.parent_id && folderMap[f.parent_id]) {
      folderMap[f.parent_id].children!.push(folderMap[f.id]);
    } else {
      roots.push(folderMap[f.id]);
    }
  });

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

function ProjectUsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API_URL}/api/admin/users`, { headers })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {users.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">Inga användare</p>
        ) : (
          users.map(u => (
            <div key={u.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
              <div className="w-7 h-7 rounded-full bg-samrum-blue/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-samrum-blue">
                  {u.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{u.username}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const token = getStoredToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

      const [pRes, tRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/projects/${projectId}`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/admin/projects/${projectId}/module-tree`, { headers }).then(r => r.json()),
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
      router.push(`/modules/${node.id}`);
    }
  };

  const filteredModules = search
    ? allModules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const sidebar = (
    <div>
      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-samrum-border pb-2 mb-1">
        {project && (
          <p className="text-xs text-slate-400 mb-1.5">{project.module_count} moduler</p>
        )}
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-5 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : search ? (
        <div>
          <p className="text-xs text-slate-400 px-2 py-1">{filteredModules.length} resultat</p>
          {filteredModules.map(m => (
            <button
              key={m.id}
              onClick={() => router.push(`/modules/${m.id}`)}
              className="w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5 hover:bg-slate-100 text-slate-700"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <TreeNav
          nodes={treeNodes}
          onSelect={handleTreeSelect}
          defaultExpanded={false}
        />
      )}
    </div>
  );

  const rightPanel = <ProjectUsersPanel />;

  return (
    <SamrumLayout
      sidebar={sidebar}
      sidebarTitle="Moduler"
      sidebarWidth="260px"
      rightPanel={rightPanel}
      rightPanelTitle="Mina användare"
      rightPanelWidth="240px"
    >
      {/* Center: empty state / project info */}
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
        </div>

        {loading ? (
          <>
            <h3 className="text-lg font-semibold text-slate-600 mb-1">Laddar moduler...</h3>
            <p className="text-sm text-center max-w-xs">Hämtar modulträdet för projektet...</p>
          </>
        ) : (
          <>
            {project && (
              <h3 className="text-lg font-semibold text-slate-700 mb-1">{project.name}</h3>
            )}
            <p className="text-sm text-center max-w-xs mb-6">
              Välj en modul i trädet för att öppna modulvyn.
            </p>
            {project && (
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-xl border border-samrum-border px-5 py-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-samrum-blue">{project.module_count}</p>
                  <p className="text-xs text-slate-500 mt-1">Aktiva moduler</p>
                </div>
                <Link href="/select-project"
                  className="bg-white rounded-xl border border-samrum-border px-5 py-4 text-center hover:border-samrum-blue transition-colors group shadow-sm">
                  <p className="text-sm font-medium text-slate-700 group-hover:text-samrum-blue">Byt projekt</p>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </SamrumLayout>
  );
}
