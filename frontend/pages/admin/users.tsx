import React, { useEffect, useState } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import { getStoredToken } from '../../lib/auth';

interface User {
  id: number;
  username: string;
  email: string | null;
  created_at?: string;
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'roles' | 'projects'>('info');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', email: '' });
  const [projects, setProjects] = useState<{ id: number; name: string; has_access: boolean }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', email: '' });
  const [passwordResetShown, setPasswordResetShown] = useState(false);
  const API_URL = 'http://localhost:3000';

  const getHeaders = () => {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, { headers: getHeaders() });
      const data = await res.json();
      setUsers(data.data || []);
    } catch (e) {
      console.error('Failed to fetch users', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (userId: number) => {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/projects`, { headers: getHeaders() });
    const data = await res.json();
    setProjects(data.data || []);
  };

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    setEditMode(false);
    setPasswordResetShown(false);
    setEditForm({ username: user.username, email: user.email || '' });
    setActiveTab('info');
    await fetchProjects(user.id);
  };

  const saveUserInfo = async () => {
    if (!selectedUser) return;
    await fetch(`${API_URL}/api/admin/users/${selectedUser.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(editForm),
    });
    setSelectedUser({ ...selectedUser, ...editForm });
    setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...editForm } : u));
    setEditMode(false);
  };

  const saveProjects = async () => {
    if (!selectedUser) return;
    const projectIds = projects.filter(p => p.has_access).map(p => p.id);
    await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/projects`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ project_ids: projectIds }),
    });
  };

  const resetPassword = async () => {
    if (!selectedUser) return;
    await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
    });
    setPasswordResetShown(true);
  };

  const createUser = async () => {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (data.success) {
      setUsers([...users, data.data]);
      setShowCreateModal(false);
      setCreateForm({ username: '', email: '' });
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Delete user "${selectedUser.username}"?`)) return;
    await fetch(`${API_URL}/api/admin/users/${selectedUser.id}`, { method: 'DELETE', headers: getHeaders() });
    setUsers(users.filter(u => u.id !== selectedUser.id));
    setSelectedUser(null);
  };

  const rightPanel = (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Användare</h2>
        <button onClick={() => setShowCreateModal(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ny användare</button>
      </div>
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-xs font-medium text-slate-500 cursor-pointer">Användarnamn ▼</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="p-4 text-center text-sm text-slate-500">Laddar...</div> : (
          <div className="divide-y divide-slate-100">
            {users.map(user => (
              <div key={user.id} onClick={() => selectUser(user)} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 flex items-center justify-between ${selectedUser?.id === user.id ? 'bg-blue-50' : ''}`}>
                <span className="text-sm text-slate-700">{user.username}</span>
                <button className="text-xs text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); selectUser(user); }}>Visa</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-center gap-2">
        <span>◄</span>{[1, 2, 3, 4, 5].map(n => <span key={n} className={`cursor-pointer ${n === 1 ? 'font-semibold text-slate-700' : ''}`}>{n}</span>)}<span>►</span>
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (passwordResetShown) {
      return (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Lösenordsåterställning</h3>
          <p className="text-sm text-amber-700 mb-4">Du kommer nu att generera ett nytt lösenord för användaren. Ett epostmeddelande med det nya lösenordet skickas till användaren.</p>
          <div className="flex gap-3">
            <button onClick={() => setPasswordResetShown(false)} className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50">Tillbaka</button>
            <button onClick={() => { alert('Nytt lösenord skickat!'); setPasswordResetShown(false); }} className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700">Generera nytt lösenord</button>
          </div>
        </div>
      );
    }

    if (activeTab === 'info') return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Användarnamn</label>
            {editMode ? <input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /> : <div className="text-sm text-slate-900 py-2">{selectedUser?.username}</div>}
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Epost</label>
            {editMode ? <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /> : <div className="text-sm text-slate-900 py-2">{selectedUser?.email || '-'}</div>}
          </div></div>
        <div className="flex gap-3 pt-2">
          {editMode ? (
            <><button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50">Avbryt</button>
              <button onClick={saveUserInfo} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Spara</button></>
          ) : (
            <><button onClick={() => setEditMode(true)} className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50">Ändra</button>
              <button onClick={resetPassword} className="px-4 py-2 text-sm bg-slate-600 text-white rounded hover:bg-slate-700">Byt lösenord</button>
              <button onClick={deleteUser} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Radera</button></>
          )}
        </div>
      </div>
    );

    if (activeTab === 'roles') return (
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2 mb-4"><h3 className="text-sm font-medium text-slate-700">Roll</h3></div>
        <p className="text-sm text-slate-500 italic">Rollhantering är inaktiverad.</p>
      </div>
    );

    if (activeTab === 'projects') return (
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2 mb-4"><h3 className="text-sm font-medium text-slate-700">Projekt</h3></div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {projects.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.has_access} onChange={e => setProjects(projects.map(x => x.id === p.id ? { ...x, has_access: e.target.checked } : x))} className="w-4 h-4" />
              <span className="text-sm text-slate-700">{p.name}</span>
            </label>
          ))}
        </div>
        <button onClick={saveProjects} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Spara</button>
      </div>
    );

    return null;
  };

  return (
    <SamrumLayout rightPanel={rightPanel} rightPanelTitle="Användare">
      <div className="max-w-3xl mx-auto py-6 px-8">
        {selectedUser ? (
          <>
            <div className="border-b border-slate-200 mb-6">
              <div className="flex gap-6">
                {[{ id: 'info', label: 'Användarinformation' }, { id: 'roles', label: 'Roller' }, { id: 'projects', label: 'Projekttillgång' }].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
                ))}
              </div>
            </div>
            {renderTabContent()}
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="text-center"><p className="text-lg mb-2">Välj en användare</p><p className="text-sm">Klicka på "Visa" för att se användardetaljer</p></div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Ny användare</h3>
              <div className="space-y-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Användarnamn</label><input value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Epost</label><input value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" /></div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50">Avbryt</button>
                <button onClick={createUser} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Skapa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SamrumLayout>
  );
}
