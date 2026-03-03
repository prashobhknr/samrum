import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SamrumLayout from '../../components/SamrumLayout';
import Loading from '../../components/Loading';
import { getStoredToken } from '../../lib/auth';

const API = 'http://localhost:3000';

interface ObjType {
  id: number;
  name_singular: string;
  name_plural: string;
  classification_name: string | null;
  classification_id: number | null;
  data_type_name: string;
}

interface Instance {
  id: number;
  external_id: string;
  name: string;
}

export default function ClassifyPage() {
  const [objectTypes, setObjectTypes] = useState<ObjType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ObjType | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API}/api/admin/object-types?page=1&pageSize=1400`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) setObjectTypes(d.data ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectType = (ot: ObjType) => {
    setSelectedType(ot);
    setSelectedGroup(ot.classification_name ?? 'Ej klassificerade');
    setInstances([]);
    setLoadingInstances(true);
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    fetch(`${API}/api/objects/types/${ot.id}/instances`, { headers })
      .then(r => r.json())
      .then(d => { if (d.success) setInstances(d.data ?? []); })
      .catch(console.error)
      .finally(() => setLoadingInstances(false));
  };

  const toggleGroup = (name: string) => {
    setSelectedGroup(name);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Group object types by classification
  const filtered = search
    ? objectTypes.filter(ot => ot.name_singular.toLowerCase().includes(search.toLowerCase()))
    : objectTypes;

  const groups: Record<string, ObjType[]> = {};
  filtered.forEach(ot => {
    const key = ot.classification_name ?? 'Ej klassificerade';
    if (!groups[key]) groups[key] = [];
    groups[key].push(ot);
  });
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200">
        <input
          type="text"
          placeholder="Sök objekttyp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-4 py-3 text-xs text-slate-400">Laddar...</div>
        ) : (
          sortedGroups.map(([groupName, types]) => {
            const isOpen = expandedGroups.has(groupName) || !!search;
            return (
              <div key={groupName}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className={`w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors ${
                    selectedGroup === groupName ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className={`text-xs font-medium truncate ${selectedGroup === groupName ? 'text-blue-700' : 'text-slate-700'}`}>{groupName}</span>
                  <span className={`ml-auto text-[10px] flex-shrink-0 ${selectedGroup === groupName ? 'text-blue-500' : 'text-slate-400'}`}>{types.length}</span>
                </button>
                {/* Object types in group */}
                {isOpen && types.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => selectType(ot)}
                    className={`w-full flex items-center gap-1.5 pl-7 pr-3 py-1.5 hover:bg-slate-50 text-left ${
                      selectedType?.id === ot.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs truncate">{ot.name_singular}</span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <SamrumLayout sidebar={sidebar} sidebarTitle="Visa som lista">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-slate-900">Klassificera objekt (A005)</span>
            {selectedType && (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-slate-900 truncate">{selectedType.name_singular}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">A005 – Klassificera objekt</h1>
          {selectedType ? (
            <p className="text-sm text-slate-500">
              {selectedType.classification_name ?? 'Ej klassificerad'} › {selectedType.name_singular}
              {!loadingInstances && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                  {instances.length} {instances.length === 1 ? 'objekt' : 'objekt'}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Välj en objekttyp i trädet till vänster</p>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedType ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-sm font-medium">Välj en objekttyp</p>
              <p className="text-xs text-slate-400 mt-1">
                Klicka på en typ i trädet till vänster för att se dess objekt
              </p>
            </div>
          ) : loadingInstances ? (
            <Loading />
          ) : instances.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm font-medium text-slate-600">Inga objekt av typen &quot;{selectedType.name_singular}&quot;</p>
              <p className="text-xs text-slate-400 mt-1">Inga instanser är skapade för denna objekttyp</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  {selectedType.name_plural || selectedType.name_singular}
                </h2>
                <span className="text-xs text-slate-500">{instances.length} objekt</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Namn</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Klassificering</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instances.map(inst => (
                    <tr key={inst.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {inst.external_id || `#${inst.id}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {inst.name || <span className="text-slate-400 italic text-xs">Ej angiven</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {selectedType.classification_name ?? 'Ej klassificerad'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/objects/${inst.id}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                        >
                          Visa →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SamrumLayout>
  );
}
