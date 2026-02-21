import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Ange användarnamn och lösenord'); return; }
    setLoading(true);
    // Simulate auth — any creds work for demo
    setTimeout(() => {
      setLoading(false);
      router.push('/admin');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-samrum-bg flex flex-col">
      {/* Header */}
      <header className="bg-samrum-header text-white h-14 flex items-center px-6 shadow-nav">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-samrum-accent" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          <span className="text-xl font-bold tracking-widest">SAMRUM</span>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-panel border border-samrum-border overflow-hidden">
            {/* Card header */}
            <div className="bg-samrum-header px-6 py-6 text-center">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-samrum-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wider">SAMRUM</h1>
              <p className="text-slate-400 text-sm mt-1">Administrationsportal</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="px-6 py-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Ange inloggningsuppgifter</h2>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Användarnamn:
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border border-samrum-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 focus:border-samrum-blue transition-colors"
                  placeholder="mats.dahlberg"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Lösenord:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-samrum-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-samrum-blue/30 focus:border-samrum-blue transition-colors"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-samrum-accent hover:bg-samrum-accent-hover disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Loggar in...
                  </>
                ) : 'Logga in'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Samrum Projekt AB – IT samarbete
          </p>
        </div>
      </div>
    </div>
  );
}
