import React, { useEffect, useState } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import Loading from '../../components/Loading';
import { getStoredToken } from '../../lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface IncompleteObject {
  id: number;
  external_id: string;
  instance_name: string;
  object_type: string;
  missing_attributes: { id: number; name: string }[];
}

interface ValidationError {
  instance_id: number;
  external_id: string;
  instance_name: string;
  object_type: string;
  attribute: string;
  description: string;
  error_type: string;
}

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<'incomplete' | 'validation'>('incomplete');
  const [incomplete, setIncomplete] = useState<IncompleteObject[]>([]);
  const [validation, setValidation] = useState<ValidationError[]>([]);
  const [loadingIncomplete, setLoadingIncomplete] = useState(true);
  const [loadingValidation, setLoadingValidation] = useState(true);
  const [errorIncomplete, setErrorIncomplete] = useState<string | null>(null);
  const [errorValidation, setErrorValidation] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    fetch(`${API}/api/admin/analysis/incomplete`, { headers })
      .then(r => r.json())
      .then(j => { if (j.success) setIncomplete(j.data); else setErrorIncomplete('Misslyckades att hämta data'); })
      .catch(() => setErrorIncomplete('Nätverksfel'))
      .finally(() => setLoadingIncomplete(false));

    fetch(`${API}/api/admin/analysis/validation`, { headers })
      .then(r => r.json())
      .then(j => { if (j.success) setValidation(j.data); else setErrorValidation('Misslyckades att hämta data'); })
      .catch(() => setErrorValidation('Nätverksfel'))
      .finally(() => setLoadingValidation(false));
  }, []);

  const tabs = [
    { id: 'incomplete' as const, label: 'Ofullständiga objekt (A006)', count: incomplete.length },
    { id: 'validation' as const, label: 'Valideringsfel (A007)', count: validation.length },
  ];

  return (
    <SamrumLayout sidebarTitle="Analys & Kvalitet">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Analys & Kvalitet</h1>
          <span className="text-xs text-slate-400">Automatisk kontroll av objektdata</span>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-samrum-blue text-samrum-blue'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-samrum-blue/10 text-samrum-blue' : 'bg-red-100 text-red-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab: Ofullständiga objekt (A006) */}
        {activeTab === 'incomplete' && (
          <div>
            <p className="text-sm text-slate-500 mb-4">Lista över objekt som saknar obligatoriska attributvärden.</p>
            {loadingIncomplete ? <Loading /> : errorIncomplete ? (
              <div className="bg-red-50 p-4 border border-red-200 text-red-700 rounded-lg">{errorIncomplete}</div>
            ) : incomplete.length === 0 ? (
              <div className="bg-green-50 p-8 border border-green-200 text-green-700 rounded-lg text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">Inga ofullständiga objekt hittades!</p>
                <p className="text-sm opacity-80">All obligatorisk data är ifylld för samtliga objekt.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekt</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekttyp</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saknade attribut</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incomplete.map(obj => (
                      <tr key={obj.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{obj.external_id}</div>
                          <div className="text-xs text-slate-400">{obj.instance_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">{obj.object_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {obj.missing_attributes.map(attr => (
                              <span key={attr.id} className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{attr.name}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <a href={`/objects/${obj.id}`} className="text-samrum-blue hover:underline text-xs font-medium">Visa objekt →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Valideringsfel (A007) */}
        {activeTab === 'validation' && (
          <div>
            <p className="text-sm text-slate-500 mb-4">Valideringsfel för objekt – obligatoriska attribut och relationer som inte uppfylls.</p>
            {loadingValidation ? <Loading /> : errorValidation ? (
              <div className="bg-red-50 p-4 border border-red-200 text-red-700 rounded-lg">{errorValidation}</div>
            ) : validation.length === 0 ? (
              <div className="bg-green-50 p-8 border border-green-200 text-green-700 rounded-lg text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">Inga valideringsfel hittades!</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekttyp</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekt</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Attribut</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Beskrivning</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validation.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">{err.object_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{err.external_id}</div>
                          {err.instance_name && <div className="text-xs text-slate-400">{err.instance_name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{err.attribute}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{err.description}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <a href={`/objects/${err.instance_id}`} className="text-samrum-blue hover:underline text-xs font-medium">Visa objekt →</a>
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
    </SamrumLayout>
  );
}
