import React, { useEffect, useState } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import TreeNav, { TreeNode } from '../../components/TreeNav';

const API_URL = 'http://localhost:3000';

interface IdSet {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

interface Definition {
  id: number;
  name: string;
  type: string;
  created_at: string;
}

type ActiveSection = 'id-sets' | 'definitions';

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('sv-SE');
  } catch {
    return String(val);
  }
}

export default function ImportExportPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('id-sets');
  const [idSets, setIdSets] = useState<IdSet[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(false);

  // Create modals
  const [showCreateIdSet, setShowCreateIdSet] = useState(false);
  const [showCreateDef, setShowCreateDef] = useState(false);
  const [newIdSet, setNewIdSet] = useState({ name: '', description: '' });
  const [newDef, setNewDef] = useState({ name: '', type: 'IFC' });

  const loadIdSets = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/import-export/id-sets`);
      const d = await r.json();
      setIdSets(d.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  const loadDefinitions = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/import-export/definitions`);
      const d = await r.json();
      setDefinitions(d.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdSets();
    loadDefinitions();
  }, []);

  const deleteIdSet = async (id: number) => {
    if (!confirm('Ta bort denna ID-uppsättning?')) return;
    await fetch(`${API_URL}/api/admin/import-export/id-sets/${id}`, { method: 'DELETE' });
    loadIdSets();
  };

  const deleteDefinition = async (id: number) => {
    if (!confirm('Ta bort denna definition?')) return;
    await fetch(`${API_URL}/api/admin/import-export/definitions/${id}`, { method: 'DELETE' });
    loadDefinitions();
  };

  const createIdSet = async () => {
    if (!newIdSet.name.trim()) return;
    await fetch(`${API_URL}/api/admin/import-export/id-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIdSet),
    });
    setShowCreateIdSet(false);
    setNewIdSet({ name: '', description: '' });
    loadIdSets();
  };

  const createDefinition = async () => {
    if (!newDef.name.trim()) return;
    await fetch(`${API_URL}/api/admin/import-export/definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDef),
    });
    setShowCreateDef(false);
    setNewDef({ name: '', type: 'IFC' });
    loadDefinitions();
  };

  const treeNodes: TreeNode[] = [
    {
      id: 'root',
      label: 'Import/Export',
      type: 'folder',
      children: [
        { id: 'id-sets', label: 'ID-Uppsättningar', type: 'folder' },
        { id: 'definitions', label: 'Definitioner', type: 'folder' },
      ],
    },
  ];

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Struktur</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <TreeNav
          nodes={treeNodes}
          selectedId={activeSection}
          defaultExpanded
          onSelect={(node) => {
            const id = String(node.id);
            if (id === 'id-sets' || id === 'definitions') {
              setActiveSection(id as ActiveSection);
            } else if (id === 'root') {
              setActiveSection('id-sets');
            }
          }}
        />
      </div>
    </div>
  );

  return (
    <SamrumLayout sidebar={sidebar} sidebarTitle="Import/Export">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            <span className="font-medium text-slate-900">Import/Export</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">B014 – Administrera import/export</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeSection === 'id-sets' ? 'ID-Uppsättningar' : 'Definitioner'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ID-Uppsättningar */}
          {activeSection === 'id-sets' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">ID-Uppsättningar</h2>
                <button
                  onClick={() => setShowCreateIdSet(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  Skapa ny ID-uppsättning
                </button>
              </div>

              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">Laddar...</div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Namn</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Beskrivning</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Skapad</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Radera</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {idSets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                            Inga ID-uppsättningar skapade ännu
                          </td>
                        </tr>
                      ) : idSets.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                          <td className="px-4 py-3 text-slate-600">{item.description || <span className="text-slate-400 italic">—</span>}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteIdSet(item.id)}
                              className="text-red-500 hover:text-red-700 hover:underline text-xs font-medium"
                            >
                              Radera
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Definitioner */}
          {activeSection === 'definitions' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Definitioner</h2>
                <button
                  onClick={() => setShowCreateDef(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  Skapa ny definition
                </button>
              </div>

              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">Laddar...</div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Namn</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Typ</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Skapad</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Radera</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {definitions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                            Inga definitioner skapade ännu
                          </td>
                        </tr>
                      ) : definitions.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteDefinition(item.id)}
                              className="text-red-500 hover:text-red-700 hover:underline text-xs font-medium"
                            >
                              Radera
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create ID Set Modal */}
      {showCreateIdSet && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Ny ID-uppsättning</h2>
              <button onClick={() => setShowCreateIdSet(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={newIdSet.name}
                  onChange={e => setNewIdSet(v => ({ ...v, name: e.target.value }))}
                  placeholder="ID-uppsättningsnamn"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivning</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  value={newIdSet.description}
                  onChange={e => setNewIdSet(v => ({ ...v, description: e.target.value }))}
                  placeholder="Valfri beskrivning"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateIdSet(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={createIdSet} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Spara</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Definition Modal */}
      {showCreateDef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Ny definition</h2>
              <button onClick={() => setShowCreateDef(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Namn *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={newDef.name}
                  onChange={e => setNewDef(v => ({ ...v, name: e.target.value }))}
                  placeholder="Definitionsnamn"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                  value={newDef.type}
                  onChange={e => setNewDef(v => ({ ...v, type: e.target.value }))}
                >
                  <option value="IFC">IFC</option>
                  <option value="Excel">Excel</option>
                  <option value="CSV">CSV</option>
                  <option value="XML">XML</option>
                  <option value="JSON">JSON</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateDef(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 rounded-lg">Avbryt</button>
              <button onClick={createDefinition} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg">Spara</button>
            </div>
          </div>
        </div>
      )}
    </SamrumLayout>
  );
}
