/**
 * Phase 4: Login Page
 * 
 * Authentication page with form
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import { loginUser } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setIsAuthenticated } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await loginUser(username, password);
      setUser(user);
      setIsAuthenticated(true);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Doorman - Login</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Doorman</h1>
            <p className="text-gray-600 mt-2">Process Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="john.locksmith"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Try: john.locksmith, jane.supervisor, mike.maintenance, admin
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="password123"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-50 rounded text-sm text-gray-700">
            <p className="font-semibold mb-2">Demo Accounts:</p>
            <ul className="space-y-1 text-xs">
              <li>👷 Locksmith: john.locksmith</li>
              <li>👔 Supervisor: jane.supervisor</li>
              <li>🔧 Maintenance: mike.maintenance</li>
              <li>🛡️ Security Admin: admin</li>
            </ul>
            <p className="mt-2">All passwords: password123</p>
          </div>
        </div>
      </div>
    </>
  );
}
