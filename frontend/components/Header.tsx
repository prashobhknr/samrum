import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface HeaderProps {
  title?: string;
  showLogout?: boolean;
}

export default function Header({ title = 'SAMRUM', showLogout = true }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    router.push('/login');
  };

  // The isGlobalAdmin check is removed as per instruction.

  return (
    <header className="bg-samrum-header text-white shadow-nav flex items-center justify-between px-6 h-14 flex-shrink-0 z-50">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="flex items-center gap-1.5">
            <svg className="w-6 h-6 text-samrum-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" fill="none" />
            </svg>
            <span className="text-xl font-bold tracking-widest text-white">{title}</span>
          </div>
        </Link>
        <span className="text-samrum-muted text-xs border-l border-slate-600 pl-3 hidden sm:block">
          Admin Portal
        </span>
      </div>

      <nav className="flex items-center gap-4">
        <Link href="/select-project" className="text-samrum-accent hover:text-amber-300 text-sm font-medium transition-colors hidden md:block">
          Val av projekt
        </Link>
        <Link href="/admin/projects" className="text-slate-300 hover:text-white text-sm transition-colors hidden md:block">
          Projekt
        </Link>
        <Link href="/admin" className="text-slate-300 hover:text-white text-sm transition-colors hidden md:block">
          Översikt
        </Link>
        <Link href="/admin/object-types" className="text-slate-300 hover:text-white text-sm transition-colors hidden lg:block">
          Objekttyper
        </Link>
        <Link href="/admin/modules" className="text-slate-300 hover:text-white text-sm transition-colors hidden lg:block">
          Moduler
        </Link>
        <Link href="/admin/analysis" className="text-slate-300 hover:text-white text-sm transition-colors hidden lg:block">
          Analys
        </Link>

        {showLogout && (
          <button
            onClick={handleLogout}
            className="bg-samrum-accent hover:bg-samrum-accent-hover text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
          >
            Logga ut
          </button>
        )}
      </nav>
    </header>
  );
}
