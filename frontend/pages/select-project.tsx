import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getStoredToken } from '../lib/auth';

interface Project {
  id: number;
  name: string;
  database_name: string;
  description: string | null;
  is_active: boolean;
  module_count: number;
}

export default function SelectProjectPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch('http://localhost:3000/api/admin/projects', { headers })
      .then(r => r.json())
      .then(d => {
        const data = d.data ?? [];
        setProjects(data);
        setFiltered(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    setFiltered(q
      ? projects.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.description?.toLowerCase().includes(q.toLowerCase()))
      : projects
    );
  };

  const handleSelect = (project: Project) => {
    // Store selected project in sessionStorage
    sessionStorage.setItem('selectedProject', JSON.stringify(project));
    router.push(`/project/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-samrum-bg flex flex-col">
      {/* Header */}
      <header className="bg-samrum-header text-white h-14 flex items-center justify-between px-6 shadow-nav">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-samrum-accent" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" fill="none" />
          </svg>
          <span className="text-xl font-bold tracking-widest">SAMRUM</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/projects"
            className="text-slate-300 hover:text-white text-sm transition-colors hidden md:block">
            Administrera projekt
          </Link>
          <Link href="/login"
            className="bg-samrum-accent hover:bg-samrum-accent-hover text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
            Logga ut
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Välj projekt</h1>
          <p className="text-slate-500 mt-1">Välj ett projekt för att fortsätta</p>
        </div>

        {/* Search + Cancel row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Sök projekt..."
              className="w-full pl-9 pr-3 py-2.5 border border-samrum-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 bg-white"
            />
          </div>
          <Link href="/login"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Avbryt
          </Link>
        </div>

        {/* Project count */}
        {!loading && (
          <p className="text-xs text-slate-400 mb-3">
            {filtered.length} projekt{filtered.length !== 1 ? 'er' : ''}
            {search && ` för "${search}"`}
          </p>
        )}

        {/* Project table */}
        <div className="bg-white rounded-xl border border-samrum-border shadow-panel overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_120px] bg-slate-50 border-b border-samrum-border px-4 py-2.5">
            <div className="w-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projekt</div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Moduler</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_120px] px-4 py-3 animate-pulse">
                  <div className="w-12 h-4 bg-slate-100 rounded" />
                  <div className="h-4 bg-slate-100 rounded mx-4 w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-400 text-sm">
                Inga projekt hittades
              </div>
            ) : (
              filtered.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project)}
                  className="w-full grid grid-cols-[auto_1fr_120px] px-4 py-3.5 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="w-12">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 group-hover:bg-samrum-blue group-hover:text-white text-xs font-mono font-medium text-slate-600 transition-colors">
                      {project.id}
                    </span>
                  </div>
                  <div className="min-w-0 px-2">
                    <p className="font-medium text-slate-900 group-hover:text-samrum-blue transition-colors truncate">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{project.description}</p>
                    )}
                  </div>
                  <div className="text-right flex items-center justify-end gap-2">
                    <span className="text-xs text-slate-400">{project.module_count} moduler</span>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-samrum-blue transition-colors"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Klicka på ett projekt för att öppna det
        </p>
      </div>
    </div>
  );
}
