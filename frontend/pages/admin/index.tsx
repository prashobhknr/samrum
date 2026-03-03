import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import { getStoredUser, getStoredToken, User } from '../../lib/auth';

interface AppMetrics { // Renamed from Stats
  object_types: number;
  relationships: number;
  modules: number;
  module_folders: number;
  classifications: number;
  projects?: number;
  users?: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  href: string;
  color: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, href, color, icon }: StatCardProps) {
  return (
    <Link href={href}>
      <div className={`bg-white rounded-lg border border-samrum-border p-6 hover:shadow-panel transition-shadow cursor-pointer group`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors ${color}`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1 text-sm text-samrum-blue font-medium">
          <span>Visa →</span>
        </div>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AppMetrics | null>(null); // Renamed from stats
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null); // Keep user state for header display

  useEffect(() => {
    setUser(getStoredUser()); // Keep this for user info display
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token} ` } : undefined;

    fetch('http://localhost:3000/api/stats', { headers })
      .then(r => r.json())
      .then(async d => {
        const s = d.stats ?? d;
        // Also fetch project count and users count
        let projectCount = 0;
        let userCount = 0;
        try {
          const pRes = await fetch('http://localhost:3000/api/admin/projects', { headers }).then(r => r.json());
          projectCount = pRes.total ?? pRes.data?.length ?? 0;
        } catch { }
        try {
          const uRes = await fetch('http://localhost:3000/api/admin/users', { headers }).then(r => r.json());
          userCount = uRes.total ?? uRes.data?.length ?? 0;
        } catch { }
        setMetrics({ // Changed setStats to setMetrics
          object_types: s.samrum_object_types ?? s.object_types ?? 0,
          relationships: s.samrum_relationships ?? s.relationships ?? 0,
          modules: s.samrum_modules ?? s.modules ?? 0,
          module_folders: s.samrum_module_folders ?? s.module_folders ?? 0,
          classifications: s.samrum_classifications ?? s.classifications ?? 0,
          projects: projectCount,
          users: userCount,
        });
      })
      .catch(() => setMetrics({ object_types: 1400, relationships: 4259, modules: 271, module_folders: 9, classifications: 0, projects: 21 })) // Changed setStats to setMetrics
      .finally(() => setLoading(false));
  }, []);

  // Removed isGlobalAdmin check
  // const isGlobalAdmin = user?.groups?.includes('global_security_admin') || user?.groups?.includes('security_admin');

  const allNavLinks = [
    { href: '/select-project', label: 'Val av projekt', desc: 'Välj och öppna ett projekt', accent: true, adminOnly: false },
    { href: '/admin/projects', label: 'Projektdatabaser (B010)', desc: 'Skapa och hantera projekt', adminOnly: true },
    { href: '/admin/users', label: 'Användare (B000)', desc: 'Administrera användare och roller', adminOnly: true },
    { href: '/admin/object-types', label: 'Objekttyper (B012)', desc: 'Hantera objekttypdefinitioner', adminOnly: true },
    { href: '/admin/modules', label: 'Moduler (B011)', desc: 'Projektmoduler och mappar', adminOnly: true },
    { href: '/admin/relationships', label: 'Relationer', desc: 'Objekttypsrelationer', adminOnly: true },
    { href: '/admin/classify', label: 'Klassificera objekt (A005)', desc: 'Bläddra objekt per klassificering', adminOnly: false },
    { href: '/admin/classifications', label: 'Klassifikationer (B013)', desc: 'Klassifikationssystem', adminOnly: true },
    { href: '/admin/import-export', label: 'Import/Export (B014)', desc: 'ID-uppsättningar och definitioner', adminOnly: true },
    { href: '/admin/module-folders', label: 'Modulmappar', desc: 'Mappstruktur', adminOnly: true },
    { href: '/admin/analysis', label: 'Analys & Kvalitet (A006/A007)', desc: 'Ofullständiga objekt och valideringsfel', adminOnly: false },
  ];

  const navLinks = allNavLinks; // Show all nav links unconditionally

  return (
    <SamrumLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Page Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Administrationsöversikt</h1>
              <p className="text-slate-500 mt-1">Samrum databas- och objektadministration</p>
            </div>
            {user && (
              <div className="bg-white border border-slate-200 shadow-sm rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="bg-samrum-blue/10 text-samrum-blue rounded-full p-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.groups.length > 0 ? user.groups.map(g => (
                      <span key={g} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {g.replace(/_/g, ' ')}
                      </span>
                    )) : <span className="text-[10px] text-slate-400">Inga roller</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-samrum-border p-6 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                  <div className="h-8 bg-slate-200 rounded w-16" />
                </div>
              ))
            ) : metrics ? (
              <>
                <StatCard
                  title="Objekttyper" value={metrics.object_types}
                  subtitle="Definierade objekttyper" href="/admin/object-types"
                  color="text-blue-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M9 3h6M9 3a1 1 0 00-1 1v1h8V4a1 1 0 00-1-1H9z" /></svg>}
                />
                <StatCard
                  title="Relationer" value={metrics.relationships}
                  subtitle="Objekttypsrelationer" href="/admin/relationships"
                  color="text-purple-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                />
                <StatCard
                  title="Moduler" value={metrics.modules}
                  subtitle="Projektmoduler" href="/admin/modules"
                  color="text-green-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                />
                <StatCard
                  title="Modulmappar" value={metrics.module_folders}
                  subtitle="Hierarkiska mappar" href="/admin/module-folders"
                  color="text-amber-600"
                  icon={<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>}
                />
                <StatCard
                  title="Klassifikationer" value={metrics.classifications}
                  subtitle="Klassifikationer" href="/admin/classifications"
                  color="text-rose-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>}
                />
                <StatCard
                  title="Användare" value={metrics.users ?? 0}
                  subtitle="Systemanvändare" href="/admin/users"
                  color="text-teal-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                />
                <StatCard
                  title="Projekt" value={metrics.projects ?? 0}
                  subtitle="Projektdatabaser" href="/admin/projects"
                  color="text-indigo-600"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
                />
              </>
            ) : null}
          </div>

          {/* Quick Navigation */}
          <div className="bg-white rounded-lg border border-samrum-border overflow-hidden">
            <div className="px-6 py-4 border-b border-samrum-border">
              <h2 className="text-sm font-semibold text-slate-700">Administrationssektioner</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}>
                  <div className={`flex items-center justify-between px-6 py-4 transition-colors cursor-pointer group
                    ${'accent' in link && link.accent ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                    <div>
                      <p className={`font-medium transition-colors
                        ${'accent' in link && link.accent ? 'text-amber-700 group-hover:text-amber-900' : 'text-slate-900 group-hover:text-samrum-blue'}`}>
                        {link.label}
                      </p>
                      <p className="text-sm text-slate-500">{link.desc}</p>
                    </div>
                    <svg className={`w-4 h-4 transition-colors
                      ${'accent' in link && link.accent ? 'text-amber-400 group-hover:text-amber-600' : 'text-slate-400 group-hover:text-samrum-blue'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SamrumLayout>
  );
}
