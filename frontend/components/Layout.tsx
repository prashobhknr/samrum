/**
 * Phase 4: Layout Component
 * 
 * Main layout wrapper with navigation
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { logoutUser } from '@/lib/auth';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { user, setUser, setIsAuthenticated } = useAppStore();

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setIsAuthenticated(false);
    router.push('/login');
  };

  const isActive = (path: string) => router.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-primary">
                🚪 Doorman
              </Link>
              <nav className="hidden md:flex space-x-6">
                <Link
                  href="/dashboard"
                  className={`font-medium transition ${
                    isActive('/dashboard')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/doors"
                  className={`font-medium transition ${
                    isActive('/doors')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Doors
                </Link>
                <div className="relative group">
                  <button
                    className={`font-medium transition ${
                      router.pathname.startsWith('/admin')
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Admin ▾
                  </button>
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg">Dashboard</Link>
                    <Link href="/admin/classifications" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Classifications</Link>
                    <Link href="/admin/object-types" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Object Types</Link>
                    <Link href="/admin/module-folders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Module Folders</Link>
                    <Link href="/admin/modules" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Modules</Link>
                    <Link href="/admin/relationships" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg">Relationships</Link>
                  </div>
                </div>
              </nav>
            </div>

            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.groups.join(', ')}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>Doorman Process Portal | Phase 4 UI Development</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
